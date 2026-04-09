import { describe, it, expect } from "vitest";
import {
  checkAiTaraMinAssets,
  checkAiTaraAiAssetCoverage,
  checkAiTaraStripeAiCoverage,
  checkAiTaraNoDuplicateThreatIds,
  checkAiTaraMcpGroundingRatio,
  checkAiTaraAiCategoriesPopulated,
  checkAiTaraEveryThreatHasImpact,
  checkAiTaraAllDimensionsRated,
  checkAiTaraEveryThreatHasFeasibility,
  checkAiTaraFeasibilitySumCoherent,
  checkAiTaraEveryThreatInRegister,
  checkAiTaraR4R5FlaggedForTreatment,
  checkAiTaraHighRiskThreatsTreated,
  checkAiTaraReduceHasControls,
} from "../../src/validation/rules/ai-tara.js";

describe("AI TARA validation rules", () => {
  // ── Phase 1: System Definition ──────────────────────────────────────────────

  describe("checkAiTaraMinAssets", () => {
    it("passes with 3 assets", () => {
      const state = {
        assets: [
          { id: "a1" },
          { id: "a2" },
          { id: "a3" },
        ],
      };
      expect(checkAiTaraMinAssets(state)).toHaveLength(0);
    });

    it("passes with more than 3 assets", () => {
      const state = {
        assets: [{ id: "a1" }, { id: "a2" }, { id: "a3" }, { id: "a4" }],
      };
      expect(checkAiTaraMinAssets(state)).toHaveLength(0);
    });

    it("fails with 2 assets", () => {
      const state = { assets: [{ id: "a1" }, { id: "a2" }] };
      const f = checkAiTaraMinAssets(state);
      expect(f).toHaveLength(1);
      expect(f[0].rule).toBe("ai_tara_min_assets");
      expect(f[0].severity).toBe("required");
      expect(f[0].details).toBe("2");
    });

    it("fails with empty assets", () => {
      const f = checkAiTaraMinAssets({ assets: [] });
      expect(f).toHaveLength(1);
      expect(f[0].details).toBe("0");
    });

    it("fails when assets is missing", () => {
      const f = checkAiTaraMinAssets({});
      expect(f).toHaveLength(1);
      expect(f[0].details).toBe("0");
    });
  });

  describe("checkAiTaraAiAssetCoverage", () => {
    it("passes with one AI-specific asset category", () => {
      const state = {
        assets: [
          { id: "a1", category: "training_data" },
          { id: "a2", category: "network" },
        ],
      };
      expect(checkAiTaraAiAssetCoverage(state)).toHaveLength(0);
    });

    it.each([
      "training_data",
      "model_weights",
      "prompts_system_prompts",
      "rag_corpora",
      "eval_pipelines",
    ])("passes with AI category '%s'", (category) => {
      const state = { assets: [{ id: "a1", category }] };
      expect(checkAiTaraAiAssetCoverage(state)).toHaveLength(0);
    });

    it("fails when no AI-specific category is present", () => {
      const state = {
        assets: [
          { id: "a1", category: "network" },
          { id: "a2", category: "database" },
        ],
      };
      const f = checkAiTaraAiAssetCoverage(state);
      expect(f).toHaveLength(1);
      expect(f[0].rule).toBe("ai_tara_ai_asset_coverage");
      expect(f[0].severity).toBe("required");
      expect(f[0].details).toContain("training_data");
    });

    it("fails when assets have no category", () => {
      const state = { assets: [{ id: "a1" }, { id: "a2" }] };
      const f = checkAiTaraAiAssetCoverage(state);
      expect(f).toHaveLength(1);
    });

    it("fails when assets is empty", () => {
      expect(checkAiTaraAiAssetCoverage({ assets: [] })).toHaveLength(1);
    });

    it("fails when assets is missing", () => {
      expect(checkAiTaraAiAssetCoverage({})).toHaveLength(1);
    });
  });

  // ── Phase 2: Threat Identification ──────────────────────────────────────────

  describe("checkAiTaraStripeAiCoverage", () => {
    it("passes when all assets have all 8 categories", () => {
      const state = {
        coverage_matrix: {
          asset1: { S: true, T: true, R: true, I: true, P: true, D: true, E: true, AI: true },
          asset2: { S: true, T: true, R: true, I: true, P: true, D: true, E: true, AI: true },
        },
      };
      expect(checkAiTaraStripeAiCoverage(state)).toHaveLength(0);
    });

    it("should require D (Denial of Service) category in coverage matrix", () => {
      const state = {
        coverage_matrix: {
          asset_1: { S: true, T: true, R: true, I: true, P: true, E: true, AI: true },
        },
      };
      const failures = checkAiTaraStripeAiCoverage(state);
      expect(failures.length).toBe(1);
      expect(failures[0].details).toContain("D");
    });

    it("should pass when all 8 categories are present", () => {
      const state = {
        coverage_matrix: {
          asset_1: { S: true, T: true, R: true, I: true, P: true, D: true, E: true, AI: true },
        },
      };
      const failures = checkAiTaraStripeAiCoverage(state);
      expect(failures.length).toBe(0);
    });

    it("fails when an asset is missing categories", () => {
      const state = {
        coverage_matrix: {
          asset1: { S: true, T: true, R: true, I: true, P: true, D: true, E: true, AI: true },
          asset2: { S: true, T: true },
        },
      };
      const f = checkAiTaraStripeAiCoverage(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("asset2");
      expect(f[0].details).toContain("R");
      expect(f[0].details).toContain("AI");
    });

    it("fails when coverage_matrix is missing", () => {
      const f = checkAiTaraStripeAiCoverage({});
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("missing");
    });

    it("fails when asset has invalid coverage data", () => {
      const state = { coverage_matrix: { asset1: null } };
      const f = checkAiTaraStripeAiCoverage(state as any);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("asset1");
      expect(f[0].details).toContain("invalid");
    });

    it("treats false values as missing", () => {
      const state = {
        coverage_matrix: {
          asset1: { S: true, T: true, R: true, I: true, P: true, D: true, E: true, AI: false },
        },
      };
      const f = checkAiTaraStripeAiCoverage(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("AI");
    });
  });

  describe("checkAiTaraNoDuplicateThreatIds", () => {
    it("passes with unique IDs", () => {
      const state = {
        threats: [{ id: "T1" }, { id: "T2" }, { id: "T3" }],
      };
      expect(checkAiTaraNoDuplicateThreatIds(state)).toHaveLength(0);
    });

    it("fails with duplicate IDs", () => {
      const state = {
        threats: [{ id: "T1" }, { id: "T2" }, { id: "T1" }],
      };
      const f = checkAiTaraNoDuplicateThreatIds(state);
      expect(f).toHaveLength(1);
      expect(f[0].rule).toBe("ai_tara_no_duplicate_threat_ids");
      expect(f[0].details).toContain("T1");
    });

    it("reports multiple duplicates in one failure", () => {
      const state = {
        threats: [{ id: "T1" }, { id: "T2" }, { id: "T1" }, { id: "T2" }],
      };
      const f = checkAiTaraNoDuplicateThreatIds(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("T1");
      expect(f[0].details).toContain("T2");
    });

    it("returns empty when threats is missing", () => {
      expect(checkAiTaraNoDuplicateThreatIds({})).toHaveLength(0);
    });

    it("returns empty when threats is empty", () => {
      expect(checkAiTaraNoDuplicateThreatIds({ threats: [] })).toHaveLength(0);
    });
  });

  describe("checkAiTaraMcpGroundingRatio", () => {
    it("passes when llm-reasoned is below 25%", () => {
      const state = {
        threats: [
          { id: "T1", mcp_source: "mcp-grounded" },
          { id: "T2", mcp_source: "mcp-grounded" },
          { id: "T3", mcp_source: "mcp-grounded" },
          { id: "T4", mcp_source: "mcp-grounded" },
          { id: "T5", mcp_source: "llm-reasoned" },
        ],
      };
      expect(checkAiTaraMcpGroundingRatio(state)).toHaveLength(0);
    });

    it("fails when llm-reasoned is 25% or more", () => {
      const state = {
        threats: [
          { id: "T1", mcp_source: "mcp-grounded" },
          { id: "T2", mcp_source: "mcp-grounded" },
          { id: "T3", mcp_source: "llm-reasoned" },
          { id: "T4", mcp_source: "llm-reasoned" },
        ],
      };
      const f = checkAiTaraMcpGroundingRatio(state);
      expect(f).toHaveLength(1);
      expect(f[0].rule).toBe("ai_tara_mcp_grounding_ratio");
      expect(f[0].severity).toBe("warning");
      expect(f[0].details).toContain("50%");
    });

    it("fails when exactly 25%", () => {
      const state = {
        threats: [
          { id: "T1", mcp_source: "mcp-grounded" },
          { id: "T2", mcp_source: "mcp-grounded" },
          { id: "T3", mcp_source: "mcp-grounded" },
          { id: "T4", mcp_source: "llm-reasoned" },
        ],
      };
      // 1/4 = 25% — the check is >= 0.25, so this should pass (exactly 25% fails)
      const f = checkAiTaraMcpGroundingRatio(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("25%");
    });

    it("returns empty when threats is empty", () => {
      expect(checkAiTaraMcpGroundingRatio({ threats: [] })).toHaveLength(0);
    });

    it("returns empty when threats is missing", () => {
      expect(checkAiTaraMcpGroundingRatio({})).toHaveLength(0);
    });

    it("passes when all threats are mcp-grounded", () => {
      const state = {
        threats: [
          { id: "T1", mcp_source: "mcp-grounded" },
          { id: "T2", mcp_source: "mcp-grounded" },
        ],
      };
      expect(checkAiTaraMcpGroundingRatio(state)).toHaveLength(0);
    });
  });

  describe("checkAiTaraAiCategoriesPopulated", () => {
    it("passes when both P and AI categories have threats", () => {
      const state = {
        threats: [
          { id: "T1", stripe_ai_category: "P" },
          { id: "T2", stripe_ai_category: "AI" },
          { id: "T3", stripe_ai_category: "S" },
        ],
      };
      expect(checkAiTaraAiCategoriesPopulated(state)).toHaveLength(0);
    });

    it("warns when P category is missing", () => {
      const state = {
        threats: [
          { id: "T1", stripe_ai_category: "AI" },
          { id: "T2", stripe_ai_category: "S" },
        ],
      };
      const f = checkAiTaraAiCategoriesPopulated(state);
      expect(f).toHaveLength(1);
      expect(f[0].severity).toBe("warning");
      expect(f[0].details).toContain("Poisoning");
    });

    it("warns when AI category is missing", () => {
      const state = {
        threats: [
          { id: "T1", stripe_ai_category: "P" },
          { id: "T2", stripe_ai_category: "S" },
        ],
      };
      const f = checkAiTaraAiCategoriesPopulated(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("AI-Behavior");
    });

    it("warns twice when both P and AI are missing", () => {
      const state = {
        threats: [
          { id: "T1", stripe_ai_category: "S" },
          { id: "T2", stripe_ai_category: "T" },
        ],
      };
      const f = checkAiTaraAiCategoriesPopulated(state);
      expect(f).toHaveLength(2);
    });

    it("returns two warnings when threats is empty", () => {
      const f = checkAiTaraAiCategoriesPopulated({ threats: [] });
      expect(f).toHaveLength(2);
    });

    it("returns two warnings when threats is missing", () => {
      const f = checkAiTaraAiCategoriesPopulated({});
      expect(f).toHaveLength(2);
    });
  });

  // ── Phase 3: Impact Assessment ──────────────────────────────────────────────

  describe("checkAiTaraEveryThreatHasImpact", () => {
    it("passes when all threats have impact rows", () => {
      const state = {
        threats: [{ id: "T1" }, { id: "T2" }],
        impact_matrix: [
          { threat_id: "T1" },
          { threat_id: "T2" },
        ],
      };
      expect(checkAiTaraEveryThreatHasImpact(state)).toHaveLength(0);
    });

    it("fails when a threat is missing from impact_matrix", () => {
      const state = {
        threats: [{ id: "T1" }, { id: "T2" }, { id: "T3" }],
        impact_matrix: [{ threat_id: "T1" }],
      };
      const f = checkAiTaraEveryThreatHasImpact(state);
      expect(f).toHaveLength(1);
      expect(f[0].rule).toBe("ai_tara_every_threat_has_impact");
      expect(f[0].details).toContain("2 threats");
      expect(f[0].details).toContain("T2");
      expect(f[0].details).toContain("T3");
    });

    it("truncates details after 5 missing threats", () => {
      const state = {
        threats: Array.from({ length: 7 }, (_, i) => ({ id: `T${i + 1}` })),
        impact_matrix: [],
      };
      const f = checkAiTaraEveryThreatHasImpact(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("...");
    });

    it("returns empty when threats is missing", () => {
      expect(checkAiTaraEveryThreatHasImpact({})).toHaveLength(0);
    });

    it("returns empty when both are empty", () => {
      expect(checkAiTaraEveryThreatHasImpact({ threats: [], impact_matrix: [] })).toHaveLength(0);
    });
  });

  describe("checkAiTaraAllDimensionsRated", () => {
    it("passes when all 7 dimensions are rated 1-5", () => {
      const state = {
        impact_matrix: [
          {
            threat_id: "T1",
            safety: 3,
            financial: 2,
            privacy: 4,
            operational: 1,
            reputational: 5,
            regulatory: 3,
            ethical: 2,
          },
        ],
      };
      expect(checkAiTaraAllDimensionsRated(state)).toHaveLength(0);
    });

    it("fails when a dimension is missing", () => {
      const state = {
        impact_matrix: [
          {
            threat_id: "T1",
            safety: 3,
            financial: 2,
            privacy: 4,
            operational: 1,
            reputational: 5,
            regulatory: 3,
          },
        ],
      };
      const f = checkAiTaraAllDimensionsRated(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("ethical");
    });

    it("fails when a dimension is out of range", () => {
      const state = {
        impact_matrix: [
          {
            threat_id: "T1",
            safety: 0,
            financial: 6,
            privacy: 4,
            operational: 1,
            reputational: 5,
            regulatory: 3,
            ethical: 2,
          },
        ],
      };
      const f = checkAiTaraAllDimensionsRated(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("safety");
      expect(f[0].details).toContain("financial");
    });

    it("fails when a dimension is not a number", () => {
      const state = {
        impact_matrix: [
          {
            threat_id: "T1",
            safety: "high",
            financial: 2,
            privacy: 4,
            operational: 1,
            reputational: 5,
            regulatory: 3,
            ethical: 2,
          },
        ],
      };
      const f = checkAiTaraAllDimensionsRated(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("safety");
    });

    it("reports failures per row", () => {
      const state = {
        impact_matrix: [
          { threat_id: "T1", safety: 3, financial: 2, privacy: 4, operational: 1, reputational: 5, regulatory: 3, ethical: 2 },
          { threat_id: "T2" },
        ],
      };
      const f = checkAiTaraAllDimensionsRated(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("T2");
    });

    it("returns empty when impact_matrix is missing", () => {
      expect(checkAiTaraAllDimensionsRated({})).toHaveLength(0);
    });

    it("returns empty when impact_matrix is empty", () => {
      expect(checkAiTaraAllDimensionsRated({ impact_matrix: [] })).toHaveLength(0);
    });
  });

  // ── Phase 4: Feasibility Assessment ─────────────────────────────────────────

  describe("checkAiTaraEveryThreatHasFeasibility", () => {
    it("passes when all threats have feasibility ratings", () => {
      const state = {
        threats: [{ id: "T1" }, { id: "T2" }],
        feasibility_ratings: [
          { threat_id: "T1" },
          { threat_id: "T2" },
        ],
      };
      expect(checkAiTaraEveryThreatHasFeasibility(state)).toHaveLength(0);
    });

    it("fails when a threat is missing feasibility", () => {
      const state = {
        threats: [{ id: "T1" }, { id: "T2" }],
        feasibility_ratings: [{ threat_id: "T1" }],
      };
      const f = checkAiTaraEveryThreatHasFeasibility(state);
      expect(f).toHaveLength(1);
      expect(f[0].rule).toBe("ai_tara_every_threat_has_feasibility");
      expect(f[0].details).toContain("T2");
    });

    it("truncates after 5 missing threats", () => {
      const state = {
        threats: Array.from({ length: 8 }, (_, i) => ({ id: `T${i + 1}` })),
        feasibility_ratings: [],
      };
      const f = checkAiTaraEveryThreatHasFeasibility(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("...");
    });

    it("returns empty when threats is missing", () => {
      expect(checkAiTaraEveryThreatHasFeasibility({})).toHaveLength(0);
    });
  });

  describe("checkAiTaraFeasibilitySumCoherent", () => {
    it("passes when sum matches factors and rating matches sum range", () => {
      const state = {
        feasibility_ratings: [
          {
            threat_id: "T1",
            elapsed_time: 1,
            specialist_expertise: 2,
            knowledge_of_target: 1,
            window_of_opportunity: 3,
            equipment: 1,
            detection_difficulty: 1,
            attack_potential_sum: 9,
            feasibility_rating: "very_high",
          },
        ],
      };
      expect(checkAiTaraFeasibilitySumCoherent(state)).toHaveLength(0);
    });

    it("fails when attack_potential_sum does not match factor sum", () => {
      const state = {
        feasibility_ratings: [
          {
            threat_id: "T1",
            elapsed_time: 1,
            specialist_expertise: 2,
            knowledge_of_target: 1,
            window_of_opportunity: 3,
            equipment: 1,
            detection_difficulty: 1,
            attack_potential_sum: 15,
            feasibility_rating: "very_high",
          },
        ],
      };
      const f = checkAiTaraFeasibilitySumCoherent(state);
      expect(f.some((r) => r.details.includes("attack_potential_sum is 15") && r.details.includes("sum to 9"))).toBe(true);
    });

    it("fails when feasibility_rating does not match sum range", () => {
      const state = {
        feasibility_ratings: [
          {
            threat_id: "T1",
            elapsed_time: 5,
            specialist_expertise: 5,
            knowledge_of_target: 5,
            window_of_opportunity: 5,
            equipment: 5,
            detection_difficulty: 5,
            attack_potential_sum: 30,
            feasibility_rating: "very_high",
          },
        ],
      };
      const f = checkAiTaraFeasibilitySumCoherent(state);
      expect(f.some((r) => r.details.includes("'very_high'") && r.details.includes("'very_low'"))).toBe(true);
    });

    it.each([
      { sum: 0, expected: "very_high" },
      { sum: 9, expected: "very_high" },
      { sum: 10, expected: "high" },
      { sum: 13, expected: "high" },
      { sum: 14, expected: "medium" },
      { sum: 19, expected: "medium" },
      { sum: 20, expected: "low" },
      { sum: 24, expected: "low" },
      { sum: 25, expected: "very_low" },
      { sum: 40, expected: "very_low" },
    ])("accepts correct rating '$expected' for sum $sum", ({ sum, expected }) => {
      const state = {
        feasibility_ratings: [
          {
            threat_id: "T1",
            elapsed_time: sum,
            specialist_expertise: 0,
            knowledge_of_target: 0,
            window_of_opportunity: 0,
            equipment: 0,
            detection_difficulty: 0,
            attack_potential_sum: sum,
            feasibility_rating: expected,
          },
        ],
      };
      expect(checkAiTaraFeasibilitySumCoherent(state)).toHaveLength(0);
    });

    it("skips sum check when attack_potential_sum is null", () => {
      const state = {
        feasibility_ratings: [
          {
            threat_id: "T1",
            elapsed_time: 2,
            specialist_expertise: 2,
            knowledge_of_target: 2,
            window_of_opportunity: 2,
            equipment: 2,
            detection_difficulty: 2,
            feasibility_rating: "high",
          },
        ],
      };
      expect(checkAiTaraFeasibilitySumCoherent(state)).toHaveLength(0);
    });

    it("uses factor sum for rating check when attack_potential_sum is null", () => {
      const state = {
        feasibility_ratings: [
          {
            threat_id: "T1",
            elapsed_time: 2,
            specialist_expertise: 2,
            knowledge_of_target: 2,
            window_of_opportunity: 2,
            equipment: 2,
            detection_difficulty: 2,
            feasibility_rating: "very_high",
          },
        ],
      };
      const f = checkAiTaraFeasibilitySumCoherent(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("'very_high'");
      expect(f[0].details).toContain("'high'");
    });

    it("returns empty when feasibility_ratings is missing", () => {
      expect(checkAiTaraFeasibilitySumCoherent({})).toHaveLength(0);
    });

    it("treats missing factors as 0", () => {
      const state = {
        feasibility_ratings: [
          {
            threat_id: "T1",
            elapsed_time: 5,
            attack_potential_sum: 5,
            feasibility_rating: "very_high",
          },
        ],
      };
      expect(checkAiTaraFeasibilitySumCoherent(state)).toHaveLength(0);
    });
  });

  // ── Phase 5: Risk Determination ─────────────────────────────────────────────

  describe("checkAiTaraEveryThreatInRegister", () => {
    it("passes when all threats are in the register", () => {
      const state = {
        threats: [{ id: "T1" }, { id: "T2" }],
        risk_register: [
          { threat_id: "T1", risk_level: "R3" },
          { threat_id: "T2", risk_level: "R2" },
        ],
      };
      expect(checkAiTaraEveryThreatInRegister(state)).toHaveLength(0);
    });

    it("fails when a threat is missing from the register", () => {
      const state = {
        threats: [{ id: "T1" }, { id: "T2" }, { id: "T3" }],
        risk_register: [{ threat_id: "T1", risk_level: "R3" }],
      };
      const f = checkAiTaraEveryThreatInRegister(state);
      expect(f).toHaveLength(1);
      expect(f[0].rule).toBe("ai_tara_every_threat_in_register");
      expect(f[0].details).toContain("T2");
      expect(f[0].details).toContain("T3");
    });

    it("truncates after 5 missing", () => {
      const state = {
        threats: Array.from({ length: 7 }, (_, i) => ({ id: `T${i + 1}` })),
        risk_register: [],
      };
      const f = checkAiTaraEveryThreatInRegister(state);
      expect(f[0].details).toContain("...");
    });

    it("returns empty when threats is missing", () => {
      expect(checkAiTaraEveryThreatInRegister({})).toHaveLength(0);
    });
  });

  describe("checkAiTaraR4R5FlaggedForTreatment", () => {
    it("passes when all R4/R5 risks have treatment_required true", () => {
      const state = {
        risk_register: [
          { threat_id: "T1", risk_level: "R4", treatment_required: true },
          { threat_id: "T2", risk_level: "R5", treatment_required: true },
          { threat_id: "T3", risk_level: "R3", treatment_required: false },
        ],
      };
      expect(checkAiTaraR4R5FlaggedForTreatment(state)).toHaveLength(0);
    });

    it("fails when R4 risk lacks treatment_required", () => {
      const state = {
        risk_register: [
          { threat_id: "T1", risk_level: "R4", treatment_required: false },
        ],
      };
      const f = checkAiTaraR4R5FlaggedForTreatment(state);
      expect(f).toHaveLength(1);
      expect(f[0].rule).toBe("ai_tara_r4_r5_flagged_for_treatment");
      expect(f[0].details).toContain("T1");
    });

    it("fails when R5 risk has treatment_required undefined", () => {
      const state = {
        risk_register: [
          { threat_id: "T1", risk_level: "R5" },
        ],
      };
      const f = checkAiTaraR4R5FlaggedForTreatment(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("T1");
    });

    it("ignores R1-R3 risks without treatment_required", () => {
      const state = {
        risk_register: [
          { threat_id: "T1", risk_level: "R1" },
          { threat_id: "T2", risk_level: "R2" },
          { threat_id: "T3", risk_level: "R3" },
        ],
      };
      expect(checkAiTaraR4R5FlaggedForTreatment(state)).toHaveLength(0);
    });

    it("returns empty when risk_register is missing", () => {
      expect(checkAiTaraR4R5FlaggedForTreatment({})).toHaveLength(0);
    });
  });

  // ── Phase 6: Risk Treatment ─────────────────────────────────────────────────

  describe("checkAiTaraHighRiskThreatsTreated", () => {
    it("passes when all R4/R5 threats have treatment plan entries", () => {
      const state = {
        risk_register: [
          { threat_id: "T1", risk_level: "R4" },
          { threat_id: "T2", risk_level: "R5" },
          { threat_id: "T3", risk_level: "R2" },
        ],
        treatment_plan: [
          { threat_id: "T1", treatment_strategy: "reduce" },
          { threat_id: "T2", treatment_strategy: "transfer" },
        ],
      };
      expect(checkAiTaraHighRiskThreatsTreated(state)).toHaveLength(0);
    });

    it("fails when an R4 threat is missing from treatment_plan", () => {
      const state = {
        risk_register: [
          { threat_id: "T1", risk_level: "R4" },
          { threat_id: "T2", risk_level: "R5" },
        ],
        treatment_plan: [
          { threat_id: "T2", treatment_strategy: "reduce" },
        ],
      };
      const f = checkAiTaraHighRiskThreatsTreated(state);
      expect(f).toHaveLength(1);
      expect(f[0].rule).toBe("ai_tara_high_risk_threats_treated");
      expect(f[0].details).toContain("T1");
    });

    it("ignores non-R4/R5 threats without treatment", () => {
      const state = {
        risk_register: [
          { threat_id: "T1", risk_level: "R1" },
          { threat_id: "T2", risk_level: "R3" },
        ],
        treatment_plan: [],
      };
      expect(checkAiTaraHighRiskThreatsTreated(state)).toHaveLength(0);
    });

    it("returns empty when risk_register is missing", () => {
      expect(checkAiTaraHighRiskThreatsTreated({})).toHaveLength(0);
    });

    it("returns empty when treatment_plan is missing but no R4/R5 risks", () => {
      const state = {
        risk_register: [
          { threat_id: "T1", risk_level: "R2" },
        ],
      };
      expect(checkAiTaraHighRiskThreatsTreated(state)).toHaveLength(0);
    });
  });

  describe("checkAiTaraReduceHasControls", () => {
    it("passes when reduce entries have controls", () => {
      const state = {
        treatment_plan: [
          {
            threat_id: "T1",
            treatment_strategy: "reduce",
            controls: [{ control_name: "WAF" }],
          },
          {
            threat_id: "T2",
            treatment_strategy: "transfer",
          },
        ],
      };
      expect(checkAiTaraReduceHasControls(state)).toHaveLength(0);
    });

    it("fails when reduce entry has empty controls", () => {
      const state = {
        treatment_plan: [
          {
            threat_id: "T1",
            treatment_strategy: "reduce",
            controls: [],
          },
        ],
      };
      const f = checkAiTaraReduceHasControls(state);
      expect(f).toHaveLength(1);
      expect(f[0].rule).toBe("ai_tara_reduce_has_controls");
      expect(f[0].details).toContain("T1");
    });

    it("fails when reduce entry has no controls property", () => {
      const state = {
        treatment_plan: [
          {
            threat_id: "T1",
            treatment_strategy: "reduce",
          },
        ],
      };
      const f = checkAiTaraReduceHasControls(state);
      expect(f).toHaveLength(1);
      expect(f[0].details).toContain("T1");
    });

    it("does not flag non-reduce strategies without controls", () => {
      const state = {
        treatment_plan: [
          { threat_id: "T1", treatment_strategy: "accept" },
          { threat_id: "T2", treatment_strategy: "transfer" },
          { threat_id: "T3", treatment_strategy: "avoid" },
        ],
      };
      expect(checkAiTaraReduceHasControls(state)).toHaveLength(0);
    });

    it("reports per-entry failures", () => {
      const state = {
        treatment_plan: [
          { threat_id: "T1", treatment_strategy: "reduce" },
          { threat_id: "T2", treatment_strategy: "reduce", controls: [] },
        ],
      };
      const f = checkAiTaraReduceHasControls(state);
      expect(f).toHaveLength(2);
    });

    it("returns empty when treatment_plan is missing", () => {
      expect(checkAiTaraReduceHasControls({})).toHaveLength(0);
    });

    it("returns empty when treatment_plan is empty", () => {
      expect(checkAiTaraReduceHasControls({ treatment_plan: [] })).toHaveLength(0);
    });
  });

  // ── Phase 2: Coverage cross-reference ──────────────────────────────────────

  describe("checkAiTaraStripeAiCoverage cross-reference", () => {
    it("should fail when an asset from assets array is missing from coverage_matrix", () => {
      const state = {
        assets: [
          { id: "model_weights" },
          { id: "training_data" },
          { id: "rag_corpora" },
        ],
        coverage_matrix: {
          model_weights: { S: true, T: true, R: true, I: true, P: true, D: true, E: true, AI: true },
          training_data: { S: true, T: true, R: true, I: true, P: true, D: true, E: true, AI: true },
          // rag_corpora missing entirely
        },
      };
      const failures = checkAiTaraStripeAiCoverage(state);
      expect(failures.some((f) => f.details.includes("rag_corpora"))).toBe(true);
    });

    it("should pass when all assets are present in coverage_matrix with all 8 categories", () => {
      const allCats = { S: true, T: true, R: true, I: true, P: true, D: true, E: true, AI: true };
      const state = {
        assets: [{ id: "a1" }, { id: "a2" }],
        coverage_matrix: { a1: allCats, a2: allCats },
      };
      const failures = checkAiTaraStripeAiCoverage(state);
      expect(failures.length).toBe(0);
    });

    it("should pass when assets array is absent (no cross-reference check)", () => {
      const state = {
        coverage_matrix: {
          asset1: { S: true, T: true, R: true, I: true, P: true, D: true, E: true, AI: true },
        },
      };
      expect(checkAiTaraStripeAiCoverage(state)).toHaveLength(0);
    });

    it("should report each missing asset separately", () => {
      const allCats = { S: true, T: true, R: true, I: true, P: true, D: true, E: true, AI: true };
      const state = {
        assets: [{ id: "asset_a" }, { id: "asset_b" }, { id: "asset_c" }],
        coverage_matrix: { asset_a: allCats },
      };
      const failures = checkAiTaraStripeAiCoverage(state);
      expect(failures.some((f) => f.details.includes("asset_b"))).toBe(true);
      expect(failures.some((f) => f.details.includes("asset_c"))).toBe(true);
    });
  });

  // ── Null safety ─────────────────────────────────────────────────────────────

  describe("null safety", () => {
    it("all rules handle empty state without throwing", () => {
      const empty = {};
      expect(() => checkAiTaraMinAssets(empty)).not.toThrow();
      expect(() => checkAiTaraAiAssetCoverage(empty)).not.toThrow();
      expect(() => checkAiTaraStripeAiCoverage(empty)).not.toThrow();
      expect(() => checkAiTaraNoDuplicateThreatIds(empty)).not.toThrow();
      expect(() => checkAiTaraMcpGroundingRatio(empty)).not.toThrow();
      expect(() => checkAiTaraAiCategoriesPopulated(empty)).not.toThrow();
      expect(() => checkAiTaraEveryThreatHasImpact(empty)).not.toThrow();
      expect(() => checkAiTaraAllDimensionsRated(empty)).not.toThrow();
      expect(() => checkAiTaraEveryThreatHasFeasibility(empty)).not.toThrow();
      expect(() => checkAiTaraFeasibilitySumCoherent(empty)).not.toThrow();
      expect(() => checkAiTaraEveryThreatInRegister(empty)).not.toThrow();
      expect(() => checkAiTaraR4R5FlaggedForTreatment(empty)).not.toThrow();
      expect(() => checkAiTaraHighRiskThreatsTreated(empty)).not.toThrow();
      expect(() => checkAiTaraReduceHasControls(empty)).not.toThrow();
    });
  });
});
