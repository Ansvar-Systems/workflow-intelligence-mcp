/**
 * Structural validation rules for AI TARA assessment phases.
 *
 * Checks asset coverage, STRIPE-AI category coverage, MCP grounding ratio,
 * impact/feasibility completeness, risk register coherence, and treatment
 * coverage for high-risk threats.
 */

import type { RuleFailure } from "../../types/validation.js";

const AI_SPECIFIC_ASSET_CATEGORIES = [
  "training_data",
  "model_weights",
  "prompts_system_prompts",
  "rag_corpora",
  "eval_pipelines",
] as const;

const STRIPE_AI_CATEGORIES = ["S", "T", "R", "I", "P", "D", "E", "AI"] as const;

const IMPACT_DIMENSIONS = [
  "safety",
  "financial",
  "privacy",
  "operational",
  "reputational",
  "regulatory",
  "ethical",
] as const;

// ── Phase 1: System Definition ────────────────────────────────────────────────

interface Asset {
  id: string;
  category?: string;
  [key: string]: unknown;
}

interface SystemDefinitionState {
  assets?: Asset[];
  [key: string]: unknown;
}

/**
 * At least 3 assets identified for meaningful threat coverage.
 */
export function checkAiTaraMinAssets(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as SystemDefinitionState;
  const count = s.assets?.length ?? 0;
  if (count < 3) {
    return [
      {
        rule: "ai_tara_min_assets",
        severity: "required",
        details: `${count}`,
      },
    ];
  }
  return [];
}

/**
 * At least 1 AI-specific asset category must be present.
 */
export function checkAiTaraAiAssetCoverage(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as SystemDefinitionState;
  const assets = s.assets ?? [];
  const hasAiAsset = assets.some(
    (a) =>
      a.category &&
      (AI_SPECIFIC_ASSET_CATEGORIES as readonly string[]).includes(a.category),
  );
  if (!hasAiAsset) {
    const categories = AI_SPECIFIC_ASSET_CATEGORIES.join(", ");
    return [
      {
        rule: "ai_tara_ai_asset_coverage",
        severity: "required",
        details: `No assets with AI-specific categories found. Expected at least one of: ${categories}`,
      },
    ];
  }
  return [];
}

// ── Phase 2: Threat Identification ────────────────────────────────────────────

interface Threat {
  id: string;
  stripe_ai_category?: string;
  asset_id?: string;
  mcp_source?: string;
  [key: string]: unknown;
}

interface ThreatIdentificationState {
  threats?: Threat[];
  coverage_matrix?: Record<string, Record<string, boolean>>;
  [key: string]: unknown;
}

/**
 * Every asset must have all 8 STRIPE-AI categories assessed.
 */
export function checkAiTaraStripeAiCoverage(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as ThreatIdentificationState;
  const matrix = s.coverage_matrix;
  if (!matrix || typeof matrix !== "object") {
    return [
      {
        rule: "ai_tara_stripe_ai_coverage",
        severity: "required",
        details: "Coverage matrix is missing",
      },
    ];
  }

  const failures: RuleFailure[] = [];
  for (const [assetId, categories] of Object.entries(matrix)) {
    if (!categories || typeof categories !== "object") {
      failures.push({
        rule: "ai_tara_stripe_ai_coverage",
        severity: "required",
        details: `Asset '${assetId}' has invalid coverage data (expected object, got ${typeof categories})`,
      });
      continue;
    }
    const missing: string[] = [];
    for (const cat of STRIPE_AI_CATEGORIES) {
      if (!categories[cat]) {
        missing.push(cat);
      }
    }
    if (missing.length > 0) {
      failures.push({
        rule: "ai_tara_stripe_ai_coverage",
        severity: "required",
        details: `Asset '${assetId}' missing categories: ${missing.join(", ")}`,
      });
    }
  }

  // Cross-reference: every asset from system_definition must appear in matrix
  const assets = (s as Record<string, unknown>).assets;
  if (Array.isArray(assets)) {
    const matrixKeys = new Set(Object.keys(matrix));
    for (const asset of assets) {
      const assetId = (asset as Record<string, unknown>)?.id as string | undefined;
      if (assetId && !matrixKeys.has(assetId)) {
        failures.push({
          rule: "ai_tara_stripe_ai_coverage",
          severity: "required",
          details: `Asset '${assetId}' from system definition is not present in coverage_matrix`,
        });
      }
    }
  }

  return failures;
}

/**
 * No duplicate threat IDs.
 */
export function checkAiTaraNoDuplicateThreatIds(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as ThreatIdentificationState;
  const threats = s.threats ?? [];
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const t of threats) {
    if (seen.has(t.id)) {
      duplicates.push(t.id);
    }
    seen.add(t.id);
  }
  if (duplicates.length > 0) {
    return [
      {
        rule: "ai_tara_no_duplicate_threat_ids",
        severity: "required",
        details: duplicates.join(", "),
      },
    ];
  }
  return [];
}

/**
 * Threats with mcp_source 'llm-reasoned' must be less than 25% of total.
 */
