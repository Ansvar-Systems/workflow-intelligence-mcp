/** Export a formatted STRIDE threat model report from stored state. */

type LooseRecord = Record<string, unknown>;

export interface ThreatEntry extends LooseRecord {
  id: string;
  stride_category: string;
  component_id: string;
  title: string;
  description: string;
  mcp_source?: string;
  cvss_vector?: string;
  cvss_score?: number;
  severity?: string;
  confidence?: string;
  business_risk_tier?: string;
  business_risk_label?: string;
  business_impact?: string;
  business_impact_severity?: string;
  likelihood?: string;
  likelihood_rationale?: string;
  priority_score?: number;
  impact_index?: number;
  likelihood_index?: number;
  cvss_rationale?: string;
  affected_components?: string[];
  affected_flows?: string[];
  affected_trust_boundaries?: string[];
  attack_techniques?: string[];
  mitre_attack_ids?: string[];
  cwe_ids?: string[];
  capec_ids?: string[];
  atlas_ids?: string[];
  d3fend_ids?: string[];
  owasp_llm_ids?: string[];
  existing_controls?: string[];
  recommended_controls?: string[];
  residual_risk?: string;
  residual_risk_rationale?: string;
  attack_path_refs?: string[];
  verification_test_refs?: string[];
  provenance?: ProvenanceEntry;
  document_citations?: Array<{
    document?: string;
    doc_id?: string;
    page?: number;
    section?: string;
    verbatim_quote?: string;
    evidence_type?: string;
  }>;
  pattern_citations?: Array<{
    source?: string;
    pattern_id?: string;
    cwe_id?: string;
    tool_call?: string;
  }>;
}

export interface MitigationEntry extends LooseRecord {
  threat_id: string;
  controls: Array<{
    control_id: string;
    framework: string;
    control_name: string;
    implementation_guidance?: string;
    mcp_source?: string;
  }>;
}

export interface ComponentEntry extends LooseRecord {
  id: string;
  name: string;
  type: string;
  trust_zone?: string;
  technology?: string;
  confidence?: string;
}

export interface DataFlowEntry extends LooseRecord {
  id: string;
  from?: string;
  to?: string;
  source_id?: string;
  destination_id?: string;
  data?: string;
  protocol?: string;
  encrypted?: boolean | string;
  authenticated?: string;
  crosses_boundary?: boolean;
}

export interface TrustBoundaryEntry extends LooseRecord {
  id: string;
  name: string;
  from_zone?: string;
  to_zone?: string;
  flows?: string[];
  data_types?: string[];
}

export interface ExistingControlEntry extends LooseRecord {
  id: string;
  name: string;
  type?: string;
  applies_to?: string[];
}

export interface GapEntry extends LooseRecord {
  dimension?: string;
  phase?: string;
  description: string;
  blocking?: boolean;
  question_id?: string;
  resolution_status?: string;
  impact?: string;
  impact_if_wrong?: string;
  assumption?: string;
}

export interface ScopeReadinessEntry extends LooseRecord {
  overall_status?: string;
  proceeding_mode?: string;
  confidence?: string;
  summary?: string;
  blocking_gaps?: string[];
  clarifications_needed?: string[];
  dimensions_confirmed?: string[];
  dimensions_missing?: string[];
}

export interface ClientQuestionEntry extends LooseRecord {
  id?: string;
  question?: string;
  rationale?: string;
  blocking?: boolean;
  status?: string;
  response?: string;
  response_summary?: string;
  answer_source?: string;
  affects_fields?: string[];
}

export interface ClientAttestationEntry extends LooseRecord {
  question_id?: string;
  question: string;
  response: string;
  impact?: string;
  answer_source?: string;
}

export interface ProvenanceEntry extends LooseRecord {
  source_type?: string;
  confidence?: string;
  document_grounded_fields?: string[];
  user_attested_fields?: string[];
  assumed_fields?: string[];
  pattern_mapped_fields?: string[];
}

export interface AttackPathEntry extends LooseRecord {
  id?: string;
  title?: string;
  summary?: string;
  description?: string;
  related_threat_ids?: string[];
  steps?: Array<string | LooseRecord>;
}

export interface VerificationTestEntry extends LooseRecord {
  id?: string;
  title?: string;
  objective?: string;
  procedure?: string | string[];
  expected_result?: string;
  related_threat_ids?: string[];
}

export interface RedFlagEntry extends LooseRecord {
  id?: string;
  title?: string;
  severity?: string;
  description?: string;
  rationale?: string;
  source?: string;
}

export interface EvidenceManifestEntry extends LooseRecord {
  authorized_documents?: Array<{
    doc_id?: string;
    title?: string;
    role?: string;
    coverage_tags?: string[];
  }>;
  system_identity?: {
    name?: string;
    aliases?: string[];
    evidence_doc_ids?: string[];
  };
  document_coverage?: Array<{
    dimension?: string;
    status?: string;
    supporting_doc_ids?: string[];
    notes?: string;
  }>;
  mismatch_flags?: string[];
  extraction_confidence?: string;
}

export interface StrideReportBuildInput {
  assessmentId: string;
  systemName: string;
  evidenceManifest?: EvidenceManifestEntry | null;
  components: ComponentEntry[];
  dataFlows: DataFlowEntry[];
  trustBoundaries: TrustBoundaryEntry[];
  existingControls: ExistingControlEntry[];
  threats: ThreatEntry[];
  mitigations: MitigationEntry[];
  gaps: GapEntry[];
  dfdMarkdown: string | null;
  documentsReviewed: string[];
  scopeReadiness?: ScopeReadinessEntry | null;
  clientQuestions?: ClientQuestionEntry[];
  clientAttestations?: ClientAttestationEntry[];
  attackPaths?: AttackPathEntry[];
  verificationTests?: VerificationTestEntry[];
  redFlags?: RedFlagEntry[];
  qualityWarnings?: string[];
  detectedDomains?: string[];
  domainExpertsUsed?: Array<{
    agent_id: string;
    display_name?: string;
    domain?: string;
    status: string;
    findings_count?: number;
    attestations_count?: number;
  }>;
  domainFindings?: Array<{
    id: string;
    domain: string;
    title: string;
    description: string;
    status: string;
    severity?: string;
    rationale?: string;
    domain_standard?: string;
    source_agent?: string;
    related_components?: string[];
    suggested_threat?: {
      stride_category: string;
      title: string;
      description: string;
    };
    merged_as_threat_id?: string;
  }>;
  domainAttestations?: string[];
  entryPoints?: Array<{
    id: string;
    name: string;
    component_id: string;
    protocol: string;
    authentication: string;
    exposed_to: string;
    data_classification?: string;
    rate_limited?: boolean | string;
    source?: string;
  }>;
  riskScoringMethodology?: {
    impact_scale?: Array<{ index: number; label: string; criteria: string }>;
    likelihood_scale?: Array<{ index: number; label: string; criteria: string }>;
    risk_bands?: Array<{ range_min: number; range_max: number; severity: string }>;
  } | null;
  qaFindings?: Array<{
    id: string;
    category: string;
    severity: string;
    description: string;
    resolved: boolean;
    remediation?: string;
  }>;
  enrichmentCoverage?: {
    total_threats: number;
    fully_enriched?: number;
    partially_enriched?: number;
    unenriched?: number;
    enrichment_ratio: number;
  } | null;
}

