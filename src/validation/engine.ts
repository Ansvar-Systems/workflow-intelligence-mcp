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
import type {
  CompletionCriteria,
  PhaseDefinition,
  QualityRubricEntry,
  StructuralRule,
} from "../types/task.js";
import type {
  CompletionStatus,
  RuleFailure,
  StageCompletionResult,
} from "../types/validation.js";

import { evaluateFieldPresence } from "./rules/field-presence.js";
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
import {
  checkEveryRequirementHasVerdict,
  checkEveryCompliantHasEvidence,
  checkEveryPartialHasGap,
  checkNoHighConfidenceWithoutQuote,
  checkIntakeResponsesComplete,
  checkFrameworkVersionRecorded,
  checkSourceRefForGroundedEntries,
} from "./rules/compliance.js";
import {
  checkManifestCoverageRule,
  checkDepthIssuesRule,
} from "./rules/manifest-coverage.js";
import {
  checkAttackPathsReferenceKnownThreats,
  checkEvidenceManifestReady,
  checkStrideCoverageComplete,
  checkEveryThreatHasCvss,
  checkEveryThreatHasBusinessContext,
  checkEveryThreatHasSeverity,
  checkNoDuplicateThreatIds,
  checkHighCriticalThreatsHaveControls,
  checkMcpGroundingSufficient,
  checkDocumentEvidenceHasCitationDetails,
  checkDomainChallengeCoherence,
  checkLargeThreatModelsUseBatching,
  checkSeverityDistributionHasSignal,
  checkVerificationTestsReferenceKnownThreats,
  checkSeverityMatchesRiskScore,
  checkSeverityInflation,
  checkCriticalLowLikelihood,
  checkThreatTemplateCompleteness,
  checkEntryPointsDocumented,
  checkQaBlockingResolved,
  checkEnrichmentRatioSufficient,
} from "./rules/stride.js";
import {
  checkScopeReadinessRecorded,
  checkBlockingClientQuestionsResolved,
  checkBlockingGapsHaveResolutionPath,
  checkClientQuestionTraceability,
} from "./rules/gap-analysis.js";
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
} from "./rules/dpia.js";
import {
  checkAdequateHasEvidence,
  checkPartiallyAdequateHasGap,
  checkInadequateHasGapAndRemediation,
  checkNotAddressedHasGapAndRemediation,
  checkTprmGroundedHasSourceRef,
  checkTprmTriageVendorProfileComplete,
  checkTprmTriageClassificationComplete,
  checkTprmTriageRecommendationComplete,
  checkTprmConditionalHasConditions,
  checkTprmNogoHasBlockingFindings,
} from "./rules/tprm.js";
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
} from "./rules/ai-tara.js";

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

// Compliance assessment rules
registerStructuralRule("every_requirement_has_verdict", checkEveryRequirementHasVerdict);
registerStructuralRule("every_compliant_has_evidence", checkEveryCompliantHasEvidence);
registerStructuralRule("every_partial_has_gap", checkEveryPartialHasGap);
registerStructuralRule("no_high_confidence_without_quote", checkNoHighConfidenceWithoutQuote);
registerStructuralRule("intake_responses_complete", checkIntakeResponsesComplete);
registerStructuralRule("framework_version_recorded", checkFrameworkVersionRecorded);
registerStructuralRule("source_ref_for_grounded_entries", checkSourceRefForGroundedEntries);
registerStructuralRule("every_documented_has_evidence", checkEveryCompliantHasEvidence);
registerStructuralRule("every_partially_documented_has_gap", checkEveryPartialHasGap);

// Completeness checker — manifest coverage (Layer 1)
registerStructuralRule("manifest_coverage_check", checkManifestCoverageRule);
registerStructuralRule("depth_issues_flagged", checkDepthIssuesRule);

// STRIDE threat model rules
registerStructuralRule("stride_coverage_complete", checkStrideCoverageComplete);
registerStructuralRule("evidence_manifest_ready", checkEvidenceManifestReady);
registerStructuralRule("every_threat_has_cvss", checkEveryThreatHasCvss);
registerStructuralRule("every_threat_has_business_context", checkEveryThreatHasBusinessContext);
registerStructuralRule("every_threat_has_severity", checkEveryThreatHasSeverity);
registerStructuralRule("no_duplicate_threat_ids", checkNoDuplicateThreatIds);
registerStructuralRule("high_critical_threats_have_controls", checkHighCriticalThreatsHaveControls);
registerStructuralRule("mcp_grounding_sufficient", checkMcpGroundingSufficient);
registerStructuralRule("document_evidence_has_citation_details", checkDocumentEvidenceHasCitationDetails);
registerStructuralRule("severity_distribution_has_signal", checkSeverityDistributionHasSignal);
registerStructuralRule("attack_paths_reference_known_threats", checkAttackPathsReferenceKnownThreats);
registerStructuralRule("verification_tests_reference_known_threats", checkVerificationTestsReferenceKnownThreats);
registerStructuralRule("large_threat_models_use_batching", checkLargeThreatModelsUseBatching);
registerStructuralRule("domain_challenge_coherence", checkDomainChallengeCoherence);
registerStructuralRule("severity_matches_risk_score", checkSeverityMatchesRiskScore);
registerStructuralRule("severity_inflation_check", checkSeverityInflation);
registerStructuralRule("critical_low_likelihood_flag", checkCriticalLowLikelihood);
registerStructuralRule("threat_template_completeness", checkThreatTemplateCompleteness);
registerStructuralRule("entry_points_documented", checkEntryPointsDocumented);
registerStructuralRule("qa_blocking_resolved", checkQaBlockingResolved);
registerStructuralRule("enrichment_ratio_sufficient", checkEnrichmentRatioSufficient);

