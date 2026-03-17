import { describe, it, expect } from "vitest";
import { checkStageCompleteness } from "../../src/tools/check-stage-completeness.js";

describe("vendor_risk_triage completion criteria", () => {
  const baseState = {
    vendor_profile: {
      name: "Acme Cloud Services",
      lei_status: "active",
      sanctions_status: "clear",
    },
    documents: [],
    risk_profile: {
      signal_sources: [
        {
          source: "vendor_intelligence",
          signal_type: "breach_history",
          finding: "No breaches found in public records or intelligence feeds",
          confidence: "high",
        },
      ],
    },
    risk_classification: {
      tier: "standard",
      dimension_scores: {
        data_sensitivity: 3,
        access_scope: 2,
        security_maturity: 3,
        regulatory_exposure: 2,
        business_criticality: 3,
      },
      rationale:
        "Vendor provides non-critical SaaS service with standard data access and adequate security posture based on SOC 2 certification. Dimension scores reflect moderate data sensitivity and business criticality with low access scope.",
    },
    recommendation: {
      decision: "go",
      rationale:
        "Vendor passes triage screening. No sanctions flags, verified entity, adequate security posture for standard-tier vendor. Recommended for standard monitoring cadence. All external intelligence sources returned clean results with no breach history or vulnerability exposure detected.",
      monitoring_cadence: "annual",
    },
  };

  it("marks complete state as complete", async () => {
    const result = await checkStageCompleteness({
      task_id: "vendor_risk_triage",
      stage_id: "vendor_risk_triage",
      definition_version: "1.0",
      stage_state: baseState,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).not.toBe("incomplete");
  });

  it("rejects state missing vendor_profile.name", async () => {
    const state = {
      ...baseState,
      vendor_profile: { lei_status: "active", sanctions_status: "clear" },
    };
    const result = await checkStageCompleteness({
      task_id: "vendor_risk_triage",
      stage_id: "vendor_risk_triage",
      definition_version: "1.0",
      stage_state: state,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("incomplete");
  });

  it("rejects conditional decision without conditions", async () => {
    const state = {
      ...baseState,
      recommendation: {
        decision: "conditional",
        rationale:
          "Vendor requires ISO 27001 certification before proceeding with data processing agreement. Additional documentation needed for security posture validation. Current security maturity score is below threshold for unrestricted engagement with sensitive data processing activities.",
      },
    };
    const result = await checkStageCompleteness({
      task_id: "vendor_risk_triage",
      stage_id: "vendor_risk_triage",
      definition_version: "1.0",
      stage_state: state,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("incomplete");
  });

  it("rejects no_go decision without blocking_findings", async () => {
    const state = {
      ...baseState,
      recommendation: {
        decision: "no_go",
        rationale:
          "Vendor flagged on consolidated sanctions list. Cannot proceed with engagement under any circumstances due to regulatory requirements. Sanctions screening returned a confirmed match against restricted entities database maintained by the relevant financial authority.",
      },
    };
    const result = await checkStageCompleteness({
      task_id: "vendor_risk_triage",
      stage_id: "vendor_risk_triage",
      definition_version: "1.0",
      stage_state: state,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("incomplete");
  });
});