const STRIDE_ORDER = [
  "Spoofing",
  "Tampering",
  "Repudiation",
  "Information Disclosure",
  "Denial of Service",
  "Elevation of Privilege",
] as const;

const STRIDE_BADGES: Record<string, string> = {
  Spoofing: "S",
  Tampering: "T",
  Repudiation: "R",
  "Information Disclosure": "I",
  "Denial of Service": "D",
  "Elevation of Privilege": "E",
};

const RISK_RANK: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
  informational: 1,
  unknown: 0,
};

function esc(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function titleCase(value: string): string {
  return value
    .trim()
    .replace(/[_-]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function labelize(raw: string | undefined, fallback = "Unknown"): string {
  if (!raw || raw.trim().length === 0) return fallback;
  const normalized = raw.trim().toLowerCase();
  const special: Record<string, string> = {
    llm: "LLM",
    llm_reasoned: "LLM-reasoned",
    llmreasoned: "LLM-reasoned",
    document_evidence: "Document-grounded",
    document_grounded: "Document-grounded",
    user_attested: "User-attested",
    pattern_mapped: "Pattern-mapped",
    analyst_judgment: "Analyst judgment",
    informational: "Info",
  };
  if (normalized in special) return special[normalized];
  return titleCase(normalized);
}

function badge(label: string, value?: string): string {
  return `\`${value ? `${label}:${value}` : label}\``;
}

function isLooseRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanLikeLabel(value: unknown): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return stringFrom(value) ?? "—";
}

function getStringField(record: LooseRecord | undefined, ...keys: string[]): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = stringFrom(record[key]);
    if (value) return value;
  }
  return undefined;
}

