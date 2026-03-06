/**
 * Generic validation engine for stage completion checks.
 *
 * Evaluates field presence, structural rules, soft warnings,
 * and quality rubrics to produce a StageCompletionResult.
 *
 * Structural rules are dispatched via a registry Map so new
 * rules can be added without modifying this module.
 */

import type { DfdStageState } from "../types/dfd.js";
import type { GapAnalysisStageState } from "../types/gap-analysis.js";
import type {
  CompletionCriteria,
  QualityRubricEntry,
  StructuralRule,
} from "../types/task.js";
import type {
  CompletionStatus,
  RuleFailure,
  StageCompletionResult,
} from "../types/validation.js";

import { evaluateFieldPresence } from "./rules/field-presence.js";
import { checkAllProvisionsAssessed } from "./rules/gap-analysis-completeness.js";
import {
  checkExemptionBasisRequired,
  checkAssessorMetadataPresent,
  checkExemptionBasisQuality,
} from "./rules/gap-analysis-consistency.js";
import {
  checkGapsRequiredForNonCompliant,
  checkEvidenceRequiredForCompliant,
  checkEvidenceHasDate,
  checkEvidenceReferenceQuality,
  checkGapDescriptionQuality,
} from "./rules/gap-analysis-evidence.js";
import { evaluateQualityRubric } from "./rules/quality-rubric.js";
import {
  checkBoundaryReferencesValid,
  checkFlowReferencesValid,
} from "./rules/referential-integrity.js";
import {
  checkEveryExternalEntityCrossesBoundary,
  checkEveryProcessHasFlow,
  checkNoDirectExternalToDatastore,
  checkNoOrphanDataStores,
} from "./rules/structural.js";

// ---------------------------------------------------------------------------
// Rule registry
// ---------------------------------------------------------------------------

/**
 * A structural rule implementation receives the full state (cast as needed)
 * and returns any failures found.
 */
type StructuralRuleImpl = (state: Record<string, unknown>) => RuleFailure[];

/**
 * Registry of structural rule implementations keyed by rule ID.
 * Built-in DFD rules are pre-registered. Additional rules can be
 * added via `registerStructuralRule`.
 */
const ruleRegistry = new Map<string, StructuralRuleImpl>();

/**
 * Register a structural rule implementation.
 * If a rule with the same ID already exists, it is replaced.
 */
export function registerStructuralRule(
  id: string,
  impl: StructuralRuleImpl,
): void {
  ruleRegistry.set(id, impl);
}

/**
 * Retrieve the current rule registry (read-only snapshot).
 * Useful for inspection and testing.
 */
export function getRegisteredRules(): ReadonlyMap<string, StructuralRuleImpl> {
  return ruleRegistry;
}

// ---------------------------------------------------------------------------
// Built-in rule registrations
// ---------------------------------------------------------------------------

/** Helper: cast state to DfdStageState for DFD-specific rules. */
function asDfd(state: Record<string, unknown>): DfdStageState {
  return state as unknown as DfdStageState;
}

registerStructuralRule("flow_references_valid", (state) =>
  checkFlowReferencesValid(asDfd(state)),
);

registerStructuralRule("boundary_references_valid", (state) =>
  checkBoundaryReferencesValid(asDfd(state)),
);

registerStructuralRule("every_process_has_at_least_one_flow", (state) =>
  checkEveryProcessHasFlow(asDfd(state)),
);

registerStructuralRule("no_orphan_data_stores", (state) =>
  checkNoOrphanDataStores(asDfd(state)),
);

registerStructuralRule("no_direct_external_to_datastore", (state) =>
  checkNoDirectExternalToDatastore(asDfd(state)),
);

registerStructuralRule("every_external_entity_crosses_boundary", (state) =>
  checkEveryExternalEntityCrossesBoundary(asDfd(state)),
);

/** Helper: wrap a GapAnalysisStageState rule as a generic StructuralRuleImpl. */
function asGapAnalysis(
  impl: (state: GapAnalysisStageState) => RuleFailure[],
): StructuralRuleImpl {
  return (state: Record<string, unknown>) =>
    impl(state as unknown as GapAnalysisStageState);
}