export function checkAiTaraMcpGroundingRatio(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as ThreatIdentificationState;
  const threats = s.threats ?? [];
  if (threats.length === 0) return [];

  const llmReasoned = threats.filter(
    (t) => t.mcp_source === "llm-reasoned",
  ).length;
  const ratio = llmReasoned / threats.length;
  if (ratio >= 0.25) {
    return [
      {
        rule: "ai_tara_mcp_grounding_ratio",
        severity: "warning",
        details: `${llmReasoned}/${threats.length} threats (${Math.round(ratio * 100)}%) are llm-reasoned — target is < 25%`,
      },
    ];
  }
  return [];
}

/**
 * Poisoning (P) and AI-Behavior (AI) categories should each have >= 1 threat
 * targeting AI-specific assets.
 */
export function checkAiTaraAiCategoriesPopulated(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as ThreatIdentificationState;
  const threats = s.threats ?? [];
  const failures: RuleFailure[] = [];

  const pThreats = threats.filter((t) => t.stripe_ai_category === "P");
  const aiThreats = threats.filter((t) => t.stripe_ai_category === "AI");

  if (pThreats.length === 0) {
    failures.push({
      rule: "ai_tara_ai_categories_populated",
      severity: "warning",
      details:
        "No Poisoning (P) threats identified — consider data poisoning, model poisoning, and adversarial input risks",
    });
  }
  if (aiThreats.length === 0) {
    failures.push({
      rule: "ai_tara_ai_categories_populated",
      severity: "warning",
      details:
        "No AI-Behavior (AI) threats identified — consider hallucination, drift, prompt injection, and emergent behavior risks",
    });
  }
  return failures;
}

// ── Phase 3: Impact Assessment ────────────────────────────────────────────────

interface ImpactRow {
  threat_id: string;
  safety?: number;
  financial?: number;
  privacy?: number;
  operational?: number;
  reputational?: number;
  regulatory?: number;
  ethical?: number;
  aggregate_impact?: number;
  [key: string]: unknown;
}

interface ImpactAssessmentState {
  threats?: Threat[];
  impact_matrix?: ImpactRow[];
  [key: string]: unknown;
}

/**
 * Every threat from Phase 2 must have an impact assessment row.
 */
export function checkAiTaraEveryThreatHasImpact(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as ImpactAssessmentState;
  const threats = s.threats ?? [];
  const impactMatrix = s.impact_matrix ?? [];
  const assessedIds = new Set(impactMatrix.map((r) => r.threat_id));
  const missing = threats.filter((t) => !assessedIds.has(t.id)).map((t) => t.id);

  if (missing.length > 0) {
    return [
      {
        rule: "ai_tara_every_threat_has_impact",
        severity: "required",
        details: `${missing.length} threats without impact assessment: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`,
      },
    ];
  }
  return [];
}

/**
 * All 7 dimensions must have ratings (1-5) for each threat.
 */
export function checkAiTaraAllDimensionsRated(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as ImpactAssessmentState;
  const impactMatrix = s.impact_matrix ?? [];
  const failures: RuleFailure[] = [];

  for (const row of impactMatrix) {
    const missingDims: string[] = [];
    for (const dim of IMPACT_DIMENSIONS) {
      const val = row[dim];
      if (val == null || typeof val !== "number" || val < 1 || val > 5) {
        missingDims.push(dim);
      }
    }
    if (missingDims.length > 0) {
      failures.push({
        rule: "ai_tara_all_dimensions_rated",
        severity: "required",
        details: `Threat '${row.threat_id}' missing or invalid dimensions: ${missingDims.join(", ")}`,
      });
    }
  }
  return failures;
}

// ── Phase 4: Feasibility Assessment ───────────────────────────────────────────

interface FeasibilityRow {
  threat_id: string;
  elapsed_time?: number;
  specialist_expertise?: number;
  knowledge_of_target?: number;
  window_of_opportunity?: number;
  equipment?: number;
  detection_difficulty?: number;
  attack_potential_sum?: number;
  feasibility_rating?: string;
  [key: string]: unknown;
}

interface FeasibilityState {
  threats?: Threat[];
  feasibility_ratings?: FeasibilityRow[];
  [key: string]: unknown;
}

/**
 * Every threat must have a feasibility rating.
 */
export function checkAiTaraEveryThreatHasFeasibility(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as FeasibilityState;
  const threats = s.threats ?? [];
  const ratings = s.feasibility_ratings ?? [];
  const ratedIds = new Set(ratings.map((r) => r.threat_id));
  const missing = threats.filter((t) => !ratedIds.has(t.id)).map((t) => t.id);

  if (missing.length > 0) {
    return [
      {
        rule: "ai_tara_every_threat_has_feasibility",
        severity: "required",
        details: `${missing.length} threats without feasibility rating: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`,
      },
    ];
  }
  return [];
}

/**
 * attack_potential_sum must match individual factors, and feasibility_rating
 * must match sum ranges.
 */
