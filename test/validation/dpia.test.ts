import { describe, it, expect } from "vitest";
import {
  checkDpiaScreeningOutcomeValid,
  checkDpiaProcessingDescriptionComplete,
  checkDpiaNecessityComplete,
  checkDpiaEveryRiskHasCategoryAndRights,
  checkDpiaUniqueRiskIds,
  checkDpiaRiskAnalysisReferencesKnownRisks,
  checkDpiaSafeguardsReferenceKnownRisks,
  checkDpiaConsultationComplete,
  checkDpiaConsultationReferencesResidualRisks,
  checkDpiaResidualScoreCoherence,
  checkDpiaRiskCoverageComplete,
} from "../../src/validation/rules/dpia.js";

describe("DPIA structural rules", () => {
  // -----------------------------------------------------------------------
  // dpia_screening_outcome_valid
  // -----------------------------------------------------------------------
  describe("dpia_screening_outcome_valid", () => {
    it("passes with valid outcome and rationale", () => {
      const state = {
        screening: {
          outcome: "required",
          rationale: "Art. 35(3)(a) profiling trigger met",
        },
      };
      expect(checkDpiaScreeningOutcomeValid(state)).toHaveLength(0);
    });

    it("passes with not_required outcome", () => {
      const state = {
        screening: {
          outcome: "not_required",
          rationale: "Art. 35(5) exemption applies",
        },
      };
      expect(checkDpiaScreeningOutcomeValid(state)).toHaveLength(0);
    });

    it("fails when screening is missing", () => {
      expect(checkDpiaScreeningOutcomeValid({})).toHaveLength(1);
    });

    it("fails with invalid outcome value", () => {
      const state = {
        screening: { outcome: "maybe", rationale: "unsure" },
      };
      const f = checkDpiaScreeningOutcomeValid(state);
      expect(f.length).toBeGreaterThanOrEqual(1);
      expect(f[0].details).toContain("maybe");
    });

    it("fails with empty rationale", () => {
      const state = {
        screening: { outcome: "required", rationale: "  " },
      };
      const f = checkDpiaScreeningOutcomeValid(state);
      expect(f.some((x) => x.details.includes("rationale"))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // dpia_processing_description_complete
  // -----------------------------------------------------------------------
  describe("dpia_processing_description_complete", () => {
    const validPd = {
      processing_description: {
        data_types: [{ category: "health", sensitivity_flag: "special_category_art9" }],
        data_subjects: [{ type: "patients", vulnerable: true }],
        purposes: ["medical treatment"],
        legal_basis: {
          article_6_basis: { basis: "legal_obligation", article: "Art. 6(1)(c)" },
        },
      },
    };

    it("passes with all required nested fields", () => {
      expect(checkDpiaProcessingDescriptionComplete(validPd)).toHaveLength(0);
    });

    it("fails when processing_description is missing", () => {
      expect(checkDpiaProcessingDescriptionComplete({})).toHaveLength(1);
    });

    it("fails when data_types is empty", () => {
      const state = {
        processing_description: { ...validPd.processing_description, data_types: [] },
      };
      const f = checkDpiaProcessingDescriptionComplete(state);
      expect(f.some((x) => x.details.includes("data_types"))).toBe(true);
    });

    it("fails when legal_basis.article_6_basis is missing", () => {
      const state = {
        processing_description: {
          ...validPd.processing_description,
          legal_basis: {},
        },
      };
      const f = checkDpiaProcessingDescriptionComplete(state);
      expect(f.some((x) => x.details.includes("article_6_basis"))).toBe(true);
    });

    it("fails when legal_basis itself is missing", () => {
      const { legal_basis: _, ...rest } = validPd.processing_description;
      const state = { processing_description: rest };
      const f = checkDpiaProcessingDescriptionComplete(state);
      expect(f.some((x) => x.details.includes("article_6_basis"))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // dpia_necessity_complete
  // -----------------------------------------------------------------------
  describe("dpia_necessity_complete", () => {
    it("passes with both narratives", () => {
      const state = {
        necessity_assessment: {
          assessment_narrative: "Processing is necessary for...",
          proportionality_assessment: "Data minimisation verified...",
        },
      };
      expect(checkDpiaNecessityComplete(state)).toHaveLength(0);
    });

    it("fails when necessity_assessment is missing", () => {
      expect(checkDpiaNecessityComplete({})).toHaveLength(1);
    });

    it("fails when assessment_narrative is empty", () => {
      const state = {
        necessity_assessment: {
          assessment_narrative: "",
          proportionality_assessment: "valid",
        },
      };
      const f = checkDpiaNecessityComplete(state);
      expect(f.some((x) => x.details.includes("assessment_narrative"))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // dpia_every_risk_has_category_and_rights
  // -----------------------------------------------------------------------
  describe("dpia_every_risk_has_category_and_rights", () => {
    it("passes when all risks have category and rights", () => {
      const state = {
        risks: [
          {
            id: "R1",
            category: "material_damage",
            affected_rights: [{ right: "Art. 15", article: "Right of access" }],
          },
        ],
      };
      expect(checkDpiaEveryRiskHasCategoryAndRights(state)).toHaveLength(0);
    });

    it("returns empty when risks array is empty", () => {
      expect(checkDpiaEveryRiskHasCategoryAndRights({ risks: [] })).toHaveLength(0);
    });

    it("fails when category is missing", () => {
      const state = {
        risks: [{ id: "R1", affected_rights: [{ right: "Art. 15" }] }],
      };
      const f = checkDpiaEveryRiskHasCategoryAndRights(state);
      expect(f.some((x) => x.details.includes("R1") && x.details.includes("category"))).toBe(true);
    });

    it("fails when affected_rights is empty", () => {
      const state = {
        risks: [{ id: "R1", category: "material_damage", affected_rights: [] }],
      };
      const f = checkDpiaEveryRiskHasCategoryAndRights(state);
      expect(f.some((x) => x.details.includes("affected_rights"))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // dpia_unique_risk_ids
  // -----------------------------------------------------------------------
  describe("dpia_unique_risk_ids", () => {
    it("passes with unique IDs", () => {
      const state = { risks: [{ id: "R1" }, { id: "R2" }, { id: "R3" }] };
      expect(checkDpiaUniqueRiskIds(state)).toHaveLength(0);
    });

    it("fails with duplicate IDs", () => {
      const state = { risks: [{ id: "R1" }, { id: "R2" }, { id: "R1" }] };
      const f = checkDpiaUniqueRiskIds(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("R1");
    });

    it("returns empty when risks is missing", () => {
      expect(checkDpiaUniqueRiskIds({})).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // dpia_risk_analysis_references_known_risks
  // -----------------------------------------------------------------------
  describe("dpia_risk_analysis_references_known_risks", () => {
    it("passes with valid references and complete fields", () => {
      const state = {
        risks: [{ id: "R1" }, { id: "R2" }],
        risk_analysis: [
          { id: "R1", likelihood_score: 3, severity_score: 4, score: 12 },
          { id: "R2", likelihood_score: 2, severity_score: 2, score: 4 },
        ],
      };
      expect(checkDpiaRiskAnalysisReferencesKnownRisks(state)).toHaveLength(0);
    });

    it("fails with orphaned risk_analysis entry", () => {
      const state = {
        risks: [{ id: "R1" }],
        risk_analysis: [
          { id: "R1", likelihood_score: 3, severity_score: 4, score: 12 },
          { id: "R99", likelihood_score: 2, severity_score: 2, score: 4 },
        ],
      };
      const f = checkDpiaRiskAnalysisReferencesKnownRisks(state);
      expect(f.some((x) => x.details.includes("R99") && x.details.includes("does not match"))).toBe(true);
    });

    it("fails when risk_analysis entry is missing required scores", () => {
      const state = {
        risks: [{ id: "R1" }],
        risk_analysis: [{ id: "R1" }],
      };
      const f = checkDpiaRiskAnalysisReferencesKnownRisks(state);
      expect(f.some((x) => x.details.includes("likelihood_score"))).toBe(true);
      expect(f.some((x) => x.details.includes("severity_score"))).toBe(true);
      expect(f.some((x) => x.details.includes("missing score"))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // dpia_safeguards_reference_known_risks
  // -----------------------------------------------------------------------
  describe("dpia_safeguards_reference_known_risks", () => {
    it("passes with valid references and complete fields", () => {
      const state = {
        risks: [{ id: "R1" }],
        safeguards: [{ risk_id: "R1", measure: "Encryption at rest", type: "technical" }],
      };
      expect(checkDpiaSafeguardsReferenceKnownRisks(state)).toHaveLength(0);
    });

    it("fails with orphaned safeguard", () => {
      const state = {
        risks: [{ id: "R1" }],
        safeguards: [{ risk_id: "R99", measure: "Unknown", type: "technical" }],
      };
      const f = checkDpiaSafeguardsReferenceKnownRisks(state);
      expect(f.some((x) => x.details.includes("R99") && x.details.includes("unknown risk_id"))).toBe(true);
    });

    it("fails when safeguard is missing measure or type", () => {
      const state = {
        risks: [{ id: "R1" }],
        safeguards: [{ risk_id: "R1" }],
      };
      const f = checkDpiaSafeguardsReferenceKnownRisks(state);
      expect(f.some((x) => x.details.includes("missing measure"))).toBe(true);
      expect(f.some((x) => x.details.includes("missing type"))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // dpia_consultation_complete
  // -----------------------------------------------------------------------
  describe("dpia_consultation_complete", () => {
    it("passes with all required fields", () => {
      const state = {
        consultation_assessment: {
          consultation_required: false,
          consultation_basis:
            "All residual risks are Medium or below after safeguards applied per Art 36 analysis and review",
          member_state_triggers_checked: true,
        },
      };
      expect(checkDpiaConsultationComplete(state)).toHaveLength(0);
    });

    it("fails when consultation_assessment is missing", () => {
      expect(checkDpiaConsultationComplete({})).toHaveLength(1);
    });

    it("fails when consultation_basis has fewer than 10 words", () => {
      const state = {
        consultation_assessment: {
          consultation_required: false,
          consultation_basis: "Not required",
          member_state_triggers_checked: true,
        },
      };
      const f = checkDpiaConsultationComplete(state);
      expect(f.some((x) => x.details.includes("10 words"))).toBe(true);
    });

    it("fails when member_state_triggers_checked is false", () => {
      const state = {
        consultation_assessment: {
          consultation_required: false,
          consultation_basis:
            "All risks are low after safeguards. Art 36 does not require prior consultation in this case.",
          member_state_triggers_checked: false,
        },
      };
      const f = checkDpiaConsultationComplete(state);
      expect(f.some((x) => x.details.includes("member_state_triggers_checked"))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // dpia_consultation_references_residual_risks
  // -----------------------------------------------------------------------
  describe("dpia_consultation_references_residual_risks", () => {
    it("passes with valid risk references", () => {
      const state = {
        risks: [{ id: "R1" }, { id: "R2" }],
        consultation_assessment: {
          residual_high_risks: [{ risk_id: "R1", score_after: 12 }],
        },
      };
      expect(checkDpiaConsultationReferencesResidualRisks(state)).toHaveLength(0);
    });

    it("fails with unknown risk_id", () => {
      const state = {
        risks: [{ id: "R1" }],
        consultation_assessment: {
          residual_high_risks: [{ risk_id: "R99", score_after: 16 }],
        },
      };
      const f = checkDpiaConsultationReferencesResidualRisks(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("R99");
    });

    it("returns empty when no residual risks", () => {
      const state = {
        risks: [{ id: "R1" }],
        consultation_assessment: { residual_high_risks: [] },
      };
      expect(checkDpiaConsultationReferencesResidualRisks(state)).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // dpia_residual_score_coherence (warning)
  // -----------------------------------------------------------------------
  describe("dpia_residual_score_coherence", () => {
    it("passes when score_after <= score_before", () => {
      const state = {
        safeguards: [
          { risk_id: "R1", score_before: 16, score_after: 8 },
          { risk_id: "R2", score_before: 12, score_after: 12 },
        ],
      };
      expect(checkDpiaResidualScoreCoherence(state)).toHaveLength(0);
    });

    it("warns when score_after > score_before", () => {
      const state = {
        safeguards: [{ risk_id: "R1", score_before: 8, score_after: 12 }],
      };
      const f = checkDpiaResidualScoreCoherence(state);
      expect(f).toHaveLength(1);
      expect(f[0].severity).toBe("warning");
      expect(f[0].details).toContain("R1");
    });

    it("skips entries without numeric scores", () => {
      const state = {
        safeguards: [{ risk_id: "R1" }],
      };
      expect(checkDpiaResidualScoreCoherence(state)).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // dpia_risk_coverage_complete (warning)
  // -----------------------------------------------------------------------
  describe("dpia_risk_coverage_complete", () => {
    it("passes when all risks have analysis and safeguards", () => {
      const state = {
        risks: [{ id: "R1" }, { id: "R2" }],
        risk_analysis: [{ id: "R1" }, { id: "R2" }],
        safeguards: [
          { risk_id: "R1", measure: "Encryption" },
          { risk_id: "R2", measure: "Access control" },
        ],
      };
      expect(checkDpiaRiskCoverageComplete(state)).toHaveLength(0);
    });

    it("warns when risk has no analysis", () => {
      const state = {
        risks: [{ id: "R1" }, { id: "R2" }],
        risk_analysis: [{ id: "R1" }],
        safeguards: [
          { risk_id: "R1", measure: "x" },
          { risk_id: "R2", measure: "y" },
        ],
      };
      const f = checkDpiaRiskCoverageComplete(state);
      expect(f.some((x) => x.details.includes("R2") && x.details.includes("risk_analysis"))).toBe(true);
      expect(f[0].severity).toBe("warning");
    });

    it("warns when risk has no safeguard", () => {
      const state = {
        risks: [{ id: "R1" }],
        risk_analysis: [{ id: "R1" }],
        safeguards: [],
      };
      const f = checkDpiaRiskCoverageComplete(state);
      expect(f.some((x) => x.details.includes("R1") && x.details.includes("safeguard"))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Nested-path null safety
  // -----------------------------------------------------------------------
  describe("nested-path null safety", () => {
    it("all rules handle undefined/null gracefully", () => {
      const emptyState = {};
      // These should not throw — they either return failures or empty
      expect(() => checkDpiaScreeningOutcomeValid(emptyState)).not.toThrow();
      expect(() => checkDpiaProcessingDescriptionComplete(emptyState)).not.toThrow();
      expect(() => checkDpiaNecessityComplete(emptyState)).not.toThrow();
      expect(() => checkDpiaEveryRiskHasCategoryAndRights(emptyState)).not.toThrow();
      expect(() => checkDpiaUniqueRiskIds(emptyState)).not.toThrow();
      expect(() => checkDpiaRiskAnalysisReferencesKnownRisks(emptyState)).not.toThrow();
      expect(() => checkDpiaSafeguardsReferenceKnownRisks(emptyState)).not.toThrow();
      expect(() => checkDpiaConsultationComplete(emptyState)).not.toThrow();
      expect(() => checkDpiaConsultationReferencesResidualRisks(emptyState)).not.toThrow();
      expect(() => checkDpiaResidualScoreCoherence(emptyState)).not.toThrow();
      expect(() => checkDpiaRiskCoverageComplete(emptyState)).not.toThrow();
    });
  });
});