function getNumberField(record: LooseRecord | undefined, ...keys: string[]): number | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = numberFrom(record[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function getStringArrayField(record: LooseRecord | undefined, ...keys: string[]): string[] {
  if (!record) return [];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map((entry) => stringFrom(entry))
        .filter((entry): entry is string => Boolean(entry));
    }
  }
  return [];
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function normalizeCategoryName(raw: string | undefined): string {
  if (!raw) return "Other";
  const lower = raw.toLowerCase().replace(/[_-]/g, " ").trim();
  for (const category of STRIDE_ORDER) {
    if (category.toLowerCase() === lower) return category;
  }
  for (const category of STRIDE_ORDER) {
    if (lower.startsWith(category.toLowerCase().split(" ")[0])) return category;
  }
  return titleCase(lower);
}

function severityValue(raw: string | undefined): string {
  const normalized = raw?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : "unknown";
}

function severityLabel(raw: string | undefined): string {
  return labelize(severityValue(raw));
}

function riskTier(threat: ThreatEntry): string {
  return severityValue(
    getStringField(threat, "business_risk_tier", "businessRiskTier")
      ?? getStringField(threat, "business_risk_label", "businessRiskLabel")
      ?? threat.severity,
  );
}

function riskLabel(threat: ThreatEntry): string {
  return severityLabel(
    getStringField(threat, "business_risk_label", "businessRiskLabel")
      ?? getStringField(threat, "business_risk_tier", "businessRiskTier")
      ?? threat.severity,
  );
}

function confidenceLabel(threat: ThreatEntry): string {
  const provenance = isLooseRecord(threat.provenance) ? threat.provenance : undefined;
  return labelize(
    getStringField(provenance, "confidence")
      ?? getStringField(threat, "confidence"),
  );
}

function sourceTypeLabel(threat: ThreatEntry): string {
  const provenance = isLooseRecord(threat.provenance) ? threat.provenance : undefined;
  const explicit = getStringField(provenance, "source_type", "sourceType");
  if (explicit) return labelize(explicit);
  const hasDocumentEvidence = (threat.document_citations ?? []).some(
    (citation) =>
      stringFrom(citation.evidence_type)?.toLowerCase() === "document_evidence" ||
      Boolean(citation.document || citation.doc_id),
  );
  if (hasDocumentEvidence) return "Document-grounded";
  if ((threat.mcp_source ?? "").trim().toLowerCase() === "llm-reasoned") {
    return "Assumed";
  }
  if (threat.mcp_source) return "Pattern-mapped";
  return "Unknown";
}

function threatStrideBadges(threat: ThreatEntry): string[] {
  const explicitCategories = getStringArrayField(threat, "stride_categories", "strideCategories");
  const categories =
    explicitCategories.length > 0
      ? explicitCategories.map((category) => normalizeCategoryName(category))
      : [normalizeCategoryName(threat.stride_category)];
  return uniqueStrings(
    categories.map((category) => STRIDE_BADGES[category] ?? category.charAt(0).toUpperCase()),
  );
}

function componentNamesForThreat(
  threat: ThreatEntry,
  componentMap: Map<string, ComponentEntry>,
): string[] {
  const explicit = getStringArrayField(threat, "affected_components", "affectedComponents");
  if (explicit.length > 0) return explicit;
  const componentName = componentMap.get(threat.component_id)?.name || threat.component_id;
  return componentName ? [componentName] : [];
}

function docSourcesForThreat(threat: ThreatEntry): string[] {
  const citations = threat.document_citations ?? [];
  return citations.map((citation) => {
    const parts = [
      citation.document || citation.doc_id || "Unknown document",
      citation.section ? `Section ${citation.section}` : undefined,
      typeof citation.page === "number" ? `p.${citation.page}` : undefined,
    ].filter((part): part is string => Boolean(part));
    return parts.join(" | ");
  });
}

function formatDocumentEvidence(threat: ThreatEntry): string[] {
  return (threat.document_citations ?? [])
    .filter((citation) =>
      stringFrom(citation.evidence_type)?.toLowerCase() === "document_evidence" ||
      Boolean(citation.document || citation.doc_id || citation.section),
    )
    .map((citation) => {
      const parts = [
        citation.document || citation.doc_id || "Unknown document",
        citation.section ? `Section ${citation.section}` : undefined,
        typeof citation.page === "number" ? `p.${citation.page}` : undefined,
        citation.verbatim_quote ? `"${citation.verbatim_quote}"` : undefined,
      ].filter((part): part is string => Boolean(part));
      return parts.join(" | ");
    });
}

function formatPatternEvidence(threat: ThreatEntry): string[] {
  return (threat.pattern_citations ?? []).map((citation) => {
    const parts = [
      citation.source,
      citation.pattern_id,
      citation.cwe_id,
      citation.tool_call,
    ].filter((part): part is string => Boolean(part));
    return parts.join(" | ");
  });
}

function taxonomyBadges(threat: ThreatEntry): string[] {
  const attackIds = uniqueStrings([
    ...getStringArrayField(threat, "attack_techniques", "attackTechniques"),
    ...getStringArrayField(threat, "mitre_attack_ids", "mitreIds"),
  ]);
  const mappings: Array<[string, string[]]> = [
    ["ATT&CK", attackIds],
    ["CWE", getStringArrayField(threat, "cwe_ids", "cweIds")],
    ["CAPEC", getStringArrayField(threat, "capec_ids", "capecIds")],
    ["ATLAS", getStringArrayField(threat, "atlas_ids", "atlasIds")],
    ["D3FEND", getStringArrayField(threat, "d3fend_ids", "d3fendIds")],
    ["OWASP LLM", getStringArrayField(threat, "owasp_llm_ids", "owaspLlmIds")],
  ];

  const badges: string[] = [];
  for (const [label, ids] of mappings) {
    for (const id of ids) {
      badges.push(badge(label, id));
    }
  }
  return badges;
}

function topRiskForComponent(component: ComponentEntry, threats: ThreatEntry[]): string {
  let top = "unknown";
  for (const threat of threats) {
    const threatComponents = componentNamesForThreat(threat, new Map([[component.id, component]]));
    if (threat.component_id !== component.id && !threatComponents.includes(component.name)) {
      continue;
    }
    const candidate = riskTier(threat);
    if ((RISK_RANK[candidate] ?? 0) > (RISK_RANK[top] ?? 0)) {
      top = candidate;
    }
  }
  return severityLabel(top);
}

function toList(values: string[], fallback = "—"): string {
  return values.length > 0 ? values.join(", ") : fallback;
}

function addBulletList(lines: string[], title: string, items: string[]) {
  if (items.length === 0) return;
  lines.push(title);
  for (const item of items) {
    lines.push(`- ${item}`);
  }
  lines.push("");
}

function remediationNames(
  threat: ThreatEntry,
  mitigationMap: Map<string, MitigationEntry>,
): string[] {
  const explicitRecommended = getStringArrayField(threat, "recommended_controls", "recommendedControls");
  const mapped = (mitigationMap.get(threat.id)?.controls ?? []).map((control) => control.control_name);
  return uniqueStrings([...explicitRecommended, ...mapped]);
}

function existingControlNames(threat: ThreatEntry, globalControls: ExistingControlEntry[]): string[] {
  const explicit = getStringArrayField(threat, "existing_controls", "existingControls");
  if (explicit.length > 0) return explicit;
  const appliesById = new Set<string>([
    threat.component_id,
    ...getStringArrayField(threat, "affected_components", "affectedComponents"),
  ]);
  return uniqueStrings(
    globalControls
      .filter((control) => {
        const appliesTo = getStringArrayField(control, "applies_to", "appliesTo");
        return appliesTo.some((value) => appliesById.has(value));
      })
      .map((control) => getStringField(control, "name"))
      .filter((value): value is string => Boolean(value)),
  );
}

function priorityMatrix(threats: ThreatEntry[]): number[][] {
  const matrix = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
  for (const threat of threats) {
    const impact = getNumberField(threat, "impact_index", "impactIndex");
    const likelihood = getNumberField(threat, "likelihood_index", "likelihoodIndex");
    if (!impact || !likelihood) continue;
    if (impact < 1 || impact > 5 || likelihood < 1 || likelihood > 5) continue;
    matrix[5 - likelihood][impact - 1] += 1;
  }
  return matrix;
}

function attackPathSteps(path: AttackPathEntry): string[] {
  const rawSteps = path.steps;
  if (!Array.isArray(rawSteps)) return [];
  return rawSteps.flatMap((step) => {
    if (typeof step === "string") {
      return step.trim().length > 0 ? [step.trim()] : [];
    }
    if (!isLooseRecord(step)) return [];
    const summary = [
      getStringField(step, "step", "title"),
      getStringField(step, "description", "detail"),
    ].filter((value): value is string => Boolean(value));
    return summary.length > 0 ? [summary.join(": ")] : [];
  });
}

function verificationProcedure(test: VerificationTestEntry): string[] {
  const procedure = test.procedure;
  if (typeof procedure === "string") return [procedure];
  if (Array.isArray(procedure)) {
    return procedure
      .map((step) => stringFrom(step))
      .filter((step): step is string => Boolean(step));
  }
  return [];
}

export function buildStrideReport(input: StrideReportBuildInput): string {
  const {
    assessmentId,
    systemName,
    evidenceManifest = null,
    components,
    dataFlows,
    trustBoundaries,
    existingControls,
    threats,
    mitigations,
    gaps,
    dfdMarkdown,
    documentsReviewed,
    scopeReadiness = null,
    clientQuestions = [],
    clientAttestations = [],
    attackPaths = [],
    verificationTests = [],
    redFlags = [],
    qualityWarnings = [],
    detectedDomains = [],
    domainExpertsUsed = [],
    domainFindings = [],
    domainAttestations = [],
    entryPoints = [],
    riskScoringMethodology,
    qaFindings = [],
    enrichmentCoverage,
  } = input;

  const lines: string[] = [];
  const date = new Date().toISOString().split("T")[0];
  const totalThreats = threats.length;
  const componentMap = new Map<string, ComponentEntry>();
  for (const component of components) {
    componentMap.set(component.id, component);
  }

  const mitigationMap = new Map<string, MitigationEntry>();
  for (const mitigation of mitigations) {
    mitigationMap.set(mitigation.threat_id, mitigation);
  }

  const riskCounts: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unknown: 0,
  };
  const strideCounts: Record<string, number> = {
    S: 0,
    T: 0,
    R: 0,
    I: 0,
    D: 0,
    E: 0,
  };
  let mcpGrounded = 0;

  for (const threat of threats) {
    const tier = riskTier(threat);
    riskCounts[tier in riskCounts ? tier : "unknown"]++;
    for (const strideBadge of threatStrideBadges(threat)) {
      if (strideBadge in strideCounts) {
        strideCounts[strideBadge]++;
      }
    }
    if (threat.mcp_source && threat.mcp_source.trim().toLowerCase() !== "llm-reasoned") {
      mcpGrounded++;
    }
  }

  const sortedThreats = [...threats].sort((left, right) => {
    const riskDelta = (RISK_RANK[riskTier(right)] ?? 0) - (RISK_RANK[riskTier(left)] ?? 0);
    if (riskDelta !== 0) return riskDelta;

    const priorityDelta =
      (getNumberField(right, "priority_score", "priorityScore") ?? 0) -
      (getNumberField(left, "priority_score", "priorityScore") ?? 0);
    if (priorityDelta !== 0) return priorityDelta;

    const cvssDelta = (right.cvss_score ?? 0) - (left.cvss_score ?? 0);
    if (cvssDelta !== 0) return cvssDelta;

    return left.id.localeCompare(right.id);
  });

  lines.push("# STRIDE Threat Model Report");
  lines.push("");
  lines.push(`**System:** ${systemName || "Not specified"}  `);
  lines.push(`**Date:** ${date}  `);
  lines.push(`**Assessment ID:** ${assessmentId}  `);
  lines.push(`**Components:** ${components.length}  `);
  lines.push(`**Threats Identified:** ${totalThreats}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  lines.push("## 1. Executive Summary");
  lines.push("");
  lines.push(
    `This report covers **${systemName || "the target system"}**. The retained threat list contains **${totalThreats}** threat(s) across **${components.length}** component(s), with business-risk rollups derived directly from the same retained list shown below.`,
  );
  lines.push("");

  if (scopeReadiness) {
    lines.push(
      `**Scope readiness:** ${labelize(scopeReadiness.overall_status)} | **Proceeding mode:** ${labelize(scopeReadiness.proceeding_mode)} | **Assessment confidence:** ${labelize(scopeReadiness.confidence)}`,
    );
    lines.push("");
    if (scopeReadiness.summary) {
      lines.push(scopeReadiness.summary);
      lines.push("");
    }
  }

  lines.push("### Business Risk Distribution");
  lines.push("");
  lines.push("| Business Risk | Count | % |");
  lines.push("|---------------|------:|--:|");
  for (const [label, count] of [
    ["Critical", riskCounts.critical],
    ["High", riskCounts.high],
    ["Medium", riskCounts.medium],
    ["Low", riskCounts.low],
    ["Info", riskCounts.info],
    ["Unknown", riskCounts.unknown],
  ] as const) {
    const percentage = totalThreats > 0 ? ((count / totalThreats) * 100).toFixed(1) : "0";
    lines.push(`| ${label} | ${count} | ${percentage}% |`);
  }
  lines.push(`| **Total** | **${totalThreats}** | **100%** |`);
  lines.push("");

  lines.push("### STRIDE Coverage Summary");
  lines.push("");
  lines.push("| S | T | R | I | D | E | MCP-grounded |");
  lines.push("|--:|--:|--:|--:|--:|--:|-------------:|");
  lines.push(
    `| ${strideCounts.S} | ${strideCounts.T} | ${strideCounts.R} | ${strideCounts.I} | ${strideCounts.D} | ${strideCounts.E} | ${mcpGrounded}/${totalThreats} |`,
  );
  lines.push("");

  lines.push("### Priority Matrix");
  lines.push("");
  const matrix = priorityMatrix(threats);
  const hasPriorityData = matrix.some((row) => row.some((count) => count > 0));
  if (hasPriorityData) {
    lines.push("| Likelihood \\ Impact | 1 | 2 | 3 | 4 | 5 |");
    lines.push("|---------------------|--:|--:|--:|--:|--:|");
    for (let rowIndex = 0; rowIndex < matrix.length; rowIndex++) {
      const likelihood = 5 - rowIndex;
      lines.push(`| ${likelihood} | ${matrix[rowIndex].join(" | ")} |`);
    }
  } else {
    lines.push("Priority matrix not populated because impact/likelihood indices were not recorded for retained threats.");
  }
  lines.push("");

  if (qualityWarnings.length > 0) {
    lines.push("### Quality Warnings");
    lines.push("");
    for (const warning of qualityWarnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  if (redFlags.length > 0) {
    lines.push("### Architectural Red Flags");
    lines.push("");
    for (const redFlag of redFlags) {
      const label = [
        getStringField(redFlag, "id"),
        getStringField(redFlag, "title") ?? getStringField(redFlag, "description"),
      ]
        .filter((value): value is string => Boolean(value))
        .join(": ");
      lines.push(`- ${label}`);
      const rationale = getStringField(redFlag, "rationale");
      if (rationale) lines.push(`  - ${rationale}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  lines.push("## 2. Risk Scoring Methodology");
  lines.push("");
  if (riskScoringMethodology) {
    if (riskScoringMethodology.impact_scale?.length) {
      lines.push("### Impact Scale");
      lines.push("");
      lines.push("| Index | Label | Criteria |");
      lines.push("|------:|-------|----------|");
      for (const level of riskScoringMethodology.impact_scale) {
        lines.push(`| ${level.index} | ${esc(level.label)} | ${esc(level.criteria)} |`);
      }
      lines.push("");
    }
    if (riskScoringMethodology.likelihood_scale?.length) {
      lines.push("### Likelihood Scale");
      lines.push("");
      lines.push("| Index | Label | Criteria |");
      lines.push("|------:|-------|----------|");
      for (const level of riskScoringMethodology.likelihood_scale) {
        lines.push(`| ${level.index} | ${esc(level.label)} | ${esc(level.criteria)} |`);
      }
      lines.push("");
    }
    if (riskScoringMethodology.risk_bands?.length) {
      lines.push("### Risk Score Bands");
      lines.push("");
      lines.push("| Score Range | Severity |");
      lines.push("|-------------|----------|");
      for (const band of riskScoringMethodology.risk_bands) {
        lines.push(`| ${band.range_min}-${band.range_max} | ${esc(band.severity)} |`);
      }
      lines.push("");
    }
    lines.push("**Override policy:** Severity may deviate from the computed band when `severity_override_rationale` documents the reason.");
    lines.push("");
  } else {
    lines.push("Risk scoring methodology was not recorded for this assessment.");
    lines.push("");
  }
  lines.push("---");
  lines.push("");

  lines.push("## 3. Scope, Evidence, and Limitations");
  lines.push("");

  if (evidenceManifest) {
    const systemIdentityName = getStringField(evidenceManifest.system_identity, "name");
    const aliases = getStringArrayField(evidenceManifest.system_identity, "aliases");
    const mismatchFlags = getStringArrayField(evidenceManifest, "mismatch_flags");
    const extractionConfidence = getStringField(evidenceManifest, "extraction_confidence");
    const authorizedDocuments = Array.isArray(evidenceManifest.authorized_documents)
      ? evidenceManifest.authorized_documents
      : [];
    const documentCoverage = Array.isArray(evidenceManifest.document_coverage)
      ? evidenceManifest.document_coverage
      : [];

    lines.push("### Authorized Evidence Manifest");
    lines.push("");
    if (systemIdentityName) {
      lines.push(`**System Identity:** ${esc(systemIdentityName)}  `);
    }
    if (aliases.length > 0) {
      lines.push(`**Aliases:** ${esc(aliases.join(", "))}  `);
    }
    if (extractionConfidence) {
      lines.push(`**Extraction Confidence:** ${esc(labelize(extractionConfidence))}  `);
    }
    if (mismatchFlags.length > 0) {
      lines.push(`**Mismatch Flags:** ${esc(mismatchFlags.join("; "))}`);
      lines.push("");
    } else if (systemIdentityName || aliases.length > 0 || extractionConfidence) {
      lines.push("");
    }

    if (authorizedDocuments.length > 0) {
      lines.push("| Document | Role | Coverage Tags |");
      lines.push("|----------|------|---------------|");
      for (const document of authorizedDocuments) {
        lines.push(
          `| ${esc(getStringField(document, "title") || getStringField(document, "doc_id") || "—")} | ${esc(getStringField(document, "role") || "—")} | ${esc(toList(getStringArrayField(document, "coverage_tags")))} |`,
        );
      }
      lines.push("");
    }

    if (documentCoverage.length > 0) {
      lines.push("| Coverage Dimension | Status | Supporting Docs | Notes |");
      lines.push("|--------------------|--------|-----------------|-------|");
      for (const entry of documentCoverage) {
        lines.push(
          `| ${esc(getStringField(entry, "dimension") || "—")} | ${esc(labelize(getStringField(entry, "status"), "Unknown"))} | ${esc(toList(getStringArrayField(entry, "supporting_doc_ids")))} | ${esc(getStringField(entry, "notes") || "—")} |`,
        );
      }
      lines.push("");
    }
  }

  if (documentsReviewed.length > 0) {
    lines.push("### Documents Reviewed");
    lines.push("");
    for (const document of documentsReviewed) {
      lines.push(`- ${document}`);
    }
    lines.push("");
  } else {
    lines.push("No documents were submitted for review.");
    lines.push("");
  }

  if (existingControls.length > 0) {
    lines.push("### Existing Controls Declared in Scope");
    lines.push("");
    lines.push("| ID | Control | Type | Applies To |");
    lines.push("|----|---------|------|------------|");
    for (const control of existingControls) {
      lines.push(
        `| ${esc(getStringField(control, "id") || "—")} | ${esc(getStringField(control, "name") || "—")} | ${esc(getStringField(control, "type") || "—")} | ${esc(toList(getStringArrayField(control, "applies_to", "appliesTo")))} |`,
      );
    }
    lines.push("");
  }

  if (scopeReadiness) {
    lines.push("### Scope Readiness");
    lines.push("");
    lines.push(`**Overall Status:** ${esc(labelize(scopeReadiness.overall_status))}  `);
    lines.push(`**Proceeding Mode:** ${esc(labelize(scopeReadiness.proceeding_mode))}  `);
    if (scopeReadiness.confidence) {
      lines.push(`**Confidence:** ${esc(labelize(scopeReadiness.confidence))}  `);
    }
    if (scopeReadiness.summary) {
      lines.push(`${scopeReadiness.summary}`);
      lines.push("");
    }
    addBulletList(lines, "Blocking gaps:", scopeReadiness.blocking_gaps ?? []);
    addBulletList(lines, "Clarifications needed:", scopeReadiness.clarifications_needed ?? []);
    addBulletList(lines, "Dimensions confirmed:", scopeReadiness.dimensions_confirmed ?? []);
    addBulletList(lines, "Dimensions missing:", scopeReadiness.dimensions_missing ?? []);
  }

  const clarificationRows: ClientAttestationEntry[] = [];
  const seenClarifications = new Set<string>();
  for (const attestation of clientAttestations) {
    const dedupeKey = `${attestation.question_id ?? ""}:${attestation.question}:${attestation.response}`;
    if (seenClarifications.has(dedupeKey)) continue;
    seenClarifications.add(dedupeKey);
    clarificationRows.push(attestation);
  }
  for (const question of clientQuestions) {
    const status = (question.status ?? "").trim().toLowerCase();
    if (status !== "answered" && status !== "assumed" && status !== "waived") continue;
    const response =
      question.response?.trim() ||
      question.response_summary?.trim() ||
      (status === "waived" ? "Question waived." : "");
    if (!question.question || !response) continue;
    const dedupeKey = `${question.id ?? ""}:${question.question}:${response}`;
    if (seenClarifications.has(dedupeKey)) continue;
    seenClarifications.add(dedupeKey);
    clarificationRows.push({
      question_id: question.id,
      question: question.question,
      response,
      impact:
        question.affects_fields && question.affects_fields.length > 0
          ? `Affects: ${question.affects_fields.join(", ")}`
          : undefined,
      answer_source: question.answer_source,
    });
  }

  if (clarificationRows.length > 0) {
    lines.push("### Client Clarifications and Attestations");
    lines.push("");
    for (const clarification of clarificationRows) {
      lines.push(`**Q:** ${clarification.question}  `);
      lines.push(`**A:** ${clarification.response}  `);
      if (clarification.answer_source) {
        lines.push(`**Source:** ${esc(labelize(clarification.answer_source))}  `);
      }
      if (clarification.impact) {
        lines.push(`**Impact:** ${clarification.impact}  `);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");

  lines.push("## 4. Architecture Summary");
  lines.push("");

  if (components.length > 0) {
    lines.push("### Component Inventory");
    lines.push("");
    lines.push("| ID | Component | Type | Technology | Trust Zone | Top Risk | Confidence |");
    lines.push("|----|-----------|------|------------|------------|----------|------------|");
    for (const component of components) {
      lines.push(
        `| ${esc(component.id)} | ${esc(component.name)} | ${esc(component.type)} | ${esc(component.technology || "—")} | ${esc(component.trust_zone || "—")} | ${esc(topRiskForComponent(component, threats))} | ${esc(labelize(component.confidence, "—"))} |`,
      );
    }
    lines.push("");
  }

  if (trustBoundaries.length > 0) {
    lines.push("### Trust Boundaries");
    lines.push("");
    lines.push("| ID | Name | From Zone | To Zone | Flows | Data Types |");
    lines.push("|----|------|-----------|---------|-------|------------|");
    for (const boundary of trustBoundaries) {
      lines.push(
        `| ${esc(getStringField(boundary, "id") || "—")} | ${esc(getStringField(boundary, "name") || "—")} | ${esc(getStringField(boundary, "from_zone", "fromZone") || "—")} | ${esc(getStringField(boundary, "to_zone", "toZone") || "—")} | ${esc(toList(getStringArrayField(boundary, "flows")))} | ${esc(toList(getStringArrayField(boundary, "data_types", "dataTypes")))} |`,
      );
    }
    lines.push("");
  }

  if (dataFlows.length > 0) {
    lines.push("### Key Data Flows");
    lines.push("");
    lines.push("| ID | From | To | Data | Protocol | Authenticated | Encrypted | Crosses Boundary |");
    lines.push("|----|------|----|------|----------|---------------|-----------|------------------|");
    for (const flow of dataFlows) {
      lines.push(
        `| ${esc(flow.id)} | ${esc(flow.from || flow.source_id || "—")} | ${esc(flow.to || flow.destination_id || "—")} | ${esc(flow.data || "—")} | ${esc(flow.protocol || "—")} | ${esc(flow.authenticated || "—")} | ${esc(booleanLikeLabel(flow.encrypted))} | ${esc(booleanLikeLabel(flow.crosses_boundary))} |`,
      );
    }
    lines.push("");
  }

  lines.push("### Data Flow Diagram");
  lines.push("");
  if (dfdMarkdown && dfdMarkdown.trim().length > 0) {
    lines.push(dfdMarkdown.trim());
  } else {
    lines.push("DFD was not generated for this assessment.");
  }
  lines.push("");

  if (entryPoints.length > 0) {
    lines.push("### Entry Point Inventory");
    lines.push("");
    lines.push("| ID | Name | Component | Protocol | Authentication | Exposed To | Source |");
    lines.push("|----|------|-----------|----------|----------------|------------|--------|");
    for (const ep of entryPoints) {
      lines.push(
        `| ${esc(ep.id)} | ${esc(ep.name)} | ${esc(ep.component_id)} | ${esc(ep.protocol)} | ${esc(labelize(ep.authentication))} | ${esc(labelize(ep.exposed_to))} | ${esc(labelize(ep.source) || "\u2014")} |`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  lines.push("## 5. Detailed Threat Register");
  lines.push("");
  if (sortedThreats.length === 0) {
    lines.push("No retained threats recorded.");
    lines.push("");
  } else {
    lines.push("| ID | STRIDE | Business Risk | Component(s) | Likelihood | CVSS | Confidence | Source Type |");
    lines.push("|----|--------|---------------|--------------|------------|------|------------|-------------|");
    for (const threat of sortedThreats) {
      const cvss = threat.cvss_score != null ? threat.cvss_score.toFixed(1) : "—";
      lines.push(
        `| ${esc(threat.id)} | ${esc(threatStrideBadges(threat).join("/"))} | ${esc(riskLabel(threat))} | ${esc(toList(componentNamesForThreat(threat, componentMap)))} | ${esc(getStringField(threat, "likelihood") || "—")} | ${cvss} | ${esc(confidenceLabel(threat))} | ${esc(sourceTypeLabel(threat))} |`,
      );
    }
    lines.push("");

    const threatsByCategory = new Map<string, ThreatEntry[]>();
    for (const category of STRIDE_ORDER) {
      threatsByCategory.set(category, []);
    }
    const uncategorized: ThreatEntry[] = [];
    for (const threat of sortedThreats) {
      const category = normalizeCategoryName(threat.stride_category);
      const bucket = threatsByCategory.get(category);
      if (bucket) {
        bucket.push(threat);
      } else {
        uncategorized.push(threat);
      }
    }

    const renderThreatDetails = (threat: ThreatEntry) => {
      lines.push(`#### ${esc(threat.id)}: ${esc(threat.title)}`);
      lines.push("");
      const threatBadges = [
        ...threatStrideBadges(threat).map((value) => badge("STRIDE", value)),
        badge("Risk", riskLabel(threat)),
        badge("Confidence", confidenceLabel(threat)),
        badge("Source", sourceTypeLabel(threat)),
        ...componentNamesForThreat(threat, componentMap).map((name) => badge("Component", name)),
      ];
      lines.push(threatBadges.join(" "));
      lines.push("");
      lines.push(threat.description || "No description provided.");
      lines.push("");

      const businessImpact = getStringField(threat, "business_impact", "businessImpact");
      if (businessImpact) {
        const impactSeverity = getStringField(
          threat,
          "business_impact_severity",
          "businessImpactSeverity",
        );
        lines.push(
          `**Business Impact:** ${businessImpact}${impactSeverity ? ` (${labelize(impactSeverity)})` : ""}`,
        );
        lines.push("");
      }

      const likelihood = getStringField(threat, "likelihood");
      const likelihoodRationale = getStringField(
        threat,
        "likelihood_rationale",
        "likelihoodRationale",
      );
      if (likelihood || likelihoodRationale) {
        lines.push(`**Likelihood:** ${likelihood ?? "—"}`);
        if (likelihoodRationale) {
          lines.push(`**Likelihood Rationale:** ${likelihoodRationale}`);
        }
        lines.push("");
      }

      const cvssRationale = getStringField(threat, "cvss_rationale", "cvssRationale");
      if (threat.cvss_score != null || threat.cvss_vector || cvssRationale) {
        lines.push(`**CVSS Score:** ${threat.cvss_score != null ? threat.cvss_score.toFixed(1) : "—"}`);
        if (threat.cvss_vector) {
          lines.push(`**CVSS Vector:** ${threat.cvss_vector}`);
        }
        if (cvssRationale) {
          lines.push(`**CVSS Rationale:** ${cvssRationale}`);
        }
        lines.push("");
      }

      const affectedFlows = getStringArrayField(threat, "affected_flows", "affectedFlows");
      const affectedBoundaries = getStringArrayField(
        threat,
        "affected_trust_boundaries",
        "affectedTrustBoundaries",
      );
      if (affectedFlows.length > 0 || affectedBoundaries.length > 0) {
        lines.push(`**Affected Flows:** ${toList(affectedFlows)}`);
        lines.push(`**Affected Trust Boundaries:** ${toList(affectedBoundaries)}`);
        lines.push("");
      }

      const taxonomy = taxonomyBadges(threat);
      if (taxonomy.length > 0) {
        lines.push(`**Reference Badges:** ${taxonomy.join(" ")}`);
        lines.push("");
      }

      const activeExistingControls = existingControlNames(threat, existingControls);
      if (activeExistingControls.length > 0) {
        lines.push(`**Existing Controls:** ${toList(activeExistingControls)}`);
        lines.push("");
      }

      const controls = mitigationMap.get(threat.id)?.controls ?? [];
      const recommended = remediationNames(threat, mitigationMap);
      if (recommended.length > 0) {
        lines.push(`**Recommended Controls:** ${toList(recommended)}`);
        lines.push("");
      }
      if (controls.length > 0) {
        lines.push("| Control ID | Framework | Control | Guidance |");
        lines.push("|------------|-----------|---------|----------|");
        for (const control of controls) {
          lines.push(
            `| ${esc(control.control_id)} | ${esc(control.framework)} | ${esc(control.control_name)} | ${esc(control.implementation_guidance || "—")} |`,
          );
        }
        lines.push("");
      }

      const residualRisk = getStringField(threat, "residual_risk", "residualRisk");
      const residualRiskRationale = getStringField(
        threat,
        "residual_risk_rationale",
        "residualRiskRationale",
      );
      if (residualRisk || residualRiskRationale) {
        lines.push(`**Residual Risk:** ${residualRisk ? labelize(residualRisk) : "—"}`);
        if (residualRiskRationale) {
          lines.push(`**Residual Risk Rationale:** ${residualRiskRationale}`);
        }
        lines.push("");
      }

      const attackRefs = getStringArrayField(threat, "attack_path_refs", "attackPathRefs");
      const testRefs = getStringArrayField(threat, "verification_test_refs", "verificationTestRefs");
      if (attackRefs.length > 0 || testRefs.length > 0) {
        lines.push(`**Attack Path Refs:** ${toList(attackRefs)}`);
        lines.push(`**Verification Test Refs:** ${toList(testRefs)}`);
        lines.push("");
      }

      const documentEvidence = formatDocumentEvidence(threat);
      if (documentEvidence.length > 0) {
        lines.push("Document Evidence:");
        for (const evidence of documentEvidence) {
          lines.push(`- ${evidence}`);
        }
        lines.push("");
      }

      const patternEvidence = formatPatternEvidence(threat);
      if (patternEvidence.length > 0) {
        lines.push("Pattern Evidence:");
        for (const evidence of patternEvidence) {
          lines.push(`- ${evidence}`);
        }
        lines.push("");
      }

      if (isLooseRecord(threat.provenance)) {
        const documentGroundedFields = getStringArrayField(
          threat.provenance,
          "document_grounded_fields",
          "documentGroundedFields",
        );
        const userAttestedFields = getStringArrayField(
          threat.provenance,
          "user_attested_fields",
          "userAttestedFields",
        );
        const assumedFields = getStringArrayField(
          threat.provenance,
          "assumed_fields",
          "assumedFields",
        );
        const patternMappedFields = getStringArrayField(
          threat.provenance,
          "pattern_mapped_fields",
          "patternMappedFields",
        );
        if (
          documentGroundedFields.length > 0 ||
          userAttestedFields.length > 0 ||
          assumedFields.length > 0 ||
          patternMappedFields.length > 0
        ) {
          lines.push("**Provenance Details:**");
          if (documentGroundedFields.length > 0) {
            lines.push(`- Document-grounded fields: ${documentGroundedFields.join(", ")}`);
          }
          if (userAttestedFields.length > 0) {
            lines.push(`- User-attested fields: ${userAttestedFields.join(", ")}`);
          }
          if (assumedFields.length > 0) {
            lines.push(`- Assumed fields: ${assumedFields.join(", ")}`);
          }
          if (patternMappedFields.length > 0) {
            lines.push(`- Pattern-mapped fields: ${patternMappedFields.join(", ")}`);
          }
          lines.push("");
        }
      }
    };

    const renderCategory = (category: string, categoryThreats: ThreatEntry[]) => {
      if (categoryThreats.length === 0) return;
      lines.push(`### ${category} (${categoryThreats.length})`);
      lines.push("");
      for (const threat of categoryThreats) {
        renderThreatDetails(threat);
      }
    };

    for (const category of STRIDE_ORDER) {
      renderCategory(category, threatsByCategory.get(category) ?? []);
    }
    renderCategory("Other", uncategorized);
  }

  lines.push("---");
  lines.push("");

  // Domain Expert Challenge section (only if domain fields were supplied)
  const hasDomainData =
    input.detectedDomains !== undefined ||
    input.domainExpertsUsed !== undefined ||
    input.domainFindings !== undefined;
  if (hasDomainData) {
    lines.push("## Domain Expert Challenge");
    lines.push("");

    if (detectedDomains.length === 0) {
      lines.push("No domain signals detected. Analysis used generic STRIDE coverage.");
      lines.push("");
    } else {
      lines.push(`**Detected domains:** ${detectedDomains.join(", ")}`);
      lines.push("");

      if (domainExpertsUsed.length > 0) {
        lines.push("### Experts Consulted");
        lines.push("");
        lines.push("| Agent | Domain | Status | Findings |");
        lines.push("|-------|--------|--------|----------|");
        for (const expert of domainExpertsUsed) {
          const name = expert.display_name
            ? `${esc(expert.display_name)} (\`${esc(expert.agent_id)}\`)`
            : esc(expert.agent_id);
          const domain = esc(expert.domain ?? "—");
          const status = esc(expert.status);
          const count = expert.findings_count ?? 0;
          lines.push(`| ${name} | ${domain} | ${status} | ${count} |`);
        }
        lines.push("");
      }

      // Domain findings NOT merged as threats (merged ones appear in Threat Register)
      const unmatchedFindings = domainFindings.filter((f) => f.status !== "merged");
      if (unmatchedFindings.length > 0) {
        lines.push("### Domain Findings");
        lines.push("");
        for (const finding of unmatchedFindings) {
          const severityTag = finding.severity ? ` [${finding.severity.toUpperCase()}]` : "";
          lines.push(`#### ${esc(finding.id)}: ${esc(finding.title)}${severityTag}`);
          lines.push("");
          lines.push(finding.description);
          lines.push("");
          if (finding.rationale) {
            lines.push(`**Rationale:** ${finding.rationale}`);
            lines.push("");
          }
          if (finding.domain_standard) {
            lines.push(`**Standard:** ${finding.domain_standard}`);
            lines.push("");
          }
          if (finding.source_agent) {
            lines.push(`**Source:** ${esc(finding.source_agent)} | **Status:** ${esc(finding.status)}`);
            lines.push("");
          }
        }
      }

      if (domainAttestations.length > 0) {
        lines.push("### Domain Attestations");
        lines.push("");
        for (const attestation of domainAttestations) {
          lines.push(`- ${attestation}`);
        }
        lines.push("");
      }
    }

    lines.push("---");
    lines.push("");
  }

  lines.push("## 6. Remediation Priorities");
  lines.push("");
  const threatsWithControls = sortedThreats.filter((threat) => remediationNames(threat, mitigationMap).length > 0);
  if (threatsWithControls.length === 0) {
    lines.push("No mitigation mappings were recorded.");
    lines.push("");
  } else {
    lines.push("| Threat | Business Risk | Residual Risk | Recommended Controls |");
    lines.push("|--------|---------------|---------------|----------------------|");
    for (const threat of threatsWithControls) {
      const residualRisk = getStringField(threat, "residual_risk", "residualRisk");
      lines.push(
        `| ${esc(`${threat.id}: ${threat.title}`)} | ${esc(riskLabel(threat))} | ${esc(residualRisk ? labelize(residualRisk) : "—")} | ${esc(toList(remediationNames(threat, mitigationMap)))} |`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  lines.push("## 7. Attack Paths");
  lines.push("");
  if (attackPaths.length === 0) {
    lines.push("No attack paths were synthesized.");
    lines.push("");
  } else {
    for (const attackPath of attackPaths) {
      lines.push(
        `### ${esc(getStringField(attackPath, "id") || "AP")}: ${esc(getStringField(attackPath, "title") || getStringField(attackPath, "summary") || "Attack Path")}`,
      );
      lines.push("");
      const summary =
        getStringField(attackPath, "summary") ?? getStringField(attackPath, "description");
      if (summary) {
        lines.push(summary);
        lines.push("");
      }
      const relatedThreats = getStringArrayField(
        attackPath,
        "related_threat_ids",
        "relatedThreatIds",
      );
      if (relatedThreats.length > 0) {
        lines.push(`**Related Threats:** ${relatedThreats.join(", ")}`);
        lines.push("");
      }
      const steps = attackPathSteps(attackPath);
      if (steps.length > 0) {
        lines.push("Steps:");
        for (const step of steps) {
          lines.push(`- ${step}`);
        }
        lines.push("");
      }
    }
  }

  lines.push("---");
  lines.push("");

  lines.push("## 8. Verification Test Cases");
  lines.push("");
  if (verificationTests.length === 0) {
    lines.push("No verification test cases were generated.");
    lines.push("");
  } else {
    for (const test of verificationTests) {
      lines.push(
        `### ${esc(getStringField(test, "id") || "TC")}: ${esc(getStringField(test, "title") || "Verification Test")}`,
      );
      lines.push("");
      const objective = getStringField(test, "objective");
      if (objective) {
        lines.push(`**Objective:** ${objective}`);
        lines.push("");
      }
      const procedure = verificationProcedure(test);
      if (procedure.length > 0) {
        lines.push("Procedure:");
        for (const step of procedure) {
          lines.push(`- ${step}`);
        }
        lines.push("");
      }
      const expectedResult = getStringField(test, "expected_result", "expectedResult");
      if (expectedResult) {
        lines.push(`**Expected Result:** ${expectedResult}`);
        lines.push("");
      }
      const relatedThreats = getStringArrayField(
        test,
        "related_threat_ids",
        "relatedThreatIds",
      );
      if (relatedThreats.length > 0) {
        lines.push(`**Related Threats:** ${relatedThreats.join(", ")}`);
        lines.push("");
      }
    }
  }

  lines.push("---");
  lines.push("");

  lines.push("## 9. Traceability Appendix");
  lines.push("");
  if (sortedThreats.length === 0) {
    lines.push("No retained threats recorded.");
    lines.push("");
  } else {
    lines.push("| Threat | Source Type | Confidence | MCP Source | Document Sources | Pattern Evidence |");
    lines.push("|--------|-------------|------------|------------|------------------|------------------|");
    for (const threat of sortedThreats) {
      lines.push(
        `| ${esc(threat.id)} | ${esc(sourceTypeLabel(threat))} | ${esc(confidenceLabel(threat))} | ${esc(threat.mcp_source || "—")} | ${esc(toList(docSourcesForThreat(threat)))} | ${esc(toList(formatPatternEvidence(threat)))} |`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  lines.push("## 10. Quality Assurance Summary");
  lines.push("");
  if (qaFindings.length > 0) {
    const blocking = qaFindings.filter(f => f.severity === "blocking");
    const warnings = qaFindings.filter(f => f.severity === "warning");
    const resolved = blocking.filter(f => f.resolved);
    lines.push(`**Blocking findings:** ${blocking.length} (${resolved.length} resolved)  `);
    lines.push(`**Warnings:** ${warnings.length}`);
    lines.push("");
    lines.push("| Finding | Category | Severity | Status | Description |");
    lines.push("|---------|----------|----------|--------|-------------|");
    for (const finding of qaFindings) {
      lines.push(
        `| ${esc(finding.id)} | ${esc(finding.category)} | ${esc(finding.severity)} | ${finding.resolved ? "Resolved" : "Open"} | ${esc(finding.description)} |`,
      );
    }
    lines.push("");
  } else {
    lines.push("No QA findings recorded.");
    lines.push("");
  }
  if (enrichmentCoverage) {
    lines.push(`**Enrichment coverage:** ${Math.round(enrichmentCoverage.enrichment_ratio * 100)}% of threats have taxonomy enrichment`);
    lines.push("");
  }
  lines.push("---");
  lines.push("");

  lines.push("## 11. Gaps and Assumptions Register");
  lines.push("");
  if (gaps.length === 0) {
    lines.push("No gaps or assumptions recorded.");
    lines.push("");
  } else {
    lines.push("| # | Dimension / Phase | Description | Status | Impact / Assumption |");
    lines.push("|--:|-------------------|-------------|--------|---------------------|");
    for (let index = 0; index < gaps.length; index++) {
      const gap = gaps[index];
      const dimensionOrPhase = gap.dimension || gap.phase || "General";
      const impact = gap.impact || gap.impact_if_wrong || gap.assumption || "—";
      lines.push(
        `| ${index + 1} | ${esc(dimensionOrPhase)} | ${esc(gap.description)} | ${esc(labelize(gap.resolution_status || (gap.blocking ? "open" : "tracked")))} | ${esc(impact)} |`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("*Report generated by Ansvar STRIDE Threat Model Engine v1.0*");

  return lines.join("\n");
}
