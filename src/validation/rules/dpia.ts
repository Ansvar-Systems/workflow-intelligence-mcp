/**
 * Structural validation rules for DPIA assessment phases.
 *
 * Each rule walks nested state paths directly (e.g., state.screening?.outcome)
 * rather than relying on evaluateFieldPresence, which only supports top-level keys.
 */

import type { RuleFailure } from "../../types/validation.js";

// ---------------------------------------------------------------------------
// State interfaces
// ---------------------------------------------------------------------------

interface DpiaScreening {
  outcome?: string;
  rationale?: string;
  criteria_triggered?: unknown[];
  exemption_basis?: unknown[];
}

interface Article6Basis {
  basis?: string;
  article?: string;
  verified?: boolean;
  verification_note?: string;
}

interface LegalBasis {
  article_6_basis?: Article6Basis;
  article_9_condition?: { applies?: boolean; condition?: string; article?: string };
  article_10_basis?: { applies?: boolean; basis?: string; article?: string };
}

interface ProcessingDescription {
  data_types?: unknown[];
  data_subjects?: unknown[];
  purposes?: string[];
  legal_basis?: LegalBasis;
  processors?: unknown[];
  international_transfers?: unknown[];
  high_risk_indicators?: unknown[];
  hri_count?: number;
  recommended_scope?: string;
}

interface NecessityAssessment {
  assessment_narrative?: string;
  proportionality_assessment?: string;
  alternatives_considered?: unknown[];
  lia_assessment?: unknown;
  data_minimisation_assessment?: string;
}

interface DpiaRisk {
  id: string;
  description?: string;
  category?: string;
  affected_rights?: unknown[];
  harm_description?: string;
  data_types_affected?: string[];
}

interface RiskAnalysisEntry {
  id: string;
  likelihood_score?: number;
  severity_score?: number;
  score?: number;
  [key: string]: unknown;
}

interface SafeguardEntry {
  risk_id: string;
  measure?: string;
  type?: string;
  gdpr_article?: string;
  score_before?: number;
  score_after?: number;
  justification?: string;
  [key: string]: unknown;
}

interface ResidualHighRisk {
  risk_id: string;
  score_after?: number;
  why_still_high?: string;
}

interface ConsultationAssessment {
  consultation_required?: boolean;
  consultation_basis?: string;
  residual_high_risks?: ResidualHighRisk[];
  member_state_triggers_checked?: boolean;
  member_state_triggers?: unknown[];
  processor_compliance?: unknown[];
  transfer_compliance?: unknown[];
}

