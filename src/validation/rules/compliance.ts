/**
 * Structural validation rules for the compliance assessment task.
 *
 * These check cross-field invariants that can't be expressed as simple
 * field presence rules (e.g., "every applicable requirement must have
 * a corresponding matrix row").
 */

import type { RuleFailure } from "../../types/validation.js";

interface RequirementRegisterEntry {
  req_id: string;
  framework: string;
  applicable: boolean;
}

interface MatrixRow {
  req_id: string;
  verdict: string;
  confidence?: string;
  evidence_refs?: Array<{ doc_id: string; section_ref: string }>;
  gap_description?: string;
  verbatim_quote?: string;
}

interface IntakeQuestion {
  id: string;
}

interface IntakeResponse {
  question_id: string;
}

interface EnumerationMetadata {
  framework_versions?: Record<string, string>;
}

interface ComplianceState {
  requirement_register?: RequirementRegisterEntry[];
  compliance_matrix?: MatrixRow[];
  intake_questions?: IntakeQuestion[];
  intake_responses?: IntakeResponse[];
  enumeration_metadata?: EnumerationMetadata;
}

function asCompliance(state: Record<string, unknown>): ComplianceState {
  return state as unknown as ComplianceState;
}

export function checkEveryRequirementHasVerdict(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asCompliance(state);
  if (!s.requirement_register || !s.compliance_matrix) return [];

  const matrixIds = new Set(s.compliance_matrix.map((r) => r.req_id));
  const failures: RuleFailure[] = [];

  for (const req of s.requirement_register) {
    if (req.applicable && !matrixIds.has(req.req_id)) {
      failures.push({
        rule: "every_requirement_has_verdict",
        severity: "required",
        details: `Requirement '${req.req_id}' has no compliance matrix entry`,
      });
    }
  }

  return failures;
}

export function checkEveryCompliantHasEvidence(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asCompliance(state);
  if (!s.compliance_matrix) return [];

  const failures: RuleFailure[] = [];

  for (const row of s.compliance_matrix) {
    if (
      row.verdict === "compliant" &&
      (!row.evidence_refs || row.evidence_refs.length === 0)
    ) {
      failures.push({
        rule: "every_compliant_has_evidence",
        severity: "required",
        details: `Requirement '${row.req_id}' is marked compliant but has no evidence references`,
      });
    }
  }

  return failures;
}

export function checkEveryPartialHasGap(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asCompliance(state);
  if (!s.compliance_matrix) return [];

  const failures: RuleFailure[] = [];

  for (const row of s.compliance_matrix) {
    if (row.verdict === "partial" && !row.gap_description) {
      failures.push({
        rule: "every_partial_has_gap",
        severity: "required",
        details: `Requirement '${row.req_id}' is marked partial but has no gap description`,
      });
    }
  }

  return failures;
}

export function checkNoHighConfidenceWithoutQuote(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asCompliance(state);
  if (!s.compliance_matrix) return [];

  const failures: RuleFailure[] = [];

  for (const row of s.compliance_matrix) {
    if (
      row.confidence === "high" &&
      row.verdict !== "not_applicable" &&
      row.verdict !== "not_found" &&
      !row.verbatim_quote
    ) {
      failures.push({
        rule: "no_high_confidence_without_quote",
        severity: "warning",
        details: `Requirement '${row.req_id}' has high confidence but no verbatim quote`,
      });
    }
  }

  return failures;
}

export function checkIntakeResponsesComplete(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asCompliance(state);
  if (!s.intake_questions || s.intake_questions.length === 0) return [];
  if (!s.intake_responses) {
    return s.intake_questions.map((q) => ({
      rule: "intake_responses_complete",
      severity: "required" as const,
      details: `Intake question '${q.id}' has no response`,
    }));
  }

  const responseIds = new Set(s.intake_responses.map((r) => r.question_id));
  const failures: RuleFailure[] = [];

  for (const q of s.intake_questions) {
    if (!responseIds.has(q.id)) {
      failures.push({
        rule: "intake_responses_complete",
        severity: "required",
        details: `Intake question '${q.id}' has no response`,
      });
    }
  }

  return failures;
}

export function checkFrameworkVersionRecorded(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asCompliance(state);
  if (!s.requirement_register || s.requirement_register.length === 0) return [];
  if (!s.enumeration_metadata) return [];

  const versions = s.enumeration_metadata.framework_versions ?? {};
  const frameworks = new Set(s.requirement_register.map((r) => r.framework));
  const failures: RuleFailure[] = [];

  for (const fw of frameworks) {
    if (!versions[fw]) {
      failures.push({
        rule: "framework_version_recorded",
        severity: "required",
        details: `Framework '${fw}' has no version recorded in enumeration_metadata`,
      });
    }
  }

  return failures;
}
