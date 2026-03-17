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
  component_id?: string;
  mcp_source?: string;
  stride_category?: string;
  severity?: string;
  cvss_vector?: string;
  cvss_score?: number;
  cvss_rationale?: string;
  business_risk_tier?: string;
  business_impact?: string;
  likelihood?: string;
  likelihood_rationale?: string;
  document_citations?: DocumentCitation[];
  impact_index?: number;
  likelihood_index?: number;
  risk_score?: number;
  severity_override_rationale?: string;
  affected_entry_points?: string[];
  [key: string]: unknown;
}

interface Component {
  id: string;
}

interface DocumentCitation {
  document?: string;
  doc_id?: string;
  section?: string;
  verbatim_quote?: string;
  evidence_type?: string;
}

interface ThreatMitigation {
  threat_id: string;
  controls: Array<{ control_id: string; [key: string]: unknown }>;
}

interface StrideState {
  components?: Component[];
  coverage_matrix?: Record<string, Record<string, boolean>>;
  document_citations?: DocumentCitation[];
  evidence_manifest?: EvidenceManifest;
  grounding_batches?: GroundingBatch[];
  scale_out_plan?: Record<string, unknown>;
  threats?: Threat[];
  stride_threats?: Threat[];
  attack_paths?: AttackPath[];
  verification_tests?: VerificationTest[];
  threat_mitigations?: ThreatMitigation[];
  detected_domains?: string[];
  domain_experts_used?: DomainExpertUsed[];
  domain_findings?: DomainFinding[];
  domain_attestations?: string[];
}

interface EvidenceManifest {
  authorized_documents?: Array<{ doc_id?: string; title?: string }>;
  system_identity?: { name?: string };
  document_coverage?: Array<{ dimension?: string; status?: string }>;
  mismatch_flags?: string[];
}

interface GroundingBatch {
  batch_id?: string;
  phase_id?: string;
  work_type?: string;
  item_ids?: string[];
  status?: string;
}

interface AttackPath {
  id?: string;
  related_threat_ids?: string[];
  [key: string]: unknown;
}

interface VerificationTest {
  id?: string;
  related_threat_ids?: string[];
  [key: string]: unknown;
}

interface DomainExpertUsed {
  agent_id: string;
  display_name?: string;
  domain?: string;
  status: string;
  findings_count?: number;
  attestations_count?: number;
}

interface DomainFinding {
  id: string;
  domain: string;
  title: string;
  description: string;
  status: string;
  severity?: string;
  rationale?: string;
  domain_standard?: string;
  related_components?: string[];
  related_threat_ids?: string[];
  evidence_refs?: string[];
  source_agent?: string;
  suggested_threat?: {
    stride_category: string;
    title: string;
    description: string;
  };
  merged_as_threat_id?: string;
}

function asStride(state: Record<string, unknown>): StrideState {
  return state as unknown as StrideState;
}

