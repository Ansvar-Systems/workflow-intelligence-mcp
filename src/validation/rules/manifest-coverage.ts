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
    return [];
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
