/** Export a formatted STRIDE threat model report from stored state. */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ThreatEntry {
  id: string;
  stride_category: string;
  component_id: string;
  title: string;
  description: string;
  mcp_source?: string;
  cvss_vector?: string;
  cvss_score?: number;
  severity: string;
  confidence?: string;
  document_citations?: Array<{ document?: string; section?: string; verbatim_quote?: string; evidence_type?: string }>;
  pattern_citations?: Array<{ source?: string; pattern_id?: string; cwe_id?: string; tool_call?: string }>;
}

export interface MitigationEntry {
  threat_id: string;
  controls: Array<{
    control_id: string;
    framework: string;
    control_name: string;
    implementation_guidance?: string;
  }>;
}

export interface ComponentEntry {
  id: string;
  name: string;
  type: string;
  trust_zone?: string;
  technology?: string;
  confidence?: string;
}

export interface GapEntry {
  dimension?: string;
  phase?: string;
  description: string;
  impact?: string;
  assumption?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(s: string | undefined): string {
  if (!s) return "";
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

const STRIDE_ORDER = [
  "Spoofing",
  "Tampering",
  "Repudiation",
  "Information Disclosure",
  "Denial of Service",
  "Elevation of Privilege",
] as const;

function severityBadge(severity: string): string {
  const s = severity.toLowerCase();
  if (s === "critical") return "CRITICAL";
  if (s === "high") return "HIGH";
  if (s === "medium") return "MEDIUM";
  if (s === "low") return "LOW";
  if (s === "info" || s === "informational") return "INFO";
  return severity.toUpperCase();
}

function normalizeCategoryName(raw: string): string {
  const lower = raw.toLowerCase().replace(/[_-]/g, " ").trim();
  for (const cat of STRIDE_ORDER) {
    if (cat.toLowerCase() === lower) return cat;
  }
  // Partial match fallback
  for (const cat of STRIDE_ORDER) {
    if (lower.startsWith(cat.toLowerCase().split(" ")[0])) return cat;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

export function buildStrideReport(
  assessmentId: string,
  systemName: string,
  components: ComponentEntry[],
  threats: ThreatEntry[],
  mitigations: MitigationEntry[],
  gaps: GapEntry[],
  dfdMarkdown: string | null,
  documentsReviewed: string[],
): string {
  const lines: string[] = [];
  const date = new Date().toISOString().split("T")[0];
  const totalThreats = threats.length;

  // Title
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

  // Section 1: Scope and Limitations
  lines.push("## 1. Scope and Limitations");
  lines.push("");
  lines.push(`This threat model covers **${systemName || "the target system"}** with ${components.length} identified component(s).`);
  lines.push("");

  if (documentsReviewed.length > 0) {
    lines.push("### Documents Reviewed");
    lines.push("");
    for (const doc of documentsReviewed) {
      lines.push(`- ${doc}`);
    }
    lines.push("");
  } else {
    lines.push("No documents were submitted for review.");
    lines.push("");
  }

  if (gaps.length > 0) {
    lines.push("### Gaps and Limitations");
    lines.push("");
    lines.push("| # | Dimension / Phase | Description | Impact |");
    lines.push("|--:|-------------------|-------------|--------|");
    for (let i = 0; i < gaps.length; i++) {
      const g = gaps[i];
      const dimPhase = g.dimension || g.phase || "General";
      lines.push(
        `| ${i + 1} | ${esc(dimPhase)} | ${esc(g.description)} | ${esc(g.impact || g.assumption || "—")} |`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  // Section 2: Data Flow Diagram
  lines.push("## 2. Data Flow Diagram");
  lines.push("");

  if (dfdMarkdown && dfdMarkdown.trim().length > 0) {
    lines.push(dfdMarkdown.trim());
    lines.push("");
  } else {
    lines.push("DFD was not generated for this assessment. Run the DFD construction task to produce a data flow diagram.");
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  // Section 3: Threats by STRIDE Category
  lines.push("## 3. Threats by STRIDE Category");
  lines.push("");
  lines.push(`**${totalThreats}** threat(s) identified across ${components.length} component(s).`);
  lines.push("");

  // Build component lookup
  const componentMap = new Map<string, ComponentEntry>();
  for (const c of components) {
    componentMap.set(c.id, c);
  }

  // Group threats by normalized STRIDE category
  const threatsByCategory = new Map<string, ThreatEntry[]>();
  for (const cat of STRIDE_ORDER) {
    threatsByCategory.set(cat, []);
  }
  // Catch any threats that don't match standard categories
  const uncategorized: ThreatEntry[] = [];

  for (const t of threats) {
    const normalized = normalizeCategoryName(t.stride_category);
    const bucket = threatsByCategory.get(normalized);
    if (bucket) {
      bucket.push(t);
    } else {
      uncategorized.push(t);
    }
  }

  for (const cat of STRIDE_ORDER) {
    const catThreats = threatsByCategory.get(cat) ?? [];
    lines.push(`### ${cat} (${catThreats.length})`);
    lines.push("");

    if (catThreats.length === 0) {
      lines.push("No threats identified in this category.");
      lines.push("");
      continue;
    }

    lines.push("| ID | Component | Title | Severity | CVSS | Source |");
    lines.push("|----|-----------|-------|----------|:----:|--------|");
    for (const t of catThreats) {
      const comp = componentMap.get(t.component_id);
      const compName = comp ? comp.name : t.component_id;
      const cvss = t.cvss_score != null ? t.cvss_score.toFixed(1) : "—";
      lines.push(
        `| ${esc(t.id)} | ${esc(compName)} | ${esc(t.title)} | **${severityBadge(t.severity)}** | ${cvss} | ${esc(t.mcp_source || "—")} |`,
      );
    }
    lines.push("");
  }

  // Handle uncategorized threats
  if (uncategorized.length > 0) {
    lines.push(`### Other (${uncategorized.length})`);
    lines.push("");
    lines.push("| ID | Component | Title | Severity | CVSS | Source |");
    lines.push("|----|-----------|-------|----------|:----:|--------|");
    for (const t of uncategorized) {
      const comp = componentMap.get(t.component_id);
      const compName = comp ? comp.name : t.component_id;
      const cvss = t.cvss_score != null ? t.cvss_score.toFixed(1) : "—";
      lines.push(
        `| ${esc(t.id)} | ${esc(compName)} | ${esc(t.title)} | **${severityBadge(t.severity)}** | ${cvss} | ${esc(t.mcp_source || "—")} |`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  // Section 4: Risk Matrix
  lines.push("## 4. Risk Matrix");
  lines.push("");

  const severityCounts: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  let mcpGrounded = 0;

  for (const t of threats) {
    const s = t.severity.toLowerCase();
    if (s in severityCounts) {
      severityCounts[s]++;
    } else if (s === "informational") {
      severityCounts["info"]++;
    } else {
      // Count unknown severities under info
      severityCounts["info"]++;
    }
    if (t.mcp_source && t.mcp_source !== "llm-reasoned") {
      mcpGrounded++;
    }
  }

  lines.push("### Severity Distribution");
  lines.push("");
  lines.push("| Severity | Count | % |");
  lines.push("|----------|------:|--:|");
  lines.push(
    `| Critical | ${severityCounts["critical"]} | ${totalThreats > 0 ? ((severityCounts["critical"] / totalThreats) * 100).toFixed(1) : "0"}% |`,
  );
  lines.push(
    `| High | ${severityCounts["high"]} | ${totalThreats > 0 ? ((severityCounts["high"] / totalThreats) * 100).toFixed(1) : "0"}% |`,
  );
  lines.push(
    `| Medium | ${severityCounts["medium"]} | ${totalThreats > 0 ? ((severityCounts["medium"] / totalThreats) * 100).toFixed(1) : "0"}% |`,
  );
  lines.push(
    `| Low | ${severityCounts["low"]} | ${totalThreats > 0 ? ((severityCounts["low"] / totalThreats) * 100).toFixed(1) : "0"}% |`,
  );
  lines.push(
    `| Info | ${severityCounts["info"]} | ${totalThreats > 0 ? ((severityCounts["info"] / totalThreats) * 100).toFixed(1) : "0"}% |`,
  );
  lines.push(`| **Total** | **${totalThreats}** | **100%** |`);
  lines.push("");

  const groundedPct = totalThreats > 0 ? ((mcpGrounded / totalThreats) * 100).toFixed(1) : "0";
  lines.push(`**MCP-Grounded Threats:** ${mcpGrounded}/${totalThreats} (${groundedPct}%)`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Section 5: Mitigations
  lines.push("## 5. Mitigations");
  lines.push("");

  // Build mitigation lookup
  const mitigationMap = new Map<string, MitigationEntry>();
  for (const m of mitigations) {
    mitigationMap.set(m.threat_id, m);
  }

  // Filter to high and critical threats
  const highCritThreats = threats.filter((t) => {
    const s = t.severity.toLowerCase();
    return s === "critical" || s === "high";
  });

  if (highCritThreats.length === 0) {
    lines.push("No high or critical threats identified. Mitigations for lower-severity threats are recommended but not detailed here.");
    lines.push("");
  } else {
    lines.push(`Mapped controls for **${highCritThreats.length}** high/critical threat(s):`);
    lines.push("");

    for (const t of highCritThreats) {
      lines.push(`### ${esc(t.id)}: ${esc(t.title)}`);
      lines.push("");
      lines.push(`**Severity:** ${severityBadge(t.severity)} | **Component:** ${esc(componentMap.get(t.component_id)?.name || t.component_id)} | **Category:** ${normalizeCategoryName(t.stride_category)}`);
      lines.push("");

      const mit = mitigationMap.get(t.id);
      if (mit && mit.controls.length > 0) {
        lines.push("| Control ID | Framework | Control | Guidance |");
        lines.push("|------------|-----------|---------|----------|");
        for (const c of mit.controls) {
          lines.push(
            `| ${esc(c.control_id)} | ${esc(c.framework)} | ${esc(c.control_name)} | ${esc(c.implementation_guidance || "—")} |`,
          );
        }
        lines.push("");
      } else {
        lines.push("No mapped controls. Manual mitigation planning required.");
        lines.push("");
      }
    }
  }

  lines.push("---");
  lines.push("");

  // Section 6: Gaps and Assumptions Register
  lines.push("## 6. Gaps and Assumptions Register");
  lines.push("");

  if (gaps.length === 0) {
    lines.push("No gaps or assumptions recorded.");
    lines.push("");
  } else {
    lines.push("| # | Dimension / Phase | Description | Impact / Assumption |");
    lines.push("|--:|-------------------|-------------|---------------------|");
    for (let i = 0; i < gaps.length; i++) {
      const g = gaps[i];
      const dimPhase = g.dimension || g.phase || "General";
      const impactAssumption = g.impact || g.assumption || "—";
      lines.push(
        `| ${i + 1} | ${esc(dimPhase)} | ${esc(g.description)} | ${esc(impactAssumption)} |`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  // Footer
  lines.push("*Report generated by Ansvar STRIDE Threat Model Engine v1.0*");

  return lines.join("\n");
}
