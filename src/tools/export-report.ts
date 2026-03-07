/** Export a formatted compliance assessment report from stored state. */

import type { ToolResult } from "./index.js";
import { loadState, listStates } from "../state/store.js";

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
  verdict: string;
  confidence?: string;
  evidence_refs?: EvidenceRef[];
  verbatim_quote?: string;
  evidence_summary?: string;
  gap_description?: string;
  requires_human_review?: boolean;
  search_queries_used?: string[];
}

interface CoverageStats {
  total_requirements?: number;
  compliant?: number;
  partial?: number;
  not_found?: number;
  contradicted?: number;
  not_applicable?: number;
  requires_human_review?: number;
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

function buildReport(
  assessmentId: string,
  orgProfile: OrgProfile,
  frameworks: string[],
  matrix: MatrixRow[],
  stats: CoverageStats,
  scope: ScopeMethodology,
  documents: Array<{ filename: string; doc_id?: string }>,
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
  lines.push("| Metric | Count | % |");
  lines.push("|--------|------:|--:|");
  lines.push(`| Total Requirements | ${total} | — |`);
  lines.push(
    `| Compliant | ${stats.compliant ?? 0} | ${pct(stats.compliant ?? 0, total)}% |`,
  );
  lines.push(
    `| Partial | ${stats.partial ?? 0} | ${pct(stats.partial ?? 0, total)}% |`,
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
    `| Requires Human Review | ${stats.requires_human_review ?? 0} | ${pct(stats.requires_human_review ?? 0, total)}% |`,
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
    "| # | Req ID | Framework | Verdict | Confidence | Evidence Summary | Gap |",
  );
  lines.push(
    "|--:|--------|-----------|---------|:----------:|-----------------|-----|",
  );
  for (let i = 0; i < matrix.length; i++) {
    const r = matrix[i];
    const flag = r.requires_human_review ? " ⚠️" : "";
    lines.push(
      `| ${i + 1} | ${esc(r.req_id)} | ${esc(r.framework)} | **${r.verdict}**${flag} | ${r.confidence ?? "—"} | ${esc(r.evidence_summary)} | ${esc(r.gap_description)} |`,
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");

  // Gap Analysis
  const notFound = matrix.filter((r) => r.verdict === "not_found");
  const partial = matrix.filter((r) => r.verdict === "partial");
  const contradicted = matrix.filter((r) => r.verdict === "contradicted");

  lines.push("## 4. Gap Analysis");
  lines.push("");

  if (notFound.length > 0) {
    lines.push(`### Not Found (${notFound.length})`);
    lines.push("");
    lines.push("No documentary evidence was found for these requirements:");
    lines.push("");
    for (const r of notFound) {
      lines.push(
        `- **${r.req_id}** (${r.framework ?? "—"}): ${r.requirement_text ?? "—"}`,
      );
    }
    lines.push("");
  }

  if (partial.length > 0) {
    lines.push(`### Partial Compliance (${partial.length})`);
    lines.push("");
    for (const r of partial) {
      lines.push(`- **${r.req_id}** (${r.framework ?? "—"})`);
      if (r.gap_description) lines.push(`  - Gap: ${r.gap_description}`);
    }
    lines.push("");
  }

  if (contradicted.length > 0) {
    lines.push(`### Contradictions (${contradicted.length})`);
    lines.push("");
    for (const r of contradicted) {
      lines.push(
        `- **${r.req_id}** (${r.framework ?? "—"}): ${r.evidence_summary ?? "—"}`,
      );
    }
    lines.push("");
  }

  if (notFound.length === 0 && partial.length === 0 && contradicted.length === 0) {
    lines.push("No gaps identified — all assessed requirements are fully compliant or not applicable.");
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

  const orgProfile = (load("org_profile") ?? {}) as OrgProfile;
  const documents = (load("documents") ?? []) as Array<{
    filename: string;
    doc_id?: string;
  }>;
  const frameworks = (load("applicable_frameworks") ?? []) as string[];
  const coverageStats = (load("coverage_stats") ?? {}) as CoverageStats;
  const scopeMethodology = (load("scope_and_methodology") ?? {}) as ScopeMethodology;

  // Assemble compliance matrix from domain group keys
  const matrix: MatrixRow[] = [];
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

  // Also check for a pre-assembled compliance_matrix key
  const preAssembled = load("compliance_matrix");
  if (Array.isArray(preAssembled) && matrix.length === 0) {
    matrix.push(...(preAssembled as MatrixRow[]));
  }

  const report = buildReport(
    assessmentId,
    orgProfile,
    frameworks,
    matrix,
    coverageStats,
    scopeMethodology,
    documents,
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
