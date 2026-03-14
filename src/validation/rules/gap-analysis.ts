/**
 * Structural validation rules for scope-gap analysis and client-input phases.
 *
 * These rules are intentionally generic so multiple workflow types can reuse
 * the same question/attestation/readiness model.
 */

import type { RuleFailure } from "../../types/validation.js";

const READINESS_STATUSES = new Set(["ready", "partial", "blocked", "minimal"]);
const PROCEEDING_MODES = new Set([
  "proceed",
  "awaiting_client_input",
  "proceed_with_assumptions",
]);
const QUESTION_STATUSES = new Set(["pending", "answered", "assumed", "waived"]);
const ANSWER_SOURCES = new Set([
  "user_attested",
  "document_evidence",
  "assumed",
  "analyst_judgment",
]);

interface ScopeReadiness {
  overall_status?: string;
  proceeding_mode?: string;
  summary?: string;
}

interface ClientQuestion {
  id?: string;
  question?: string;
  blocking?: boolean;
  status?: string;
  response?: string;
  response_summary?: string;
  answer_source?: string;
}

interface GapEntry {
  id?: string;
  description?: string;
  blocking?: boolean;
  question_id?: string;
  assumption?: string;
  resolution_status?: string;
}

interface GapAnalysisState {
  scope_readiness?: ScopeReadiness;
  client_questions?: ClientQuestion[];
  gaps?: GapEntry[];
}

function asGapAnalysis(state: Record<string, unknown>): GapAnalysisState {
  return state as unknown as GapAnalysisState;
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function checkScopeReadinessRecorded(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asGapAnalysis(state);
  const readiness = s.scope_readiness;

  if (!readiness || typeof readiness !== "object") {
    return [
      {
        rule: "scope_readiness_recorded",
        severity: "required",
        details: "scope_readiness is missing",
      },
    ];
  }

  const failures: RuleFailure[] = [];

  if (!READINESS_STATUSES.has(String(readiness.overall_status ?? "").trim())) {
    failures.push({
      rule: "scope_readiness_recorded",
      severity: "required",
      details:
        "scope_readiness.overall_status must be one of ready, partial, blocked, minimal",
      field: "scope_readiness.overall_status",
    });
  }

  if (!PROCEEDING_MODES.has(String(readiness.proceeding_mode ?? "").trim())) {
    failures.push({
      rule: "scope_readiness_recorded",
      severity: "required",
      details:
        "scope_readiness.proceeding_mode must be one of proceed, awaiting_client_input, proceed_with_assumptions",
      field: "scope_readiness.proceeding_mode",
    });
  }

  if (!hasText(readiness.summary)) {
    failures.push({
      rule: "scope_readiness_recorded",
      severity: "required",
      details: "scope_readiness.summary is required",
      field: "scope_readiness.summary",
    });
  }

  return failures;
}

export function checkBlockingClientQuestionsResolved(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asGapAnalysis(state);
  const questions = s.client_questions ?? [];
  const failures: RuleFailure[] = [];

  for (const question of questions) {
    if (!question.blocking) continue;

    const status = String(question.status ?? "").trim();
    if (!QUESTION_STATUSES.has(status)) {
      failures.push({
        rule: "blocking_client_questions_resolved",
        severity: "required",
        details: `Blocking question '${question.id ?? "unknown"}' has invalid status '${status || "missing"}'`,
      });
      continue;
    }

    if (status === "pending") {
      failures.push({
        rule: "blocking_client_questions_resolved",
        severity: "required",
        details: `Blocking question '${question.id ?? "unknown"}' is still pending`,
      });
      continue;
    }

    if (status === "answered" && !hasText(question.response) && !hasText(question.response_summary)) {
      failures.push({
        rule: "blocking_client_questions_resolved",
        severity: "required",
        details: `Blocking question '${question.id ?? "unknown"}' is marked answered but has no response`,
      });
    }

    if (status === "assumed" && !hasText(question.response_summary) && !hasText(question.response)) {
      failures.push({
        rule: "blocking_client_questions_resolved",
        severity: "required",
        details: `Blocking question '${question.id ?? "unknown"}' is marked assumed but has no assumption summary`,
      });
    }
  }

  return failures;
}

export function checkBlockingGapsHaveResolutionPath(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asGapAnalysis(state);
  const gaps = s.gaps ?? [];
  const failures: RuleFailure[] = [];

  for (const gap of gaps) {
    if (!gap.blocking) continue;

    if (hasText(gap.question_id) || hasText(gap.assumption)) {
      continue;
    }

    failures.push({
      rule: "blocking_gaps_have_resolution_path",
      severity: "required",
      details: `Blocking gap '${gap.id ?? gap.description ?? "unknown"}' is not linked to a client question or assumption`,
    });
  }

  return failures;
}

export function checkClientQuestionTraceability(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asGapAnalysis(state);
  const questions = s.client_questions ?? [];
  const failures: RuleFailure[] = [];

  for (const question of questions) {
    const status = String(question.status ?? "").trim();
    if (!QUESTION_STATUSES.has(status)) {
      continue;
    }
    if (status === "pending") {
      continue;
    }

    const answerSource = String(question.answer_source ?? "").trim();
    if (!ANSWER_SOURCES.has(answerSource)) {
      failures.push({
        rule: "client_question_traceability",
        severity: "warning",
        details: `Question '${question.id ?? "unknown"}' is ${status} but has no valid answer_source`,
      });
    }

    if (!hasText(question.question)) {
      failures.push({
        rule: "client_question_traceability",
        severity: "warning",
        details: `Question '${question.id ?? "unknown"}' is missing question text`,
      });
    }
  }

  return failures;
}
