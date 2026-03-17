/**
 * Structural validation rules for TPRM (Third-Party Risk Management) assessments.
 *
 * Assessment rules operate on `findings_register` with verdict values:
 * adequate / partially_adequate / inadequate / not_addressed.
 *
 * Triage rules validate vendor_profile, risk_classification, and
 * recommendation nested fields.
 */

import type { RuleFailure } from "../../types/validation.js";

// ---------------------------------------------------------------------------
// State interfaces
// ---------------------------------------------------------------------------

interface EvidenceRef {
  doc_id?: string;
  section_ref?: string;
  verbatim_quote?: string;
}

interface FindingsRegisterEntry {
  finding_id: string;
  verdict: string;
  evidence_refs?: EvidenceRef[];
  gap_description?: string;
  remediation_requirement?: string;
  source_kind?: string;
  source_ref?: string;
}

interface VendorProfile {
  name?: string;
  lei_status?: string;
  sanctions_status?: string;
}

interface RiskClassification {
  tier?: string;
  rationale?: string;
}

interface Recommendation {
  decision?: string;
  rationale?: string;
  conditions?: unknown[];
  blocking_findings?: unknown[];
}

interface TprmState {
  findings_register?: FindingsRegisterEntry[];
  vendor_profile?: VendorProfile;
  risk_classification?: RiskClassification;
  recommendation?: Recommendation;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asTprm(state: Record<string, unknown>): TprmState {
  return state as unknown as TprmState;
}

function fail(rule: string, details: string): RuleFailure {
  return { rule, severity: "required", details };
}

// ---------------------------------------------------------------------------
// Assessment rules (operate on findings_register)
// ---------------------------------------------------------------------------

/**
 * Adequate verdict must have evidence_refs with at least one verbatim_quote.
 */
export function checkAdequateHasEvidence(
  state: Record<string, unknown>,
): RuleFailure[] {
  const findings = asTprm(state).findings_register;
  if (!Array.isArray(findings) || findings.length === 0) return [];

  const failures: RuleFailure[] = [];
  for (const f of findings) {
    if (f.verdict !== "adequate") continue;

    if (!Array.isArray(f.evidence_refs) || f.evidence_refs.length === 0) {
      failures.push(
        fail(
          "adequate_has_evidence",
          `Finding '${f.finding_id}' is marked adequate but has no evidence_refs`,
        ),
      );
      continue;
    }

    const hasQuote = f.evidence_refs.some(
      (ref) => ref.verbatim_quote && ref.verbatim_quote.trim().length > 0,
    );
    if (!hasQuote) {
      failures.push(
        fail(
          "adequate_has_evidence",
          `Finding '${f.finding_id}' is marked adequate but no evidence_ref has a verbatim_quote`,
        ),
      );
    }
  }
  return failures;
}

/**
 * Partially adequate verdict must have gap_description.
 */
export function checkPartiallyAdequateHasGap(
  state: Record<string, unknown>,
): RuleFailure[] {
  const findings = asTprm(state).findings_register;
  if (!Array.isArray(findings) || findings.length === 0) return [];

  const failures: RuleFailure[] = [];
  for (const f of findings) {
    if (f.verdict === "partially_adequate" && !f.gap_description) {
      failures.push(
        fail(
          "partially_adequate_has_gap",
          `Finding '${f.finding_id}' is marked partially_adequate but has no gap_description`,
        ),
      );
    }
  }
  return failures;
}

/**
 * Inadequate verdict must have gap_description AND remediation_requirement.
 */
export function checkInadequateHasGapAndRemediation(
  state: Record<string, unknown>,
): RuleFailure[] {
  const findings = asTprm(state).findings_register;
  if (!Array.isArray(findings) || findings.length === 0) return [];

  const failures: RuleFailure[] = [];
  for (const f of findings) {
    if (f.verdict !== "inadequate") continue;

    if (!f.gap_description) {
      failures.push(
        fail(
          "inadequate_has_gap_and_remediation",
          `Finding '${f.finding_id}' is marked inadequate but has no gap_description`,
        ),
      );
    }
    if (!f.remediation_requirement) {
      failures.push(
        fail(
          "inadequate_has_gap_and_remediation",
          `Finding '${f.finding_id}' is marked inadequate but has no remediation_requirement`,
        ),
      );
    }
  }
  return failures;
}

/**
 * Not-addressed verdict must have gap_description AND remediation_requirement.
 */
export function checkNotAddressedHasGapAndRemediation(
  state: Record<string, unknown>,
): RuleFailure[] {
  const findings = asTprm(state).findings_register;
  if (!Array.isArray(findings) || findings.length === 0) return [];

  const failures: RuleFailure[] = [];
  for (const f of findings) {
    if (f.verdict !== "not_addressed") continue;

    if (!f.gap_description) {
      failures.push(
        fail(
          "not_addressed_has_gap_and_remediation",
          `Finding '${f.finding_id}' is marked not_addressed but has no gap_description`,
        ),
      );
    }
    if (!f.remediation_requirement) {
      failures.push(
        fail(
          "not_addressed_has_gap_and_remediation",
          `Finding '${f.finding_id}' is marked not_addressed but has no remediation_requirement`,
        ),
      );
    }
  }
  return failures;
}

/**
 * Entries with source_kind mcp_grounded or document_extracted must have source_ref.
 */
export function checkTprmGroundedHasSourceRef(
  state: Record<string, unknown>,
): RuleFailure[] {
  const findings = asTprm(state).findings_register;
  if (!Array.isArray(findings) || findings.length === 0) return [];

  const failures: RuleFailure[] = [];
  for (const f of findings) {
    if (
      (f.source_kind === "mcp_grounded" || f.source_kind === "document_extracted") &&
      !f.source_ref
    ) {
      failures.push(
        fail(
          "tprm_grounded_has_source_ref",
          `Finding '${f.finding_id}' claims ${f.source_kind} but has no source_ref`,
        ),
      );
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Triage rules (nested field validation)
// ---------------------------------------------------------------------------

/**
 * Vendor profile must have name, lei_status, and sanctions_status.
 */
export function checkTprmTriageVendorProfileComplete(
  state: Record<string, unknown>,
): RuleFailure[] {
  const vp = asTprm(state).vendor_profile;
  if (!vp) {
    return [fail("tprm_triage_vendor_profile_complete", "vendor_profile is missing")];
  }

  const failures: RuleFailure[] = [];
  if (!vp.name || vp.name.trim().length === 0) {
    failures.push(
      fail(
        "tprm_triage_vendor_profile_complete",
        "vendor_profile.name is missing or empty",
      ),
    );
  }
  if (!vp.lei_status || vp.lei_status.trim().length === 0) {
    failures.push(
      fail(
        "tprm_triage_vendor_profile_complete",
        "vendor_profile.lei_status is missing or empty",
      ),
    );
  }
  if (!vp.sanctions_status || vp.sanctions_status.trim().length === 0) {
    failures.push(
      fail(
        "tprm_triage_vendor_profile_complete",
        "vendor_profile.sanctions_status is missing or empty",
      ),
    );
  }
  return failures;
}

/**
 * Risk classification must have tier and rationale (min 20 words).
 */
export function checkTprmTriageClassificationComplete(
  state: Record<string, unknown>,
): RuleFailure[] {
  const rc = asTprm(state).risk_classification;
  if (!rc) {
    return [
      fail("tprm_triage_classification_complete", "risk_classification is missing"),
    ];
  }

  const failures: RuleFailure[] = [];
  if (!rc.tier || rc.tier.trim().length === 0) {
    failures.push(
      fail(
        "tprm_triage_classification_complete",
        "risk_classification.tier is missing or empty",
      ),
    );
  }
  if (!rc.rationale || rc.rationale.trim().split(/\s+/).length < 20) {
    failures.push(
      fail(
        "tprm_triage_classification_complete",
        "risk_classification.rationale must be at least 20 words",
      ),
    );
  }
  return failures;
}

/**
 * Recommendation must have decision and rationale (min 30 words).
 */
export function checkTprmTriageRecommendationComplete(
  state: Record<string, unknown>,
): RuleFailure[] {
  const rec = asTprm(state).recommendation;
  if (!rec) {
    return [
      fail("tprm_triage_recommendation_complete", "recommendation is missing"),
    ];
  }

  const failures: RuleFailure[] = [];
  if (!rec.decision || rec.decision.trim().length === 0) {
    failures.push(
      fail(
        "tprm_triage_recommendation_complete",
        "recommendation.decision is missing or empty",
      ),
    );
  }
  if (!rec.rationale || rec.rationale.trim().split(/\s+/).length < 30) {
    failures.push(
      fail(
        "tprm_triage_recommendation_complete",
        "recommendation.rationale must be at least 30 words",
      ),
    );
  }
  return failures;
}

/**
 * If decision is "conditional", conditions array must have at least 1 entry.
 */
export function checkTprmConditionalHasConditions(
  state: Record<string, unknown>,
): RuleFailure[] {
  const rec = asTprm(state).recommendation;
  if (!rec || rec.decision !== "conditional") return [];

  if (!Array.isArray(rec.conditions) || rec.conditions.length === 0) {
    return [
      fail(
        "tprm_conditional_has_conditions",
        "recommendation.decision is 'conditional' but conditions array is empty or missing",
      ),
    ];
  }
  return [];
}

/**
 * If decision is "no_go", blocking_findings array must have at least 1 entry.
 */
export function checkTprmNogoHasBlockingFindings(
  state: Record<string, unknown>,
): RuleFailure[] {
  const rec = asTprm(state).recommendation;
  if (!rec || rec.decision !== "no_go") return [];

  if (!Array.isArray(rec.blocking_findings) || rec.blocking_findings.length === 0) {
    return [
      fail(
        "tprm_nogo_has_blocking_findings",
        "recommendation.decision is 'no_go' but blocking_findings array is empty or missing",
      ),
    ];
  }
  return [];
}
