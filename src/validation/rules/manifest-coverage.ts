/**
 * Layer 1: Deterministic manifest coverage check.
 *
 * Compares an article manifest (ground truth) against the compliance matrix
 * to find refs that were not assessed. Zero LLM cost, runs in milliseconds.
 */

import type { RuleFailure } from "../../types/validation.js";

export interface ManifestArticle {
  ref: string;
  topic: string;
}

export interface ManifestArticleGroup {
  id: string;
  name: string;
  articles: ManifestArticle[];
}

export interface FrameworkManifest {
  framework_id: string;
  scope: string;
  version: string;
  article_groups: ManifestArticleGroup[];
}

export interface ManifestCoverageResult {
  missing_refs: string[];
  coverage_ratio: number;
  pass: boolean;
  total_manifest_refs: number;
  assessed_count: number;
}

interface MatrixEntry {
  requirement_id?: string;
  authority_id?: string;
  verdict?: string | null;
}

/**
 * Check whether every ref in the manifest has a corresponding entry
 * in the compliance matrix with a non-empty verdict.
 *
 * Returns missing refs in manifest order (article_groups[].articles[] order).
 */
export function checkManifestCoverage(
  manifest: FrameworkManifest,
  complianceMatrix: MatrixEntry[],
  authorityId: string,
): ManifestCoverageResult {
  const assessedRefs = new Set<string>();
  for (const entry of complianceMatrix) {
    if (
      entry.authority_id === authorityId &&
      entry.requirement_id &&
      entry.verdict &&
      entry.verdict.trim().length > 0
    ) {
      assessedRefs.add(entry.requirement_id);
    }
  }

  const allRefs: string[] = [];
  const missingRefs: string[] = [];

  for (const group of manifest.article_groups) {
    for (const article of group.articles) {
      allRefs.push(article.ref);
      if (!assessedRefs.has(article.ref)) {
        missingRefs.push(article.ref);
      }
    }
  }

  const total = allRefs.length;
  const assessed = total - missingRefs.length;

  return {
    missing_refs: missingRefs,
    coverage_ratio: total === 0 ? 1.0 : assessed / total,
    pass: missingRefs.length === 0,
    total_manifest_refs: total,
    assessed_count: assessed,
  };
}

/**
 * Structural rule wrapper for the validation engine registry.
 *
 * Expects `manifest_coverage_input` in the state with:
 * - manifest: FrameworkManifest
 * - authority_id: string
 *
 * Reads `compliance_matrix` from the state.
 */
export function checkManifestCoverageRule(
  state: Record<string, unknown>,
): RuleFailure[] {
  const input = state.manifest_coverage_input as
    | { manifest: FrameworkManifest; authority_id: string }
    | undefined;

  if (!input || !input.manifest) {
    // If this rule fires, the phase is phase_4b_validate — manifest input is required.
    // Returning [] here would silently mark the phase complete without running the diff.
    return [
      {
        rule: "manifest_coverage_check",
        severity: "required" as const,
        details:
          "manifest_coverage_input is missing from stage_state. Call get_manifest to load the manifest, then pass it in stage_state.manifest_coverage_input.",
        field: "manifest_coverage_input",
      },
    ];
  }

  const matrix = (state.compliance_matrix ?? []) as MatrixEntry[];
  const result = checkManifestCoverage(input.manifest, matrix, input.authority_id);

  if (result.pass) return [];

  return result.missing_refs.map((ref) => ({
    rule: "manifest_coverage_check",
    severity: "required" as const,
    details: `Manifest ref '${ref}' in '${input.authority_id}' has no assessed entry in the compliance matrix`,
    field: "compliance_matrix",
  }));
}

interface DepthIssue {
  ref: string;
  severity: string;
  detail: string;
}

interface ValidationState {
  flagged_shallow?: DepthIssue[];
}

/**
 * Structural rule that emits warnings for Layer 2 depth issues.
 *
 * The orchestrator stores flagged_shallow in validation_state after
 * the LLM depth check. This rule surfaces those as warning-severity
 * failures so the engine returns complete_with_quality_warnings.
 */
export function checkDepthIssuesRule(
  state: Record<string, unknown>,
): RuleFailure[] {
  const vs = state.validation_state as ValidationState | undefined;
  if (!vs?.flagged_shallow || vs.flagged_shallow.length === 0) return [];

  return vs.flagged_shallow.map((issue) => ({
    rule: "depth_issues_flagged",
    severity: "warning" as const,
    details: `Depth issue on '${issue.ref}': ${issue.detail}`,
    field: "validation_state.flagged_shallow",
  }));
}