// Gap analysis rules
registerStructuralRule("all_provisions_assessed", asGapAnalysis(checkAllProvisionsAssessed));
registerStructuralRule("gaps_required_for_non_compliant", asGapAnalysis(checkGapsRequiredForNonCompliant));
registerStructuralRule("exemption_basis_required", asGapAnalysis(checkExemptionBasisRequired));
registerStructuralRule("evidence_required_for_compliant", asGapAnalysis(checkEvidenceRequiredForCompliant));
registerStructuralRule("assessor_metadata_present", asGapAnalysis(checkAssessorMetadataPresent));
registerStructuralRule("evidence_has_date", asGapAnalysis(checkEvidenceHasDate));
registerStructuralRule("gap_description_quality", asGapAnalysis(checkGapDescriptionQuality));
registerStructuralRule("exemption_basis_quality", asGapAnalysis(checkExemptionBasisQuality));
registerStructuralRule("evidence_reference_quality", asGapAnalysis(checkEvidenceReferenceQuality));

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Dispatch a single structural rule definition to its registered
 * implementation. If the rule ID has no registered implementation,
 * a failure is returned indicating the rule could not be evaluated.
 */
function dispatchStructuralRule(
  rule: StructuralRule,
  state: Record<string, unknown>,
): RuleFailure[] {
  const impl = ruleRegistry.get(rule.id);

  if (!impl) {
    return [
      {
        rule: rule.id,
        severity: rule.severity,
        details: `No implementation registered for structural rule '${rule.id}'`,
      },
    ];
  }

  const rawFailures = impl(state);

  // Override severity from the rule definition so that task authors
  // control whether a structural rule is required or a warning.
  return rawFailures.map((f) => ({
    ...f,
    severity: rule.severity,
  }));
}

/**
 * Build a human-readable summary from the completion result pieces.
 */
function buildSummary(
  status: CompletionStatus,
  missing: RuleFailure[],
  warnings: RuleFailure[],
): string {
  const parts: string[] = [];

  if (status === "complete") {
    parts.push("All completion criteria met.");
  } else if (status === "incomplete") {
    parts.push(
      `Incomplete: ${missing.length} required rule${missing.length === 1 ? "" : "s"} failed.`,
    );
    for (const f of missing) {
      parts.push(`  - ${f.details}`);
    }
  } else {
    parts.push("Complete with quality warnings.");
  }

  if (warnings.length > 0) {
    parts.push(
      `${warnings.length} quality warning${warnings.length === 1 ? "" : "s"}:`,
    );
    for (const w of warnings) {
      parts.push(`  - ${w.details}`);
    }
  }

  return parts.join("\n");
}

/**
 * Evaluate stage completeness against criteria and quality rubrics.
 *
 * Returns:
 * - "incomplete" if any required field or required structural rule fails
 * - "complete_with_quality_warnings" if all required pass but quality rubric has issues
 * - "complete" if everything passes
 */
export function evaluateCompleteness(
  state: Record<string, unknown>,
  criteria: CompletionCriteria,
  rubric: Record<string, QualityRubricEntry>,
): StageCompletionResult {
  // 1. Required fields
  const fieldFailures = evaluateFieldPresence(state, criteria.required_fields);

  // 2. Structural rules
  const structuralFailures: RuleFailure[] = [];
  for (const rule of criteria.rules) {
    structuralFailures.push(...dispatchStructuralRule(rule, state));
  }

  // 3. Soft warnings (field-based, but severity = "warning")
  const softWarningFailures = evaluateFieldPresence(
    state,
    criteria.soft_warnings,
  ).map((f) => ({
    ...f,
    severity: "warning" as const,
  }));

  // 4. Quality rubric
  const rubricFailures = evaluateQualityRubric(state, rubric);

  // Partition into required failures and warnings
  const missing: RuleFailure[] = [
    ...fieldFailures,
    ...structuralFailures.filter((f) => f.severity === "required"),
  ];

  const warnings: RuleFailure[] = [
    ...structuralFailures.filter((f) => f.severity === "warning"),
    ...softWarningFailures,
    ...rubricFailures,
  ];

  // Determine status
  let status: CompletionStatus;
  if (missing.length > 0) {
    status = "incomplete";
  } else if (warnings.length > 0) {
    status = "complete_with_quality_warnings";
  } else {
    status = "complete";
  }

  const summary = buildSummary(status, missing, warnings);

  return { status, missing, warnings, summary };
}
