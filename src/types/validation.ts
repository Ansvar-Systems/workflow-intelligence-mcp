/** Validation result types returned by quality gates. */

export interface RuleFailure {
  rule: string;
  severity: "required" | "warning";
  details: string;
  field?: string;
}

export type CompletionStatus =
  | "complete"
  | "complete_with_quality_warnings"
  | "incomplete";

export interface StageCompletionResult {
  status: CompletionStatus;
  missing: RuleFailure[];
  warnings: RuleFailure[];
  summary: string;
}
