/** Export a formatted AI TARA report from stored state. */

type LooseRecord = Record<string, unknown>;

// ── Input types ───────────────────────────────────────────────────────────────

export interface AiTaraAsset extends LooseRecord {
  id: string;
  name: string;
  category?: string;
  description?: string;
  confidentiality?: string;
  integrity_criticality?: string;
  availability_requirement?: string;
}

export interface AiTaraThreat extends LooseRecord {
  id: string;
  stripe_ai_category?: string;
  category_name?: string;
  asset_id?: string;
  title: string;
  description?: string;
  attack_vector?: string;
  mcp_source?: string;
  confidence?: string;
  atlas_technique_ids?: string[];
  owasp_llm_refs?: string[];
  cwe_ids?: string[];
  capec_ids?: string[];
  mitre_attack_ids?: string[];
  agentic_concerns?: {
    tool_abuse_risk?: string;
    chain_of_thought_manipulation?: string;
    multi_agent_collusion?: string;
  };
}

export interface AiTaraImpactRow extends LooseRecord {
  threat_id: string;
  safety?: number;
  financial?: number;
  privacy?: number;
  operational?: number;
  reputational?: number;
  regulatory?: number;
  ethical?: number;
  aggregate_impact?: number;
  cascading_effects?: string;
  blast_radius?: string;
  reversibility?: string;
  detection_latency?: string;
  regulatory_flags?: Array<{ regulation?: string; article?: string; obligation?: string }>;
  rationale?: string;
}

export interface AiTaraFeasibilityRow extends LooseRecord {
  threat_id: string;
  elapsed_time?: number;
  specialist_expertise?: number;
  knowledge_of_target?: number;
  window_of_opportunity?: number;
  equipment?: number;
  detection_difficulty?: number;
  attack_potential_sum?: number;
  feasibility_rating?: string;
  published_research_available?: boolean;
  poc_tooling_available?: boolean;
  rationale?: string;
}

export interface AiTaraRiskEntry extends LooseRecord {
  threat_id: string;
  impact_level?: number;
  feasibility_rating?: string;
  risk_level?: string;
  risk_label?: string;
  ai_act_classification?: string;
  regulatory_conflict?: boolean;
  precautionary_applied?: boolean;
  treatment_required?: boolean;
  rationale?: string;
}

export interface AiTaraTreatmentEntry extends LooseRecord {
  threat_id: string;
  treatment_strategy?: string;
  controls?: Array<{
    control_name?: string;
    framework?: string;
    ai_control_category?: string;
    implementation_guidance?: string;
    implementation_priority?: string;
    mcp_source?: string;
  }>;
  residual_risk_level?: string;
  residual_risk_rationale?: string;
  acceptance_conditions?: string;
  new_risks_introduced?: string;
}

export interface AiTaraComplianceMapping extends LooseRecord {
  framework?: string;
  requirement?: string;
  tara_section?: string;
  status?: string;
}

export interface AiTaraReportInput {
  assessmentId: string;
  systemName?: string;
  systemDescription?: string;
  modelArchitecture?: LooseRecord;
  decisionChainPosition?: string;
  domainContext?: string;
  assets: AiTaraAsset[];
  threats: AiTaraThreat[];
  coverageMatrix?: Record<string, Record<string, boolean>>;
  impactMatrix: AiTaraImpactRow[];
  feasibilityRatings: AiTaraFeasibilityRow[];
  riskRegister: AiTaraRiskEntry[];
  riskMatrixSummary?: LooseRecord;
  treatmentPlan: AiTaraTreatmentEntry[];
  complianceMapping?: AiTaraComplianceMapping[];
  monitoringPlan?: { kpis?: string[]; reassessment_triggers?: string[]; review_cadence?: string };
  executiveSummary?: string;
  gaps?: Array<{ dimension?: string; description?: string; assumed_value?: string }>;
  qualityWarnings?: string[];
}

// ── Category labels ───────────────────────────────────────────────────────────

