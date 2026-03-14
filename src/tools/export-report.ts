/** Export a formatted compliance or STRIDE assessment report from stored state. */

import type { ToolResult } from "./index.js";
import { loadState, listStates } from "../state/store.js";
import { getTaskById } from "./get-task-definition.js";
import { evaluateCompleteness } from "../validation/engine.js";
import {
  buildStrideReport,
  type ThreatEntry,
  type MitigationEntry,
  type ComponentEntry,
  type DataFlowEntry,
  type TrustBoundaryEntry,
  type ExistingControlEntry,
  type GapEntry,
  type ScopeReadinessEntry,
  type ClientQuestionEntry,
  type ClientAttestationEntry,
  type AttackPathEntry,
  type VerificationTestEntry,
  type RedFlagEntry,
  type EvidenceManifestEntry,
} from "./export-report-stride.js";

interface StrideDocumentCitation {
  document?: string;
  doc_id?: string;
}

interface ScopeAndDfdState {
  system_name?: string;
  components?: ComponentEntry[];
  data_flows?: DataFlowEntry[];
  trust_boundaries?: TrustBoundaryEntry[];
  existing_controls?: ExistingControlEntry[];
  dfd_markdown?: string | null;
  documents_reviewed?: string[];
  document_citations?: StrideDocumentCitation[];
  gaps?: GapEntry[];
}

interface ScopeGapAnalysisState {
  scope_readiness?: ScopeReadinessEntry;
  client_questions?: ClientQuestionEntry[];
  client_attestations?: ClientAttestationEntry[];
  gaps?: GapEntry[];
}

interface OrgProfile {
  name?: string;
  type?: string;
  sector?: string;
  jurisdiction?: string;
  description?: string;
}

interface EvidenceRef {
  doc_id: string;
  section_ref: string;
  page_start?: number;
  page_end?: number;
  filename?: string;
}

interface MatrixRow {
  req_id: string;
  requirement_text?: string;
  framework?: string;
  authority_id?: string;
  authority_type?: string;
  authority_title?: string;
  source_kind?: string;
  source_ref?: string;
  language?: string;
  verdict: string;
  confidence?: string;
  evidence_refs?: EvidenceRef[];
  verbatim_quote?: string;
  evidence_summary?: string;
  gap_description?: string;
  remediation_guidance?: string;
  requires_human_review?: boolean;
  search_queries_used?: string[];
}

interface CoverageStats {
  total_requirements?: number;
  compliant?: number;
  partial?: number;
  documented?: number;
  partially_documented?: number;
  not_found?: number;
  contradicted?: number;
  not_applicable?: number;
  requires_human_review?: number;
  requires_human_assessment?: number;
  coverage_percentage?: number;
}

interface ScopeMethodology {
  assessment_date?: string;
  frameworks_assessed?: Array<{ name: string; version?: string; source_mcp?: string }>;
  documents_analyzed?: Array<{ filename: string; doc_id?: string; sections_count?: number; quality_signal?: string }>;
  methodology?: string;
  limitations?: string[];
  client_attestations?: Array<{ question: string; response: string; impact?: string }>;
}

