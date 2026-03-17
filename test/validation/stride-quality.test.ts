import { describe, it, expect } from "vitest";
import {
  checkSeverityMatchesRiskScore,
  checkSeverityInflation,
  checkCriticalLowLikelihood,
  checkThreatTemplateCompleteness,
  checkEntryPointsDocumented,
  checkQaBlockingResolved,
  checkEnrichmentRatioSufficient,
} from "../../src/validation/rules/stride.js";

describe("checkSeverityMatchesRiskScore", () => {
  it("passes when severity matches L*I band", () => {
    const state = { threats: [{ id: "T-001", severity: "high", impact_index: 4, likelihood_index: 3 }] };
    expect(checkSeverityMatchesRiskScore(state)).toHaveLength(0);
  });

  it("fails when severity does not match L*I band and no override rationale", () => {
    const state = { threats: [{ id: "T-001", severity: "critical", impact_index: 3, likelihood_index: 2 }] };
    const failures = checkSeverityMatchesRiskScore(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe("severity_matches_risk_score");
    expect(failures[0].severity).toBe("required");
    expect(failures[0].details).toContain("T-001");
    expect(failures[0].details).toContain("medium");
  });

  it("passes when severity does not match but override rationale is provided", () => {
    const state = {
      threats: [{
        id: "T-001", severity: "critical", impact_index: 3, likelihood_index: 2,
        severity_override_rationale: "Sector-specific intelligence indicates active exploitation",
      }],
    };
    expect(checkSeverityMatchesRiskScore(state)).toHaveLength(0);
  });

  it("skips informational threats", () => {
    const state = { threats: [{ id: "T-001", severity: "informational" }] };
    expect(checkSeverityMatchesRiskScore(state)).toHaveLength(0);
  });

  it("fails when impact_index or likelihood_index is missing on non-informational threat", () => {
    const state = { threats: [{ id: "T-001", severity: "high" }] };
    const failures = checkSeverityMatchesRiskScore(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].details).toContain("missing impact_index or likelihood_index");
  });
});

describe("checkSeverityInflation", () => {
  it("passes when <20% critical", () => {
    const threats = [
      { id: "T-001", severity: "critical" },
      { id: "T-002", severity: "high" },
      { id: "T-003", severity: "high" },
      { id: "T-004", severity: "medium" },
      { id: "T-005", severity: "low" },
      { id: "T-006", severity: "medium" },
    ];
    expect(checkSeverityInflation({ threats })).toHaveLength(0);
  });

  it("warns when >20% critical with >= 5 threats", () => {
    const threats = [
      { id: "T-001", severity: "critical" },
      { id: "T-002", severity: "critical" },
      { id: "T-003", severity: "high" },
      { id: "T-004", severity: "medium" },
      { id: "T-005", severity: "low" },
    ];
    const failures = checkSeverityInflation({ threats });
    expect(failures).toHaveLength(1);
    expect(failures[0].severity).toBe("warning");
    expect(failures[0].details).toContain("40%");
  });

  it("skips when fewer than 5 threats", () => {
    const threats = [
      { id: "T-001", severity: "critical" },
      { id: "T-002", severity: "high" },
      { id: "T-003", severity: "medium" },
    ];
    expect(checkSeverityInflation({ threats })).toHaveLength(0);
  });
});

describe("checkCriticalLowLikelihood", () => {
  it("warns when critical threat has likelihood_index <= 2", () => {
    const state = { threats: [{ id: "T-001", severity: "critical", likelihood_index: 1 }] };
    const failures = checkCriticalLowLikelihood(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].severity).toBe("warning");
  });

  it("passes when critical threat has likelihood_index >= 3", () => {
    const state = { threats: [{ id: "T-001", severity: "critical", likelihood_index: 4 }] };
    expect(checkCriticalLowLikelihood(state)).toHaveLength(0);
  });

  it("ignores non-critical threats", () => {
    const state = { threats: [{ id: "T-001", severity: "high", likelihood_index: 1 }] };
    expect(checkCriticalLowLikelihood(state)).toHaveLength(0);
  });
});

