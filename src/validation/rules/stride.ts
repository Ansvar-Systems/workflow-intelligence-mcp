/**
 * Structural validation rules for STRIDE threat model phases.
 *
 * Checks coverage completeness, CVSS scoring, threat ID uniqueness,
 * and control mappings for high/critical threats.
 */

import type { RuleFailure } from "../../types/validation.js";

const STRIDE_CATEGORIES = [
  "Spoofing",
  "Tampering",
  "Repudiation",
  "Information Disclosure",
  "Denial of Service",
  "Elevation of Privilege",
] as const;

interface Threat {
  id: string;
  stride_category?: string;
  severity?: string;
  cvss_vector?: string;
  [key: string]: unknown;
}

interface ThreatMitigation {
  threat_id: string;
  controls: Array<{ control_id: string; [key: string]: unknown }>;
}

interface StrideState {
  coverage_matrix?: Record<string, Record<string, boolean>>;
  threats?: Threat[];
  stride_threats?: Threat[];
  threat_mitigations?: ThreatMitigation[];
}

function asStride(state: Record<string, unknown>): StrideState {
  return state as unknown as StrideState;
}

/**
 * Every component must have all 6 STRIDE categories assessed
 * in the coverage matrix.
 */
export function checkStrideCoverageComplete(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);

  if (!s.coverage_matrix) {
    return [
      {
        rule: "stride_coverage_complete",
        severity: "required",
        details: "No coverage_matrix found in state",
      },
    ];
  }

  const failures: RuleFailure[] = [];

  for (const [componentId, categories] of Object.entries(s.coverage_matrix)) {
    for (const category of STRIDE_CATEGORIES) {
      if (!categories[category]) {
        failures.push({
          rule: "stride_coverage_complete",
          severity: "required",
          details: `Component '${componentId}' missing assessment for '${category}'`,
        });
      }
    }
  }

  return failures;
}

/**
 * Every threat must have a cvss_vector field.
 */
export function checkEveryThreatHasCvss(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const threats = s.threats ?? s.stride_threats ?? [];
  const failures: RuleFailure[] = [];

  for (const threat of threats) {
    if (!threat.cvss_vector) {
      failures.push({
        rule: "every_threat_has_cvss",
        severity: "required",
        details: `Threat '${threat.id}' has no CVSS vector`,
      });
    }
  }

  return failures;
}

/**
 * All threat IDs must be unique.
 */
export function checkNoDuplicateThreatIds(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const threats = s.threats ?? s.stride_threats ?? [];
  const seen = new Set<string>();
  const failures: RuleFailure[] = [];

  for (const threat of threats) {
    if (seen.has(threat.id)) {
      failures.push({
        rule: "no_duplicate_threat_ids",
        severity: "required",
        details: `Duplicate threat ID: '${threat.id}'`,
      });
    }
    seen.add(threat.id);
  }

  return failures;
}

/**
 * Every threat with severity "critical" or "high" must have at
 * least one control in threat_mitigations.
 *
 * Checks both state.threats and state.stride_threats as the
 * orchestrator may use either key.
 */
export function checkHighCriticalThreatsHaveControls(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const threats = s.threats ?? s.stride_threats ?? [];
  const mitigations = s.threat_mitigations ?? [];

  // Build a lookup: threat_id -> controls count
  const controlsByThreat = new Map<string, number>();
  for (const m of mitigations) {
    controlsByThreat.set(m.threat_id, (m.controls ?? []).length);
  }

  const failures: RuleFailure[] = [];

  for (const threat of threats) {
    const severity = threat.severity?.toLowerCase();
    if (severity !== "critical" && severity !== "high") continue;

    const controlCount = controlsByThreat.get(threat.id) ?? 0;
    if (controlCount === 0) {
      failures.push({
        rule: "high_critical_threats_have_controls",
        severity: "required",
        details: `${threat.severity} threat '${threat.id}' (${threat.stride_category ?? "unknown"}) has no control mappings`,
      });
    }
  }

  return failures;
}
