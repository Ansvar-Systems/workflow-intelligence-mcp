import { describe, it, expect } from "vitest";
import type {
  EvidenceRecord,
  ProvisionAssessment,
  SectionAssessment,
  GapAnalysisStageState,
  GapSummary,
} from "../../src/types/gap-analysis.js";

describe("gap-analysis types", () => {
  it("constructs a valid ProvisionAssessment", () => {
    const assessment: ProvisionAssessment = {
      provision_ref: "DORA Art. 5(1)",
      regulation_source: "dora",
      status: "compliant",
      evidence: [
        {
          type: "policy",
          reference: "ICT Risk Management Policy v3.2",
          date: "2026-01-15",
        },
      ],
      gaps: null,
      exemption_basis: null,
      assessed_by: "J. Smith",
      assessed_at: "2026-03-06T14:00:00Z",
    };
    expect(assessment.status).toBe("compliant");
    expect(assessment.evidence).toHaveLength(1);
  });

  it("constructs a valid GapAnalysisStageState", () => {
    const state: GapAnalysisStageState = {
      scoping: {
        entity_name: "Test Bank AG",
        entity_type: "credit_institution",
        is_microenterprise: false,
        designated_for_tlpt: true,
      },
      sections: [
        {
          section_id: "pillar_1_ict_risk_management",
          section_name: "Pillar 1: ICT Risk Management",
          provisions: [],
        },
      ],
    };
    expect(state.sections).toHaveLength(1);
  });

  it("allows all AssessmentStatus values", () => {
    const statuses: ProvisionAssessment["status"][] = [
      "compliant",
      "partially_compliant",
      "non_compliant",
      "not_applicable",
      "not_assessed",
    ];
    expect(statuses).toHaveLength(5);
  });
});