function normalizeSeverity(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function threatList(state: StrideState): Threat[] {
  return state.threats ?? state.stride_threats ?? [];
}

/**
 * Every component must have all 6 STRIDE categories assessed
 * in the coverage matrix.
 */
export function checkStrideCoverageComplete(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const threats = threatList(s);

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
  const expectedComponentIds = new Set<string>();

  for (const component of s.components ?? []) {
    if (component.id) expectedComponentIds.add(component.id);
  }
  for (const threat of threats) {
    if (threat.component_id) expectedComponentIds.add(threat.component_id);
  }

  if (expectedComponentIds.size === 0) {
    for (const componentId of Object.keys(s.coverage_matrix)) {
      expectedComponentIds.add(componentId);
    }
  }

  for (const componentId of expectedComponentIds) {
    const categories = s.coverage_matrix[componentId];
    if (!categories) {
      failures.push({
        rule: "stride_coverage_complete",
        severity: "required",
        details: `Component '${componentId}' has no coverage matrix entry`,
      });
      continue;
    }
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
 * Every threat must have both a cvss_vector and cvss_score.
 */
export function checkEveryThreatHasCvss(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const threats = threatList(s);
  const failures: RuleFailure[] = [];

  for (const threat of threats) {
    const missingVector = !threat.cvss_vector;
    const missingScore = typeof threat.cvss_score !== "number";
    if (missingVector || missingScore) {
      const missingParts = [
        missingVector ? "vector" : null,
        missingScore ? "score" : null,
      ].filter((value): value is string => value !== null);
      failures.push({
        rule: "every_threat_has_cvss",
        severity: "required",
        details: `Threat '${threat.id}' has no CVSS ${missingParts.join(" and ")}`,
      });
    }
  }

  return failures;
}

/**
 * Every threat must declare a severity label.
 */
export function checkEveryThreatHasSeverity(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const threats = threatList(s);
  const failures: RuleFailure[] = [];

  for (const threat of threats) {
    if (!normalizeSeverity(threat.severity)) {
      failures.push({
        rule: "every_threat_has_severity",
        severity: "required",
        details: `Threat '${threat.id}' has no severity`,
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
  const threats = threatList(s);
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
  const threats = threatList(s);
  const mitigations = s.threat_mitigations ?? [];

  // Build a lookup: threat_id -> controls count
  const controlsByThreat = new Map<string, number>();
  for (const m of mitigations) {
    controlsByThreat.set(m.threat_id, (m.controls ?? []).length);
  }

  const failures: RuleFailure[] = [];

  for (const threat of threats) {
    const severity = normalizeSeverity(threat.severity);
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

/**
 * Warn when a sizeable threat set collapses into a single severity band.
 */
export function checkSeverityDistributionHasSignal(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const threats = threatList(s);

  if (threats.length < 5) {
    return [];
  }

  const distinctSeverities = new Set<string>();
  for (const threat of threats) {
    const severity = normalizeSeverity(threat.severity);
    if (severity) {
      distinctSeverities.add(severity);
    }
  }

  if (distinctSeverities.size >= 2) {
    return [];
  }

  return [
    {
      rule: "severity_distribution_has_signal",
      severity: "warning",
      details: `All ${threats.length} threats share the same severity label; risk prioritization likely needs review`,
      field: "threats",
    },
  ];
}

/**
 * Warn when more than 20% of threats are missing MCP grounding
 * or are explicitly marked as llm-reasoned.
 */
export function checkMcpGroundingSufficient(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const threats = threatList(s);

  if (threats.length === 0) {
    return [];
  }

  const ungroundedCount = threats.filter((threat) => {
    const source = threat.mcp_source?.trim().toLowerCase();
    return !source || source === "llm-reasoned";
  }).length;

  if (ungroundedCount / threats.length <= 0.2) {
    return [];
  }

  return [
    {
      rule: "mcp_grounding_sufficient",
      severity: "warning",
      details: `${ungroundedCount}/${threats.length} threats are llm-reasoned or missing mcp_source (>20%)`,
      field: "threats",
    },
  ];
}

/**
 * Warn when document-backed evidence omits key citation details.
 */
export function checkDocumentEvidenceHasCitationDetails(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const failures: RuleFailure[] = [];
  const topLevelCitations = s.document_citations ?? [];
  const threats = threatList(s);

  for (let index = 0; index < topLevelCitations.length; index++) {
    const citation = topLevelCitations[index];
    if (citation.evidence_type !== "document_evidence") continue;
    if (!citation.section || !citation.verbatim_quote) {
      failures.push({
        rule: "document_evidence_has_citation_details",
        severity: "warning",
        details: `Top-level document citation #${index + 1} is missing section or verbatim_quote`,
        field: `document_citations[${index}]`,
      });
    }
  }

  for (const threat of threats) {
    for (let index = 0; index < (threat.document_citations ?? []).length; index++) {
      const citation = threat.document_citations?.[index];
      if (!citation || citation.evidence_type !== "document_evidence") continue;
      if (!citation.document || !citation.section || !citation.verbatim_quote) {
        failures.push({
          rule: "document_evidence_has_citation_details",
          severity: "warning",
          details: `Threat '${threat.id}' has document evidence without document, section, or verbatim quote`,
          field: `threats[${threat.id}].document_citations[${index}]`,
        });
      }
    }
  }

  return failures;
}

/**
 * Evidence manifest must establish the scoped system identity and
 * not contain unresolved mismatch flags.
 */
export function checkEvidenceManifestReady(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const manifest = s.evidence_manifest;

  if (!manifest) {
    return [
      {
        rule: "evidence_manifest_ready",
        severity: "required",
        details: "No evidence_manifest found in state",
      },
    ];
  }

  const failures: RuleFailure[] = [];

  if (!Array.isArray(manifest.authorized_documents) || manifest.authorized_documents.length === 0) {
    failures.push({
      rule: "evidence_manifest_ready",
      severity: "required",
      details: "Evidence manifest has no authorized documents",
      field: "evidence_manifest.authorized_documents",
    });
  }

  if (!nonEmptyString(manifest.system_identity?.name)) {
    failures.push({
      rule: "evidence_manifest_ready",
      severity: "required",
      details: "Evidence manifest is missing the extracted system identity",
      field: "evidence_manifest.system_identity.name",
    });
  }

  if (!Array.isArray(manifest.document_coverage) || manifest.document_coverage.length === 0) {
    failures.push({
      rule: "evidence_manifest_ready",
      severity: "required",
      details: "Evidence manifest has no document coverage assessment",
      field: "evidence_manifest.document_coverage",
    });
  }

  if ((manifest.mismatch_flags ?? []).length > 0) {
    failures.push({
      rule: "evidence_manifest_ready",
      severity: "required",
      details: `Evidence manifest still has mismatch flags: ${(manifest.mismatch_flags ?? []).join(", ")}`,
      field: "evidence_manifest.mismatch_flags",
    });
  }

  return failures;
}

/**
 * Risk calibration must populate business context and CVSS rationale
 * for every retained threat.
 */
export function checkEveryThreatHasBusinessContext(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const threats = threatList(s);
  const failures: RuleFailure[] = [];

  for (const threat of threats) {
    const missingParts: string[] = [];
    if (!nonEmptyString(threat.business_risk_tier)) {
      missingParts.push("business_risk_tier");
    }
    if (!nonEmptyString(threat.business_impact)) {
      missingParts.push("business_impact");
    }
    if (!nonEmptyString(threat.likelihood)) {
      missingParts.push("likelihood");
    }
    if (!nonEmptyString(threat.likelihood_rationale)) {
      missingParts.push("likelihood_rationale");
    }
    if (!nonEmptyString(threat.cvss_rationale)) {
      missingParts.push("cvss_rationale");
    }

    if (missingParts.length > 0) {
      failures.push({
        rule: "every_threat_has_business_context",
        severity: "required",
        details: `Threat '${threat.id}' is missing ${missingParts.join(", ")}`,
      });
    }
  }

  return failures;
}

function collectThreatIds(state: StrideState): Set<string> {
  return new Set(threatList(state).map((threat) => threat.id));
}

/**
 * Attack paths must only reference known retained threat IDs.
 */
export function checkAttackPathsReferenceKnownThreats(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const failures: RuleFailure[] = [];
  const knownThreatIds = collectThreatIds(s);

  for (const attackPath of s.attack_paths ?? []) {
    const relatedThreatIds = Array.isArray(attackPath.related_threat_ids)
      ? attackPath.related_threat_ids
      : [];
    for (const threatId of relatedThreatIds) {
      if (knownThreatIds.has(threatId)) continue;
      failures.push({
        rule: "attack_paths_reference_known_threats",
        severity: "required",
        details: `Attack path '${attackPath.id ?? "unknown"}' references unknown threat '${threatId}'`,
      });
    }
  }

  return failures;
}

/**
 * Verification tests must only reference known retained threat IDs.
 */
export function checkVerificationTestsReferenceKnownThreats(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const failures: RuleFailure[] = [];
  const knownThreatIds = collectThreatIds(s);

  for (const test of s.verification_tests ?? []) {
    const relatedThreatIds = Array.isArray(test.related_threat_ids)
      ? test.related_threat_ids
      : [];
    for (const threatId of relatedThreatIds) {
      if (knownThreatIds.has(threatId)) continue;
      failures.push({
        rule: "verification_tests_reference_known_threats",
        severity: "required",
        details: `Verification test '${test.id ?? "unknown"}' references unknown threat '${threatId}'`,
      });
    }
  }

  return failures;
}

/**
 * Large threat models should declare a batching/scale-out strategy so
 * enrichment and calibration work can be sharded across agents.
 */
export function checkLargeThreatModelsUseBatching(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const threats = threatList(s);

  if (threats.length < 20) {
    return [];
  }

  const hasScaleOutPlan =
    typeof s.scale_out_plan === "object" && s.scale_out_plan !== null;
  const hasGroundingBatches =
    Array.isArray(s.grounding_batches) && s.grounding_batches.length > 0;

  if (hasScaleOutPlan || hasGroundingBatches) {
    return [];
  }

  return [
    {
      rule: "large_threat_models_use_batching",
      severity: "warning",
      details: `Threat set has ${threats.length} retained threats but no scale_out_plan or grounding_batches were recorded`,
      field: "threats",
    },
  ];
}

const RISK_BANDS: Array<{ min: number; max: number; severity: string }> = [
  { min: 1, max: 4, severity: "low" },
  { min: 5, max: 9, severity: "medium" },
  { min: 10, max: 15, severity: "high" },
  { min: 16, max: 25, severity: "critical" },
];

function riskScoreToBand(score: number): string {
  for (const band of RISK_BANDS) {
    if (score >= band.min && score <= band.max) return band.severity;
  }
  return "unknown";
}

/**
 * Severity label must match the L×I risk band.
 * Threats missing impact_index or likelihood_index are flagged as incomplete.
 * Mismatches are allowed only when severity_override_rationale is provided.
 */
export function checkSeverityMatchesRiskScore(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const threats = threatList(s);
  const failures: RuleFailure[] = [];

  for (const threat of threats) {
    const severity = normalizeSeverity(threat.severity);
    if (severity === "informational") continue;

    const impactIndex = typeof threat.impact_index === "number" ? threat.impact_index : null;
    const likelihoodIndex = typeof threat.likelihood_index === "number" ? threat.likelihood_index : null;

    if (impactIndex === null || likelihoodIndex === null) {
      failures.push({
        rule: "severity_matches_risk_score",
        severity: "required",
        details: `Threat '${threat.id}' is missing impact_index or likelihood_index`,
      });
      continue;
    }

    const riskScore = impactIndex * likelihoodIndex;
    const expectedBand = riskScoreToBand(riskScore);

    if (severity !== expectedBand && !nonEmptyString(threat.severity_override_rationale)) {
      failures.push({
        rule: "severity_matches_risk_score",
        severity: "required",
        details: `Threat '${threat.id}' has severity '${severity}' but risk_score ${riskScore} falls in the '${expectedBand}' band with no override rationale`,
      });
    }
  }

  return failures;
}

/**
 * Domain challenge coherence: when domains are detected, experts should
 * have been consulted. All findings must have source attribution.
 */
export function checkDomainChallengeCoherence(
  state: Record<string, unknown>,
): RuleFailure[] {
  const s = asStride(state);
  const failures: RuleFailure[] = [];
  const detectedDomains = s.detected_domains ?? [];
  const expertsUsed = s.domain_experts_used ?? [];
  const findings = s.domain_findings ?? [];

  // 1. If domains detected but no experts consulted
  if (detectedDomains.length > 0 && expertsUsed.length === 0) {
    failures.push({
      rule: "domain_challenge_coherence",
      severity: "warning",
      details: `Domain signals [${detectedDomains.join(", ")}] detected but no experts consulted`,
      field: "domain_experts_used",
    });
  }

  // 2. If any expert delegation failed
  for (const expert of expertsUsed) {
    if (expert.status === "failed") {
      failures.push({
        rule: "domain_challenge_coherence",
        severity: "warning",
        details: `${expert.agent_id} domain challenge failed -- findings may be incomplete`,
        field: "domain_experts_used",
      });
    }
  }

  // 3. If findings with suggested_threat were not processed
  for (const finding of findings) {
    if (finding.suggested_threat && !finding.merged_as_threat_id && finding.status !== "rejected") {
      failures.push({
        rule: "domain_challenge_coherence",
        severity: "warning",
        details: `Domain finding '${finding.id}' has suggested_threat but was not merged or rejected`,
        field: `domain_findings[${finding.id}]`,
      });
    }
  }

  // 4. All findings must have source attribution
  for (const finding of findings) {
    if (!finding.source_agent) {
      failures.push({
        rule: "domain_challenge_coherence",
        severity: "required",
        details: `Domain finding '${finding.id}' missing source_agent attribution`,
        field: `domain_findings[${finding.id}]`,
      });
    }
  }

  return failures;
}