// Generic scope-gap / client-question rules
registerStructuralRule("scope_readiness_recorded", checkScopeReadinessRecorded);
registerStructuralRule("blocking_client_questions_resolved", checkBlockingClientQuestionsResolved);
registerStructuralRule("blocking_gaps_have_resolution_path", checkBlockingGapsHaveResolutionPath);
registerStructuralRule("client_question_traceability", checkClientQuestionTraceability);

// DPIA assessment rules
registerStructuralRule("dpia_screening_outcome_valid", checkDpiaScreeningOutcomeValid);
registerStructuralRule("dpia_processing_description_complete", checkDpiaProcessingDescriptionComplete);
registerStructuralRule("dpia_necessity_complete", checkDpiaNecessityComplete);
registerStructuralRule("dpia_every_risk_has_category_and_rights", checkDpiaEveryRiskHasCategoryAndRights);
registerStructuralRule("dpia_unique_risk_ids", checkDpiaUniqueRiskIds);
registerStructuralRule("dpia_risk_analysis_references_known_risks", checkDpiaRiskAnalysisReferencesKnownRisks);
registerStructuralRule("dpia_safeguards_reference_known_risks", checkDpiaSafeguardsReferenceKnownRisks);
registerStructuralRule("dpia_consultation_complete", checkDpiaConsultationComplete);
registerStructuralRule("dpia_consultation_references_residual_risks", checkDpiaConsultationReferencesResidualRisks);
registerStructuralRule("dpia_residual_score_coherence", checkDpiaResidualScoreCoherence);
registerStructuralRule("dpia_risk_coverage_complete", checkDpiaRiskCoverageComplete);

// TPRM assessment rules
registerStructuralRule("adequate_has_evidence", checkAdequateHasEvidence);
registerStructuralRule("partially_adequate_has_gap", checkPartiallyAdequateHasGap);
registerStructuralRule("inadequate_has_gap_and_remediation", checkInadequateHasGapAndRemediation);
registerStructuralRule("not_addressed_has_gap_and_remediation", checkNotAddressedHasGapAndRemediation);
registerStructuralRule("tprm_grounded_has_source_ref", checkTprmGroundedHasSourceRef);
registerStructuralRule("tprm_triage_vendor_profile_complete", checkTprmTriageVendorProfileComplete);
registerStructuralRule("tprm_triage_classification_complete", checkTprmTriageClassificationComplete);
registerStructuralRule("tprm_triage_recommendation_complete", checkTprmTriageRecommendationComplete);
registerStructuralRule("tprm_conditional_has_conditions", checkTprmConditionalHasConditions);
registerStructuralRule("tprm_nogo_has_blocking_findings", checkTprmNogoHasBlockingFindings);

// AI TARA assessment rules
registerStructuralRule("ai_tara_min_assets", checkAiTaraMinAssets);
registerStructuralRule("ai_tara_ai_asset_coverage", checkAiTaraAiAssetCoverage);
registerStructuralRule("ai_tara_stripe_ai_coverage", checkAiTaraStripeAiCoverage);
registerStructuralRule("ai_tara_no_duplicate_threat_ids", checkAiTaraNoDuplicateThreatIds);
registerStructuralRule("ai_tara_mcp_grounding_ratio", checkAiTaraMcpGroundingRatio);
registerStructuralRule("ai_tara_ai_categories_populated", checkAiTaraAiCategoriesPopulated);
registerStructuralRule("ai_tara_every_threat_has_impact", checkAiTaraEveryThreatHasImpact);
registerStructuralRule("ai_tara_all_dimensions_rated", checkAiTaraAllDimensionsRated);
registerStructuralRule("ai_tara_every_threat_has_feasibility", checkAiTaraEveryThreatHasFeasibility);
registerStructuralRule("ai_tara_feasibility_sum_coherent", checkAiTaraFeasibilitySumCoherent);
registerStructuralRule("ai_tara_every_threat_in_register", checkAiTaraEveryThreatInRegister);
registerStructuralRule("ai_tara_r4_r5_flagged_for_treatment", checkAiTaraR4R5FlaggedForTreatment);
registerStructuralRule("ai_tara_high_risk_threats_treated", checkAiTaraHighRiskThreatsTreated);
registerStructuralRule("ai_tara_reduce_has_controls", checkAiTaraReduceHasControls);

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

/**
 * Evaluate completeness for a specific phase of a multi-phase task.
 * Falls back to top-level criteria if the phase has no phases array
 * or the requested phase_id is not found.
 */
export function evaluatePhaseCompleteness(
  state: Record<string, unknown>,
  phases: PhaseDefinition[] | undefined,
  phaseId: string,
  fallbackCriteria: CompletionCriteria,
  fallbackRubric: Record<string, QualityRubricEntry>,
): StageCompletionResult {
  if (phases) {
    const phase = phases.find((p) => p.id === phaseId);
    if (phase) {
      return evaluateCompleteness(state, phase.completion_criteria, phase.quality_rubric);
    }
  }
  return evaluateCompleteness(state, fallbackCriteria, fallbackRubric);
}