const STRIPE_AI_LABELS: Record<string, string> = {
  S: "Spoofing",
  T: "Tampering",
  R: "Repudiation",
  I: "Information Disclosure",
  P: "Poisoning",
  E: "Elevation of Privilege",
  AI: "AI-Behavior",
};

const IMPACT_LABELS = ["Negligible", "Low", "Medium", "High", "Critical"];
const RISK_LABELS: Record<string, string> = {
  R1: "Acceptable",
  R2: "Low Priority",
  R3: "Medium Priority",
  R4: "High Priority (ALARP)",
  R5: "Unacceptable",
};
const FEASIBILITY_LABELS: Record<string, string> = {
  very_high: "Very High",
  high: "High",
  medium: "Medium",
  low: "Low",
  very_low: "Very Low",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function impactLabel(v: number | undefined): string {
  if (v == null || v < 1 || v > 5) return "—";
  return IMPACT_LABELS[v - 1];
}

function esc(s: string | undefined): string {
  return (s ?? "—").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function badges(threat: AiTaraThreat): string {
  const parts: string[] = [];
  if (threat.atlas_technique_ids?.length) parts.push(`ATLAS:${threat.atlas_technique_ids.join(",")}`);
  if (threat.owasp_llm_refs?.length) parts.push(`OWASP:${threat.owasp_llm_refs.join(",")}`);
  if (threat.cwe_ids?.length) parts.push(`CWE:${threat.cwe_ids.join(",")}`);
  if (threat.mitre_attack_ids?.length) parts.push(`ATT&CK:${threat.mitre_attack_ids.join(",")}`);
  return parts.length > 0 ? parts.join(" · ") : "";
}

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildAiTaraReport(input: AiTaraReportInput): string {
  const lines: string[] = [];
  const date = new Date().toISOString().split("T")[0];

  lines.push("# AI System TARA Report");
  lines.push(`**System:** ${input.systemName ?? "Unnamed"}`);
  lines.push(`**Date:** ${date}`);
  lines.push(`**Assessment ID:** ${input.assessmentId}`);
  if (input.domainContext) lines.push(`**Domain:** ${input.domainContext}`);
  lines.push(`**Methodology:** STRIPE-AI (adapted from ISO 21434 Clause 15)`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // ── 1. Executive Summary ──────────────────────────────────────────────────

  lines.push("## 1. Executive Summary");
  lines.push("");

  if (input.executiveSummary) {
    lines.push(input.executiveSummary);
    lines.push("");
  }

  // Threat distribution by category
  const catCounts: Record<string, number> = {};
  for (const t of input.threats) {
    const cat = t.stripe_ai_category ?? "?";
    catCounts[cat] = (catCounts[cat] ?? 0) + 1;
  }
  lines.push("### Threat Distribution by STRIPE-AI Category");
  lines.push("");
  lines.push("| Category | Label | Count |");
  lines.push("|----------|-------|------:|");
  for (const cat of Object.keys(STRIPE_AI_LABELS)) {
    lines.push(`| ${cat} | ${STRIPE_AI_LABELS[cat]} | ${catCounts[cat] ?? 0} |`);
  }
  lines.push(`| **Total** | | **${input.threats.length}** |`);
  lines.push("");

  // Risk distribution
  const riskCounts: Record<string, number> = {};
  for (const r of input.riskRegister) {
    const level = r.risk_level ?? "?";
    riskCounts[level] = (riskCounts[level] ?? 0) + 1;
  }
  lines.push("### Risk Distribution");
  lines.push("");
  lines.push("| Risk Level | Label | Count |");
  lines.push("|------------|-------|------:|");
  for (const level of ["R5", "R4", "R3", "R2", "R1"]) {
    lines.push(`| ${level} | ${RISK_LABELS[level] ?? level} | ${riskCounts[level] ?? 0} |`);
  }
  lines.push("");

  // Regulatory flags summary
  const regConflicts = input.riskRegister.filter((r) => r.regulatory_conflict);
  if (regConflicts.length > 0) {
    lines.push(`**Regulatory conflicts detected:** ${regConflicts.length} threats where TARA risk level conflicts with EU AI Act classification.`);
    lines.push("");
  }

  // ── 2. AI System Model ────────────────────────────────────────────────────

  lines.push("## 2. AI System Model");
  lines.push("");
  if (input.systemDescription) {
    lines.push(input.systemDescription);
    lines.push("");
  }
  if (input.modelArchitecture) {
    lines.push("### Model Architecture");
    lines.push("");
    for (const [key, val] of Object.entries(input.modelArchitecture)) {
      if (val != null) lines.push(`- **${key}:** ${String(val)}`);
    }
    lines.push("");
  }
  if (input.decisionChainPosition) {
    lines.push(`**Decision chain position:** ${input.decisionChainPosition}`);
    lines.push("");
  }

  lines.push("### Asset Inventory");
  lines.push("");
  lines.push("| ID | Name | Category | CIA | Description |");
  lines.push("|----|------|----------|-----|-------------|");
  for (const a of input.assets) {
    const cia = [a.confidentiality, a.integrity_criticality, a.availability_requirement]
      .filter(Boolean)
      .join("/");
    lines.push(`| ${esc(a.id)} | ${esc(a.name)} | ${esc(a.category)} | ${cia || "—"} | ${esc(a.description)} |`);
  }
  lines.push("");

  // ── 3. STRIPE-AI Threat Catalog ───────────────────────────────────────────

  lines.push("## 3. STRIPE-AI Threat Catalog");
  lines.push("");

  for (const [catCode, catLabel] of Object.entries(STRIPE_AI_LABELS)) {
    const catThreats = input.threats.filter((t) => t.stripe_ai_category === catCode);
    lines.push(`### ${catCode} — ${catLabel} (${catThreats.length} threats)`);
    lines.push("");

    if (catThreats.length === 0) {
      lines.push("*No threats identified in this category.*");
      lines.push("");
      continue;
    }

    lines.push("| ID | Asset | Title | Confidence | References |");
    lines.push("|----|-------|-------|:----------:|------------|");
    for (const t of catThreats) {
      lines.push(
        `| ${esc(t.id)} | ${esc(t.asset_id)} | ${esc(t.title)} | ${t.confidence ?? "—"} | ${badges(t)} |`,
      );
    }
    lines.push("");

    // Expanded details for each threat
    for (const t of catThreats) {
      lines.push(`#### ${t.id}: ${t.title}`);
      lines.push("");
      if (t.description) lines.push(t.description);
      if (t.attack_vector) lines.push(`\n**Attack vector:** ${t.attack_vector}`);
      if (t.mcp_source) lines.push(`**Source:** ${t.mcp_source}`);
      if (t.agentic_concerns) {
        const ac = t.agentic_concerns;
        if (ac.tool_abuse_risk) lines.push(`**Tool abuse risk:** ${ac.tool_abuse_risk}`);
        if (ac.chain_of_thought_manipulation) lines.push(`**CoT manipulation:** ${ac.chain_of_thought_manipulation}`);
        if (ac.multi_agent_collusion) lines.push(`**Multi-agent collusion:** ${ac.multi_agent_collusion}`);
      }
      lines.push("");
    }
  }

  // ── 4. Impact Assessment Matrix ───────────────────────────────────────────

  lines.push("## 4. Impact Assessment Matrix");
  lines.push("");
  lines.push("Scale: 1 (Negligible), 2 (Low), 3 (Medium), 4 (High), 5 (Critical)");
  lines.push("");
  lines.push("| Threat | Safety | Financial | Privacy | Operational | Reputational | Regulatory | Ethical | Aggregate | Blast Radius |");
  lines.push("|--------|:------:|:---------:|:-------:|:-----------:|:------------:|:----------:|:-------:|:---------:|-------------|");
  for (const row of input.impactMatrix) {
    lines.push(
      `| ${esc(row.threat_id)} | ${impactLabel(row.safety)} | ${impactLabel(row.financial)} | ${impactLabel(row.privacy)} | ${impactLabel(row.operational)} | ${impactLabel(row.reputational)} | ${impactLabel(row.regulatory)} | ${impactLabel(row.ethical)} | **${impactLabel(row.aggregate_impact)}** | ${esc(row.blast_radius)} |`,
    );
  }
  lines.push("");

  // Detailed rationales for high-impact threats
  const highImpact = input.impactMatrix.filter((r) => (r.aggregate_impact ?? 0) >= 4);
  if (highImpact.length > 0) {
    lines.push("### High/Critical Impact Details");
    lines.push("");
    for (const row of highImpact) {
      lines.push(`**${row.threat_id}:** ${row.rationale ?? "No rationale provided"}`);
      if (row.cascading_effects) lines.push(`- Cascading effects: ${row.cascading_effects}`);
      if (row.reversibility) lines.push(`- Reversibility: ${row.reversibility}`);
      if (row.detection_latency) lines.push(`- Detection latency: ${row.detection_latency}`);
      if (row.regulatory_flags?.length) {
        for (const flag of row.regulatory_flags) {
          lines.push(`- Regulatory flag: ${flag.regulation ?? ""} Art. ${flag.article ?? ""} — ${flag.obligation ?? ""}`);
        }
      }
      lines.push("");
    }
  }

  // ── 5. Attack Feasibility Ratings ─────────────────────────────────────────

  lines.push("## 5. Attack Feasibility Ratings");
  lines.push("");
  lines.push("ISO 21434 Annex F attack-potential-based method (adapted for AI)");
  lines.push("");
  lines.push("| Threat | Time | Expertise | Knowledge | Window | Equipment | Detection | Sum | Rating |");
  lines.push("|--------|:----:|:---------:|:---------:|:------:|:---------:|:---------:|:---:|--------|");
  for (const row of input.feasibilityRatings) {
    lines.push(
      `| ${esc(row.threat_id)} | ${row.elapsed_time ?? "—"} | ${row.specialist_expertise ?? "—"} | ${row.knowledge_of_target ?? "—"} | ${row.window_of_opportunity ?? "—"} | ${row.equipment ?? "—"} | ${row.detection_difficulty ?? "—"} | **${row.attack_potential_sum ?? "—"}** | ${FEASIBILITY_LABELS[row.feasibility_rating ?? ""] ?? row.feasibility_rating ?? "—"} |`,
    );
  }
  lines.push("");

  // ── 6. Risk Register ──────────────────────────────────────────────────────

  lines.push("## 6. Risk Register");
  lines.push("");
  lines.push("| Threat | Impact | Feasibility | Risk Level | AI Act Class. | Treatment Required |");
  lines.push("|--------|:------:|:-----------:|:----------:|:-------------:|:------------------:|");
  for (const r of input.riskRegister) {
    const riskLabel = RISK_LABELS[r.risk_level ?? ""] ?? r.risk_level ?? "—";
    const aiAct = r.ai_act_classification ?? "—";
    const conflict = r.regulatory_conflict ? " ⚠" : "";
    const precautionary = r.precautionary_applied ? " (P)" : "";
    lines.push(
      `| ${esc(r.threat_id)} | ${r.impact_level ?? "—"} | ${FEASIBILITY_LABELS[r.feasibility_rating ?? ""] ?? "—"} | **${riskLabel}**${precautionary} | ${aiAct}${conflict} | ${r.treatment_required ? "Yes" : "No"} |`,
    );
  }
  lines.push("");
  if (regConflicts.length > 0) {
    lines.push("⚠ = TARA risk level conflicts with EU AI Act classification");
    lines.push("(P) = Precautionary principle applied");
    lines.push("");
  }

  // ── 7. Treatment Plan ─────────────────────────────────────────────────────

  lines.push("## 7. Treatment Plan");
  lines.push("");
  for (const entry of input.treatmentPlan) {
    const threat = input.threats.find((t) => t.id === entry.threat_id);
    lines.push(`### ${entry.threat_id}: ${threat?.title ?? "Unknown"}`);
    lines.push("");
    lines.push(`**Strategy:** ${entry.treatment_strategy ?? "—"}`);

    if (entry.controls?.length) {
      lines.push("");
      lines.push("| Control | Category | Framework | Priority |");
      lines.push("|---------|----------|-----------|----------|");
      for (const c of entry.controls) {
        lines.push(
          `| ${esc(c.control_name)} | ${esc(c.ai_control_category)} | ${esc(c.framework)} | ${esc(c.implementation_priority)} |`,
        );
      }
    }

    if (entry.residual_risk_level) {
      lines.push(`\n**Residual risk:** ${RISK_LABELS[entry.residual_risk_level] ?? entry.residual_risk_level}`);
    }
    if (entry.residual_risk_rationale) lines.push(`**Rationale:** ${entry.residual_risk_rationale}`);
    if (entry.acceptance_conditions) lines.push(`**Acceptance conditions:** ${entry.acceptance_conditions}`);
    if (entry.new_risks_introduced) lines.push(`**New risks introduced:** ${entry.new_risks_introduced}`);
    lines.push("");
  }

  // ── 8. Compliance Mapping ─────────────────────────────────────────────────

  lines.push("## 8. Compliance Mapping");
  lines.push("");

  if (input.complianceMapping?.length) {
    lines.push("| Framework | Requirement | TARA Section | Status |");
    lines.push("|-----------|-------------|--------------|--------|");
    for (const m of input.complianceMapping) {
      lines.push(
        `| ${esc(m.framework)} | ${esc(m.requirement)} | ${esc(m.tara_section)} | ${esc(m.status)} |`,
      );
    }
  } else {
    lines.push("*No compliance mapping generated.*");
  }
  lines.push("");

  // ── 9. Monitoring Plan ────────────────────────────────────────────────────

  lines.push("## 9. Monitoring Plan");
  lines.push("");

  if (input.monitoringPlan) {
    if (input.monitoringPlan.review_cadence) {
      lines.push(`**Review cadence:** ${input.monitoringPlan.review_cadence}`);
      lines.push("");
    }
    if (input.monitoringPlan.kpis?.length) {
      lines.push("### KPIs");
      for (const kpi of input.monitoringPlan.kpis) lines.push(`- ${kpi}`);
      lines.push("");
    }
    if (input.monitoringPlan.reassessment_triggers?.length) {
      lines.push("### Reassessment Triggers");
      for (const trigger of input.monitoringPlan.reassessment_triggers) lines.push(`- ${trigger}`);
      lines.push("");
    }
  } else {
    lines.push("*No monitoring plan generated.*");
    lines.push("");
  }

  // ── 10. Gaps and Assumptions Register ─────────────────────────────────────

  lines.push("## 10. Gaps and Assumptions Register");
  lines.push("");

  if (input.gaps?.length) {
    lines.push("| Dimension | Description | Assumed Value |");
    lines.push("|-----------|-------------|---------------|");
    for (const g of input.gaps) {
      lines.push(`| ${esc(g.dimension)} | ${esc(g.description)} | ${esc(g.assumed_value)} |`);
    }
    lines.push("");
  } else {
    lines.push("*No gaps or assumptions recorded.*");
    lines.push("");
  }

  if (input.qualityWarnings?.length) {
    lines.push("### Quality Warnings");
    for (const w of input.qualityWarnings) lines.push(`- ${w}`);
    lines.push("");
  }

  // ── Footer ────────────────────────────────────────────────────────────────

  lines.push("---");
  lines.push("");
  lines.push(`*Generated by Ansvar AI TARA — STRIPE-AI methodology adapted from ISO 21434 Clause 15*`);

  return lines.join("\n");
}