interface DpiaState {
  screening?: DpiaScreening;
  processing_description?: ProcessingDescription;
  necessity_assessment?: NecessityAssessment;
  risks?: DpiaRisk[];
  risk_analysis?: RiskAnalysisEntry[];
  safeguards?: SafeguardEntry[];
  consultation_assessment?: ConsultationAssessment;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function asDpia(state: Record<string, unknown>): DpiaState {
  return state as unknown as DpiaState;
}

function fail(rule: string, details: string): RuleFailure {
  return { rule, severity: "required", details };
}

function warn(rule: string, details: string): RuleFailure {
  return { rule, severity: "warning", details };
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export function checkDpiaScreeningOutcomeValid(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asDpia(state).screening;
  if (!s) return [fail("dpia_screening_outcome_valid", "screening is missing")];
  const failures: RuleFailure[] = [];
  const valid = ["required", "not_required", "recommended"];
  if (!s.outcome || !valid.includes(s.outcome)) {
    failures.push(
      fail(
        "dpia_screening_outcome_valid",
        `screening.outcome must be one of: ${valid.join(", ")}; got '${s.outcome ?? "undefined"}'`,
      ),
    );
  }
  if (!s.rationale || s.rationale.trim().length === 0) {
    failures.push(
      fail("dpia_screening_outcome_valid", "screening.rationale must be non-empty"),
    );
  }
  return failures;
}

export function checkDpiaProcessingDescriptionComplete(
  state: Record<string, unknown>,
): RuleFailure[] {
  const pd = asDpia(state).processing_description;
  if (!pd) {
    return [
      fail("dpia_processing_description_complete", "processing_description is missing"),
    ];
  }
  const failures: RuleFailure[] = [];
  if (!Array.isArray(pd.data_types) || pd.data_types.length === 0) {
    failures.push(
      fail(
        "dpia_processing_description_complete",
        "processing_description.data_types must have at least 1 entry",
      ),
    );
  }
  if (!Array.isArray(pd.data_subjects) || pd.data_subjects.length === 0) {
    failures.push(
      fail(
        "dpia_processing_description_complete",
        "processing_description.data_subjects must have at least 1 entry",
      ),
    );
  }
  if (!Array.isArray(pd.purposes) || pd.purposes.length === 0) {
    failures.push(
      fail(
        "dpia_processing_description_complete",
        "processing_description.purposes must have at least 1 entry",
      ),
    );
  }
  if (!pd.legal_basis?.article_6_basis) {
    failures.push(
      fail(
        "dpia_processing_description_complete",
        "processing_description.legal_basis.article_6_basis is missing",
      ),
    );
  }
  return failures;
}

export function checkDpiaNecessityComplete(
  state: Record<string, unknown>,
): RuleFailure[] {
  const na = asDpia(state).necessity_assessment;
  if (!na) {
    return [fail("dpia_necessity_complete", "necessity_assessment is missing")];
  }
  const failures: RuleFailure[] = [];
  if (!na.assessment_narrative || na.assessment_narrative.trim().length === 0) {
    failures.push(
      fail(
        "dpia_necessity_complete",
        "necessity_assessment.assessment_narrative is missing or empty",
      ),
    );
  }
  if (
    !na.proportionality_assessment ||
    na.proportionality_assessment.trim().length === 0
  ) {
    failures.push(
      fail(
        "dpia_necessity_complete",
        "necessity_assessment.proportionality_assessment is missing or empty",
      ),
    );
  }
  return failures;
}

export function checkDpiaEveryRiskHasCategoryAndRights(
  state: Record<string, unknown>,
): RuleFailure[] {
  const risks = asDpia(state).risks;
  if (!Array.isArray(risks) || risks.length === 0) return [];
  const failures: RuleFailure[] = [];
  for (const r of risks) {
    if (!r.category) {
      failures.push(
        fail(
          "dpia_every_risk_has_category_and_rights",
          `Risk '${r.id}' is missing category`,
        ),
      );
    }
    if (!Array.isArray(r.affected_rights) || r.affected_rights.length === 0) {
      failures.push(
        fail(
          "dpia_every_risk_has_category_and_rights",
          `Risk '${r.id}' is missing affected_rights`,
        ),
      );
    }
  }
  return failures;
}

export function checkDpiaUniqueRiskIds(
  state: Record<string, unknown>,
): RuleFailure[] {
  const risks = asDpia(state).risks;
  if (!Array.isArray(risks)) return [];
  const seen = new Set<string>();
  const failures: RuleFailure[] = [];
  for (const r of risks) {
    if (seen.has(r.id)) {
      failures.push(
        fail("dpia_unique_risk_ids", `Duplicate risk ID '${r.id}' found in risks[]`),
      );
    }
    seen.add(r.id);
  }
  return failures;
}

export function checkDpiaRiskAnalysisReferencesKnownRisks(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asDpia(state);
  const riskIds = new Set((s.risks ?? []).map((r) => r.id));
  const analysis = s.risk_analysis ?? [];
  if (riskIds.size === 0 || analysis.length === 0) return [];
  const failures: RuleFailure[] = [];
  for (const entry of analysis) {
    if (!riskIds.has(entry.id)) {
      failures.push(
        fail(
          "dpia_risk_analysis_references_known_risks",
          `risk_analysis entry '${entry.id}' does not match any risk in risks[]`,
        ),
      );
    }
    if (typeof entry.likelihood_score !== "number") {
      failures.push(
        fail(
          "dpia_risk_analysis_references_known_risks",
          `risk_analysis entry '${entry.id}' is missing likelihood_score`,
        ),
      );
    }
    if (typeof entry.severity_score !== "number") {
      failures.push(
        fail(
          "dpia_risk_analysis_references_known_risks",
          `risk_analysis entry '${entry.id}' is missing severity_score`,
        ),
      );
    }
    if (typeof entry.score !== "number") {
      failures.push(
        fail(
          "dpia_risk_analysis_references_known_risks",
          `risk_analysis entry '${entry.id}' is missing score`,
        ),
      );
    }
  }
  return failures;
}

export function checkDpiaSafeguardsReferenceKnownRisks(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asDpia(state);
  const riskIds = new Set((s.risks ?? []).map((r) => r.id));
  const safeguards = s.safeguards ?? [];
  if (riskIds.size === 0 || safeguards.length === 0) return [];
  const failures: RuleFailure[] = [];
  for (const sg of safeguards) {
    if (!riskIds.has(sg.risk_id)) {
      failures.push(
        fail(
          "dpia_safeguards_reference_known_risks",
          `Safeguard references unknown risk_id '${sg.risk_id}'`,
        ),
      );
    }
    if (!sg.measure) {
      failures.push(
        fail(
          "dpia_safeguards_reference_known_risks",
          `Safeguard for risk '${sg.risk_id}' is missing measure`,
        ),
      );
    }
    if (!sg.type) {
      failures.push(
        fail(
          "dpia_safeguards_reference_known_risks",
          `Safeguard for risk '${sg.risk_id}' is missing type`,
        ),
      );
    }
  }
  return failures;
}

export function checkDpiaConsultationComplete(
  state: Record<string, unknown>,
): RuleFailure[] {
  const ca = asDpia(state).consultation_assessment;
  if (!ca) {
    return [fail("dpia_consultation_complete", "consultation_assessment is missing")];
  }
  const failures: RuleFailure[] = [];
  if (ca.consultation_required === undefined || ca.consultation_required === null) {
    failures.push(
      fail(
        "dpia_consultation_complete",
        "consultation_assessment.consultation_required is missing",
      ),
    );
  }
  if (!ca.consultation_basis || ca.consultation_basis.trim().split(/\s+/).length < 10) {
    failures.push(
      fail(
        "dpia_consultation_complete",
        "consultation_assessment.consultation_basis must be at least 10 words",
      ),
    );
  }
  if (ca.member_state_triggers_checked !== true) {
    failures.push(
      fail(
        "dpia_consultation_complete",
        "consultation_assessment.member_state_triggers_checked must be true",
      ),
    );
  }
  return failures;
}

export function checkDpiaConsultationReferencesResidualRisks(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asDpia(state);
  const riskIds = new Set((s.risks ?? []).map((r) => r.id));
  const residual = s.consultation_assessment?.residual_high_risks ?? [];
  if (residual.length === 0) return [];
  const failures: RuleFailure[] = [];
  for (const rhr of residual) {
    if (!riskIds.has(rhr.risk_id)) {
      failures.push(
        fail(
          "dpia_consultation_references_residual_risks",
          `Residual risk '${rhr.risk_id}' does not match any risk in risks[]`,
        ),
      );
    }
  }
  return failures;
}

export function checkDpiaResidualScoreCoherence(
  state: Record<string, unknown>,
): RuleFailure[] {
  const safeguards = asDpia(state).safeguards ?? [];
  const failures: RuleFailure[] = [];
  for (const sg of safeguards) {
    if (
      typeof sg.score_before === "number" &&
      typeof sg.score_after === "number" &&
      sg.score_after > sg.score_before
    ) {
      failures.push(
        warn(
          "dpia_residual_score_coherence",
          `Safeguard for risk '${sg.risk_id}' has score_after (${sg.score_after}) > score_before (${sg.score_before})`,
        ),
      );
    }
  }
  return failures;
}

export function checkDpiaRiskCoverageComplete(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asDpia(state);
  const risks = s.risks ?? [];
  if (risks.length === 0) return [];
  const analysisIds = new Set((s.risk_analysis ?? []).map((e) => e.id));
  const safeguardRiskIds = new Set((s.safeguards ?? []).map((e) => e.risk_id));
  const failures: RuleFailure[] = [];
  for (const r of risks) {
    if (!analysisIds.has(r.id)) {
      failures.push(
        warn(
          "dpia_risk_coverage_complete",
          `Risk '${r.id}' has no matching risk_analysis entry`,
        ),
      );
    }
    if (!safeguardRiskIds.has(r.id)) {
      failures.push(
        warn(
          "dpia_risk_coverage_complete",
          `Risk '${r.id}' has no safeguard defined`,
        ),
      );
    }
  }
  return failures;
}
