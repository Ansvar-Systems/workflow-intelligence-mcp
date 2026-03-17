import { describe, it, expect } from "vitest";
import {
  checkSeverityMatchesRiskScore,
  checkSeverityInflation,
  checkCriticalLowLikelihood,
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