function esc(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function pct(n: number, total: number): string {
  if (total === 0) return "0";
  return ((n / total) * 100).toFixed(1);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isObjectArray<T extends object>(value: unknown): value is T[] {
  return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null);
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

function documentNamesFromCitations(citations: StrideDocumentCitation[]): string[] {
  return uniqueStrings(citations.map((citation) => citation.document || citation.doc_id));
}

function validateStrideReportState(state: Record<string, unknown>) {
  const definition = getTaskById("stride_threat_model");
  if (!definition) {
    return null;
  }
  return evaluateCompleteness(
    state,
    definition.completion_criteria,
    definition.quality_rubric,
  );
}

function buildReport(
  assessmentId: string,
  orgProfile: OrgProfile,
  frameworks: string[],
  matrix: MatrixRow[],
  stats: CoverageStats,
  scope: ScopeMethodology,
  documents: Array<{ filename: string; doc_id?: string }>,
  assumptions: Array<{ assumption: string; confidence_impact?: string }>,
  expertsUsed: Array<{ agent_id: string; display_name?: string; status: string; entries_count?: number }>,
): string {
  const lines: string[] = [];
  const date = scope.assessment_date || new Date().toISOString().split("T")[0];
  const orgName = orgProfile.name || "Organization";
  const fwList = frameworks.join(", ") || "Not specified";
  const total = stats.total_requirements || matrix.length;

  // Title
  lines.push("# Compliance Assessment Report");
  lines.push("");
  lines.push(`**Organization:** ${orgName}  `);
  lines.push(`**Date:** ${date}  `);
  lines.push(`**Frameworks:** ${fwList}  `);
  lines.push(`**Assessment ID:** ${assessmentId}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Executive Summary
  lines.push("## 1. Executive Summary");
  lines.push("");
  lines.push(
    `${orgName} was assessed against ${fwList} based on ${documents.length} submitted document(s).`,
  );
  lines.push("");
  lines.push("### Compliance Posture");
  lines.push("");

  const documented = stats.documented ?? stats.compliant ?? 0;
  const partiallyDocumented = stats.partially_documented ?? stats.partial ?? 0;
  const humanReview = stats.requires_human_assessment ?? stats.requires_human_review ?? 0;

  // Use new-style labels when new-style stats are present, otherwise old-style
  const useNewLabels = stats.documented != null || stats.partially_documented != null || stats.requires_human_assessment != null;
  const docLabel = useNewLabels ? "Documented" : "Compliant";
  const partialLabel = useNewLabels ? "Partially Documented" : "Partial";
  const humanLabel = useNewLabels ? "Requires Human Assessment" : "Requires Human Review";

  lines.push("| Metric | Count | % |");
  lines.push("|--------|------:|--:|");
  lines.push(`| Total Requirements | ${total} | — |`);
  lines.push(
    `| ${docLabel} | ${documented} | ${pct(documented, total)}% |`,
  );
  lines.push(
    `| ${partialLabel} | ${partiallyDocumented} | ${pct(partiallyDocumented, total)}% |`,
  );
  lines.push(
    `| Not Found | ${stats.not_found ?? 0} | ${pct(stats.not_found ?? 0, total)}% |`,
  );
  lines.push(
    `| Contradicted | ${stats.contradicted ?? 0} | ${pct(stats.contradicted ?? 0, total)}% |`,
  );
  lines.push(
    `| Not Applicable | ${stats.not_applicable ?? 0} | ${pct(stats.not_applicable ?? 0, total)}% |`,
  );
  lines.push(
    `| ${humanLabel} | ${humanReview} | ${pct(humanReview, total)}% |`,
  );
  lines.push("");
  lines.push(
    `**Overall Coverage:** ${stats.coverage_percentage?.toFixed(1) ?? "—"}%`,
  );
  lines.push("");
  lines.push("---");
  lines.push("");

  // Scope & Methodology
  lines.push("## 2. Scope & Methodology");
  lines.push("");
  if (scope.methodology) {
    lines.push(scope.methodology);
    lines.push("");
  }
  if (scope.frameworks_assessed && scope.frameworks_assessed.length > 0) {
    lines.push("### Frameworks Assessed");
    lines.push("");
    lines.push("| Framework | Version | Source |");
    lines.push("|-----------|---------|--------|");
    for (const fw of scope.frameworks_assessed) {
      lines.push(
        `| ${esc(fw.name)} | ${esc(fw.version)} | ${esc(fw.source_mcp)} |`,
      );
    }
    lines.push("");
  }
  if (scope.documents_analyzed && scope.documents_analyzed.length > 0) {
    lines.push("### Documents Analyzed");
    lines.push("");
    lines.push("| Document | Sections | Quality |");
    lines.push("|----------|:--------:|:-------:|");
    for (const doc of scope.documents_analyzed) {
      lines.push(
        `| ${esc(doc.filename)} | ${doc.sections_count ?? "—"} | ${doc.quality_signal ?? "—"} |`,
      );
    }
    lines.push("");
  }
  if (scope.limitations && scope.limitations.length > 0) {
    lines.push("### Limitations");
    lines.push("");
    for (const lim of scope.limitations) {
      lines.push(`- ${lim}`);
    }
    lines.push("");
  }
  lines.push("---");
  lines.push("");

  // Compliance Matrix
  lines.push("## 3. Compliance Matrix");
  lines.push("");
  lines.push(
    "| # | Req ID | Framework / Authority | Verdict | Confidence | Evidence Summary | Gap |",
  );
  lines.push(
    "|--:|--------|----------------------|---------|:----------:|-----------------|-----|",
  );
  for (let i = 0; i < matrix.length; i++) {
    const r = matrix[i];
    const flag = r.requires_human_review ? " ⚠️" : "";
    const fwLabel = r.authority_title || r.authority_id || r.framework || "—";
    lines.push(
      `| ${i + 1} | ${esc(r.req_id)} | ${esc(fwLabel)} | **${r.verdict}**${flag} | ${r.confidence ?? "—"} | ${esc(r.evidence_summary)} | ${esc(r.gap_description)} |`,
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Gap Analysis
  const notFound = matrix.filter((r) => r.verdict === "not_found");
  const partial = matrix.filter((r) => r.verdict === "partial" || r.verdict === "partially_documented");
  const contradicted = matrix.filter((r) => r.verdict === "contradicted");

  const fwForRow = (r: MatrixRow): string =>
    r.authority_title || r.authority_id || r.framework || "—";

  lines.push("## 4. Gap Analysis");
  lines.push("");

  if (notFound.length > 0) {
    lines.push(`### Not Found (${notFound.length})`);
    lines.push("");
    lines.push("No documentary evidence was found for these requirements:");
    lines.push("");
    for (const r of notFound) {
      lines.push(
        `- **${r.req_id}** (${fwForRow(r)}): ${r.requirement_text ?? "—"}`,
      );
    }
    lines.push("");
  }

  if (partial.length > 0) {
    lines.push(`### Partial / Partially Documented (${partial.length})`);
    lines.push("");
    for (const r of partial) {
      lines.push(`- **${r.req_id}** (${fwForRow(r)})`);
      if (r.gap_description) lines.push(`  - Gap: ${r.gap_description}`);
      if (r.remediation_guidance) lines.push(`  - Remediation: ${r.remediation_guidance}`);
    }
    lines.push("");
  }

  if (contradicted.length > 0) {
    lines.push(`### Contradictions (${contradicted.length})`);
    lines.push("");
    for (const r of contradicted) {
      lines.push(
        `- **${r.req_id}** (${fwForRow(r)}): ${r.evidence_summary ?? "—"}`,
      );
    }
    lines.push("");
  }

  if (notFound.length === 0 && partial.length === 0 && contradicted.length === 0) {
    lines.push("No gaps identified — all assessed requirements are fully documented or not applicable.");
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  // Evidence Register
  const evidenceRows = matrix.filter(
    (r) => r.evidence_refs && r.evidence_refs.length > 0,
  );
  lines.push("## 5. Evidence Register");
  lines.push("");
  if (evidenceRows.length > 0) {
    lines.push("| Req ID | Document | Section | Pages | Quote (excerpt) |");
    lines.push("|--------|----------|---------|-------|-----------------|");
    for (const r of evidenceRows) {
      for (const ref of r.evidence_refs!) {
        const pages =
          ref.page_start != null
            ? ref.page_end != null
              ? `${ref.page_start}–${ref.page_end}`
              : `${ref.page_start}`
            : "—";
        const quote = r.verbatim_quote
          ? esc(r.verbatim_quote.substring(0, 120)) +
            (r.verbatim_quote.length > 120 ? "…" : "")
          : "—";
        lines.push(
          `| ${esc(r.req_id)} | ${esc(ref.filename || ref.doc_id)} | ${esc(ref.section_ref)} | ${pages} | ${quote} |`,
        );
      }
    }
  } else {
    lines.push("No evidence references recorded.");
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Client Attestations
  if (
    scope.client_attestations &&
    scope.client_attestations.length > 0
  ) {
    lines.push("## 6. Client Attestations");
    lines.push("");
    for (const att of scope.client_attestations) {
      lines.push(`**Q:** ${att.question}  `);
      lines.push(`**A:** ${att.response}  `);
      if (att.impact) lines.push(`**Impact:** ${att.impact}  `);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  // Assumptions & Limitations
  if (assumptions.length > 0) {
    lines.push("## Assumptions & Limitations");
    lines.push("");
    for (const a of assumptions) {
      lines.push(`- ${a.assumption}`);
      if (a.confidence_impact) lines.push(`  - Confidence impact: ${a.confidence_impact}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Experts Consulted
  if (expertsUsed.length > 0) {
    lines.push("## Experts Consulted");
    lines.push("");
    lines.push("| Expert | Status | Entries |");
    lines.push("|--------|--------|--------:|");
    for (const e of expertsUsed) {
      lines.push(`| ${esc(e.display_name || e.agent_id)} | ${e.status} | ${e.entries_count ?? "—"} |`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  // Footer
  lines.push(
    "*Report generated by Ansvar Compliance Assessment Engine v1.0*",
  );

  return lines.join("\n");
}

export async function wkflExportReport(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const assessmentId = args.assessment_id as string;

  if (!assessmentId) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "missing_parameter",
            message: "assessment_id is required.",
          }),
        },
      ],
      isError: true,
    };
  }

  // List all stored keys
  const listing = listStates(assessmentId);
  if (listing.entries.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "no_state",
            message: `No stored state found for assessment '${assessmentId}'. Run the assessment first.`,
          }),
        },
      ],
      isError: true,
    };
  }

  // Load known state keys
  const load = (key: string): unknown => {
    const entry = loadState(assessmentId, key);
    return entry?.data ?? null;
  };

  // Detect STRIDE report format: explicit argument or presence of stride-specific state keys
  const reportFormat = args.report_format as string | undefined;
  const storedKeys = new Set(listing.entries.map((e) => e.key));
  const isStride =
    reportFormat === "stride" ||
    storedKeys.has("scope_and_dfd") ||
    storedKeys.has("stride_threats") ||
    storedKeys.has("coverage_matrix") ||
    storedKeys.has("threat_mitigations");

  if (isStride) {
    const evidenceManifest = (load("evidence_manifest") ?? {}) as EvidenceManifestEntry;
    const scopeAndDfd = (load("scope_and_dfd") ?? {}) as ScopeAndDfdState;
    const scopeGapAnalysis = (load("scope_gap_analysis") ?? {}) as ScopeGapAnalysisState;
    const topLevelComponents = load("components");
    const storedThreats = load("threats");
    const legacyStrideThreats = load("stride_threats");
    const storedMitigations = load("threat_mitigations");
    const storedCoverageMatrix = load("coverage_matrix");
    const storedGaps = load("gaps");
    const storedScopeReadiness = load("scope_readiness");
    const storedClientQuestions = load("client_questions");
    const storedClientAttestations = load("client_attestations");
    const storedDfdMarkdown = load("dfd_markdown");
    const storedDocumentsReviewed = load("documents_reviewed");
    const storedDocumentCitations = load("document_citations");
    const storedAttackPaths = load("attack_paths");
    const storedVerificationTests = load("verification_tests");
    const storedRedFlags = load("red_flags");
    const storedSystemName = load("system_name");
    const storedDetectedDomains = load("detected_domains");
    const storedDomainExpertsUsed = load("domain_experts_used");
    const storedDomainFindings = load("domain_findings");
    const storedDomainAttestations = load("domain_attestations");

    const systemName: string =
      typeof storedSystemName === "string"
        ? storedSystemName
        : typeof scopeAndDfd.system_name === "string"
          ? scopeAndDfd.system_name
          : "Unknown System";
    const components = isObjectArray<ComponentEntry>(topLevelComponents)
      ? topLevelComponents
      : (scopeAndDfd.components ?? []);
    const dataFlows = isObjectArray<DataFlowEntry>(scopeAndDfd.data_flows)
      ? scopeAndDfd.data_flows
      : [];
    const trustBoundaries = isObjectArray<TrustBoundaryEntry>(scopeAndDfd.trust_boundaries)
      ? scopeAndDfd.trust_boundaries
      : [];
    const existingControls = isObjectArray<ExistingControlEntry>(scopeAndDfd.existing_controls)
      ? scopeAndDfd.existing_controls
      : [];
    const threats = isObjectArray<ThreatEntry>(storedThreats)
      ? storedThreats
      : isObjectArray<ThreatEntry>(legacyStrideThreats)
        ? legacyStrideThreats
        : [];
    const mitigations = isObjectArray<MitigationEntry>(storedMitigations)
      ? storedMitigations
      : [];
    const coverageMatrix =
      storedCoverageMatrix && typeof storedCoverageMatrix === "object"
        ? (storedCoverageMatrix as Record<string, Record<string, boolean>>)
        : {};
    const gaps = isObjectArray<GapEntry>(storedGaps)
      ? storedGaps
      : [
          ...(scopeAndDfd.gaps ?? []),
          ...(scopeGapAnalysis.gaps ?? []),
        ];
    const scopeReadiness =
      storedScopeReadiness && typeof storedScopeReadiness === "object"
        ? (storedScopeReadiness as ScopeReadinessEntry)
        : (scopeGapAnalysis.scope_readiness ?? null);
    const clientQuestions = isObjectArray<ClientQuestionEntry>(storedClientQuestions)
      ? storedClientQuestions
      : (scopeGapAnalysis.client_questions ?? []);
    const clientAttestations = isObjectArray<ClientAttestationEntry>(storedClientAttestations)
      ? storedClientAttestations
      : (scopeGapAnalysis.client_attestations ?? []);
    const dfdMarkdown =
      (typeof storedDfdMarkdown === "string" ? storedDfdMarkdown : null) ??
      scopeAndDfd.dfd_markdown ??
      null;
    const documentCitations = isObjectArray<StrideDocumentCitation>(storedDocumentCitations)
      ? storedDocumentCitations
      : (scopeAndDfd.document_citations ?? []);
    const documentsReviewed = isStringArray(storedDocumentsReviewed)
      ? uniqueStrings([
          ...storedDocumentsReviewed,
          ...(scopeAndDfd.documents_reviewed ?? []),
          ...documentNamesFromCitations(documentCitations),
        ])
      : uniqueStrings([
          ...(scopeAndDfd.documents_reviewed ?? []),
          ...documentNamesFromCitations(documentCitations),
        ]);
    const attackPaths = isObjectArray<AttackPathEntry>(storedAttackPaths)
      ? storedAttackPaths
      : [];
    const verificationTests = isObjectArray<VerificationTestEntry>(storedVerificationTests)
      ? storedVerificationTests
      : [];
    const redFlags = isObjectArray<RedFlagEntry>(storedRedFlags)
      ? storedRedFlags
      : [];
    const detectedDomains = isStringArray(storedDetectedDomains)
      ? storedDetectedDomains
      : [];
    const domainExpertsUsed = isObjectArray<{ agent_id: string; status: string }>(storedDomainExpertsUsed)
      ? storedDomainExpertsUsed
      : [];
    const domainFindings = isObjectArray<{ id: string; domain: string; title: string; description: string; status: string }>(storedDomainFindings)
      ? storedDomainFindings
      : [];
    const domainAttestations = isStringArray(storedDomainAttestations)
      ? storedDomainAttestations
      : [];
    const validation = validateStrideReportState({
      system_name: systemName,
      evidence_manifest: evidenceManifest,
      components,
      data_flows: dataFlows,
      trust_boundaries: trustBoundaries,
      scope_readiness: scopeReadiness ?? undefined,
      client_questions: clientQuestions,
      client_attestations: clientAttestations,
      threats,
      coverage_matrix: coverageMatrix,
      attack_paths: attackPaths,
      verification_tests: verificationTests,
      threat_mitigations: mitigations,
      gaps,
      report_markdown: "__pending_export__",
    });

    if (validation && validation.status === "incomplete") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "incomplete_stride_state",
              message: "STRIDE report export blocked because required state is incomplete.",
              missing: validation.missing,
            }),
          },
        ],
        isError: true,
      };
    }

    const report = buildStrideReport({
      assessmentId,
      systemName,
      evidenceManifest,
      components,
      dataFlows,
      trustBoundaries,
      existingControls,
      threats,
      mitigations,
      gaps,
      dfdMarkdown,
      documentsReviewed,
      scopeReadiness,
      clientQuestions,
      clientAttestations,
      attackPaths,
      verificationTests,
      redFlags,
      qualityWarnings: validation?.warnings.map((warning) => warning.details) ?? [],
      detectedDomains,
      domainExpertsUsed,
      domainFindings,
      domainAttestations,
    });

    return {
      content: [
        {
          type: "text",
          text: report,
        },
      ],
    };
  }

  // --- Compliance report path ---

  const orgProfile = (load("org_profile") ?? {}) as OrgProfile;
  const documents = (load("documents") ?? []) as Array<{
    filename: string;
    doc_id?: string;
  }>;
  const frameworks = (load("applicable_frameworks") ?? []) as string[];
  const coverageStats = (load("coverage_stats") ?? {}) as CoverageStats;
  const scopeMethodology = (load("scope_and_methodology") ?? {}) as ScopeMethodology;

  const detectedAuthorities = (load("detected_authorities") ?? []) as Array<{
    authority_id: string;
    authority_type?: string;
    authority_title?: string;
  }>;
  const assumptions = (load("assumptions") ?? []) as Array<{
    assumption: string;
    confidence_impact?: string;
  }>;
  const expertsUsed = (load("experts_used") ?? []) as Array<{
    agent_id: string;
    display_name?: string;
    status: string;
    entries_count?: number;
  }>;

  // Assemble compliance matrix: try new-style single key first, fall back to group_* keys
  const matrix: MatrixRow[] = [];
  const preAssembled = load("compliance_matrix");
  if (Array.isArray(preAssembled) && preAssembled.length > 0) {
    matrix.push(...(preAssembled as MatrixRow[]));
  } else {
    const groupKeys = listing.entries
      .map((e) => e.key)
      .filter((k) => k.startsWith("group_"));

    for (const gk of groupKeys) {
      const groupData = load(gk);
      if (Array.isArray(groupData)) {
        matrix.push(...(groupData as MatrixRow[]));
      } else if (
        groupData &&
        typeof groupData === "object" &&
        "matrix" in (groupData as Record<string, unknown>)
      ) {
        const rows = (groupData as Record<string, unknown>).matrix;
        if (Array.isArray(rows)) {
          matrix.push(...(rows as MatrixRow[]));
        }
      }
    }
  }

  const report = buildReport(
    assessmentId,
    orgProfile,
    frameworks,
    matrix,
    coverageStats,
    scopeMethodology,
    documents,
    assumptions,
    expertsUsed,
  );

  return {
    content: [
      {
        type: "text",
        text: report,
      },
    ],
  };
}