describe("checkThreatTemplateCompleteness", () => {
  const COMPLETE_THREAT = {
    id: "T-001",
    stride_category: "Spoofing",
    component_id: "C-001",
    title: "Credential compromise via brute force",
    description: "An attacker performs brute-force authentication against the login API to gain unauthorized access to user accounts",
    mcp_source: "stride-pattern-S-001",
    cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N",
    cvss_score: 8.7,
    severity: "high",
    impact_index: 4,
    likelihood_index: 3,
    business_impact: "Account takeover leading to data breach",
    likelihood: "Likely",
  };

  it("passes for a complete threat", () => {
    expect(checkThreatTemplateCompleteness({ threats: [COMPLETE_THREAT] })).toHaveLength(0);
  });

  it("fails listing missing fields", () => {
    const state = {
      threats: [{ id: "T-001", stride_category: "Spoofing", title: "Short", severity: "high" }],
    };
    const failures = checkThreatTemplateCompleteness(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe("threat_template_completeness");
    expect(failures[0].details).toContain("component_id");
    expect(failures[0].details).toContain("impact_index");
  });

  it("fails when description has fewer than 10 words", () => {
    const state = {
      threats: [{ ...COMPLETE_THREAT, description: "Short desc" }],
    };
    const failures = checkThreatTemplateCompleteness(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].details).toContain("description");
  });

  it("skips scoring fields for informational threats", () => {
    const state = {
      threats: [{
        id: "T-001",
        stride_category: "Information Disclosure",
        component_id: "C-001",
        title: "Deprecated TLS library in use",
        description: "The system uses a deprecated TLS 1.0 library but the endpoint is internal-only and not exploitable",
        mcp_source: "analyst-observation",
        severity: "informational",
        business_impact: "None — internal only",
        likelihood: "N/A",
      }],
    };
    expect(checkThreatTemplateCompleteness(state)).toHaveLength(0);
  });
});

describe("checkEntryPointsDocumented", () => {
  it("passes when entry points exist", () => {
    const state = { entry_points: [{ id: "EP-001", name: "Public API" }] };
    expect(checkEntryPointsDocumented(state)).toHaveLength(0);
  });

  it("passes when no entry points and gaps register notes it", () => {
    const state = { entry_points: [], gaps: [{ id: "G-001", description: "No entry point enumeration possible", phase: "1" }] };
    expect(checkEntryPointsDocumented(state)).toHaveLength(0);
  });

  it("fails when no entry points and gaps register does not note it", () => {
    const state = { entry_points: [], gaps: [] };
    const failures = checkEntryPointsDocumented(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe("entry_points_documented");
  });

  it("fails when entry_points missing entirely and no gaps", () => {
    const state = {};
    const failures = checkEntryPointsDocumented(state);
    expect(failures).toHaveLength(1);
  });
});

describe("checkQaBlockingResolved", () => {
  it("passes when all blocking findings are resolved", () => {
    const state = {
      qa_findings: [
        { id: "QA-001", category: "template_gap", severity: "blocking", resolved: true, description: "fixed" },
        { id: "QA-002", category: "enrichment_gap", severity: "warning", resolved: false, description: "ok" },
      ],
    };
    expect(checkQaBlockingResolved(state)).toHaveLength(0);
  });

  it("fails when unresolved blocking finding exists", () => {
    const state = {
      qa_findings: [
        { id: "QA-001", category: "severity_mismatch", severity: "blocking", resolved: false, description: "T-001 mismatch" },
      ],
    };
    const failures = checkQaBlockingResolved(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].details).toContain("QA-001");
  });

  it("passes when no qa_findings", () => {
    expect(checkQaBlockingResolved({})).toHaveLength(0);
  });
});

describe("checkEnrichmentRatioSufficient", () => {
  it("passes when enrichment_ratio >= 0.8", () => {
    const state = { enrichment_coverage: { total_threats: 10, enrichment_ratio: 0.9 } };
    expect(checkEnrichmentRatioSufficient(state)).toHaveLength(0);
  });

  it("warns when enrichment_ratio < 0.8", () => {
    const state = { enrichment_coverage: { total_threats: 10, enrichment_ratio: 0.5 } };
    const failures = checkEnrichmentRatioSufficient(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].severity).toBe("warning");
    expect(failures[0].details).toContain("50%");
  });

  it("passes when no enrichment_coverage", () => {
    expect(checkEnrichmentRatioSufficient({})).toHaveLength(0);
  });
});