export function checkAiTaraFeasibilitySumCoherent(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as FeasibilityState;
  const ratings = s.feasibility_ratings ?? [];
  const failures: RuleFailure[] = [];

  const ratingFromSum = (sum: number): string => {
    if (sum <= 9) return "very_high";
    if (sum <= 13) return "high";
    if (sum <= 19) return "medium";
    if (sum <= 24) return "low";
    return "very_low";
  };

  for (const r of ratings) {
    const factors = [
      r.elapsed_time ?? 0,
      r.specialist_expertise ?? 0,
      r.knowledge_of_target ?? 0,
      r.window_of_opportunity ?? 0,
      r.equipment ?? 0,
      r.detection_difficulty ?? 0,
    ];
    const expectedSum = factors.reduce((a, b) => a + b, 0);

    if (r.attack_potential_sum != null && r.attack_potential_sum !== expectedSum) {
      failures.push({
        rule: "ai_tara_feasibility_sum_coherent",
        severity: "required",
        details: `Threat '${r.threat_id}': attack_potential_sum is ${r.attack_potential_sum} but factors sum to ${expectedSum}`,
      });
    }

    const sum = r.attack_potential_sum ?? expectedSum;
    const expectedRating = ratingFromSum(sum);
    if (r.feasibility_rating && r.feasibility_rating !== expectedRating) {
      failures.push({
        rule: "ai_tara_feasibility_sum_coherent",
        severity: "required",
        details: `Threat '${r.threat_id}': feasibility_rating is '${r.feasibility_rating}' but sum ${sum} maps to '${expectedRating}'`,
      });
    }
  }
  return failures;
}

// ── Phase 5: Risk Determination ───────────────────────────────────────────────

interface RiskRegisterEntry {
  threat_id: string;
  risk_level?: string;
  treatment_required?: boolean;
  [key: string]: unknown;
}

interface RiskDeterminationState {
  threats?: Threat[];
  risk_register?: RiskRegisterEntry[];
  [key: string]: unknown;
}

/**
 * Every threat must appear in the risk register.
 */
export function checkAiTaraEveryThreatInRegister(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as RiskDeterminationState;
  const threats = s.threats ?? [];
  const register = s.risk_register ?? [];
  const registeredIds = new Set(register.map((r) => r.threat_id));
  const missing = threats.filter((t) => !registeredIds.has(t.id)).map((t) => t.id);

  if (missing.length > 0) {
    return [
      {
        rule: "ai_tara_every_threat_in_register",
        severity: "required",
        details: `${missing.length} threats not in risk register: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`,
      },
    ];
  }
  return [];
}

/**
 * Every R4 and R5 risk must have treatment_required: true.
 */
export function checkAiTaraR4R5FlaggedForTreatment(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as RiskDeterminationState;
  const register = s.risk_register ?? [];
  const unflagged = register.filter(
    (r) =>
      (r.risk_level === "R4" || r.risk_level === "R5") &&
      r.treatment_required !== true,
  );

  if (unflagged.length > 0) {
    return [
      {
        rule: "ai_tara_r4_r5_flagged_for_treatment",
        severity: "required",
        details: `${unflagged.length} R4/R5 risks not flagged for treatment: ${unflagged.map((r) => r.threat_id).join(", ")}`,
      },
    ];
  }
  return [];
}

// ── Phase 6: Risk Treatment ───────────────────────────────────────────────────

interface TreatmentEntry {
  threat_id: string;
  treatment_strategy?: string;
  controls?: Array<{ control_name?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface RiskTreatmentState {
  risk_register?: RiskRegisterEntry[];
  treatment_plan?: TreatmentEntry[];
  [key: string]: unknown;
}

/**
 * Every R4 and R5 threat must have a treatment plan entry.
 * Accept is allowed only if rationale is provided.
 */
export function checkAiTaraHighRiskThreatsTreated(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as RiskTreatmentState;
  const register = s.risk_register ?? [];
  const plan = s.treatment_plan ?? [];
  const treatedIds = new Set(plan.map((t) => t.threat_id));
  const highRisks = register.filter(
    (r) => r.risk_level === "R4" || r.risk_level === "R5",
  );
  const untreated = highRisks.filter((r) => !treatedIds.has(r.threat_id));

  if (untreated.length > 0) {
    return [
      {
        rule: "ai_tara_high_risk_threats_treated",
        severity: "required",
        details: `${untreated.length} R4/R5 threats without treatment: ${untreated.map((r) => r.threat_id).join(", ")}`,
      },
    ];
  }
  return [];
}

/**
 * Every treatment with strategy 'reduce' must have at least 1 control.
 */
export function checkAiTaraReduceHasControls(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = state as unknown as RiskTreatmentState;
  const plan = s.treatment_plan ?? [];
  const failures: RuleFailure[] = [];

  for (const entry of plan) {
    if (
      entry.treatment_strategy === "reduce" &&
      (!entry.controls || entry.controls.length === 0)
    ) {
      failures.push({
        rule: "ai_tara_reduce_has_controls",
        severity: "required",
        details: `Threat '${entry.threat_id}' has 'reduce' strategy but no controls specified`,
      });
    }
  }
  return failures;
}
