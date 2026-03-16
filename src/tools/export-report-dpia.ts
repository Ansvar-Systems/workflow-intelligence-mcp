/**
 * DPIA-specific report builder.
 *
 * Assembles a GDPR Article 35 DPIA report from stored assessment state.
 * Called by export-report.ts when task_id === "dpia_assessment".
 */

// ---------------------------------------------------------------------------
// State interfaces (input shapes)
// ---------------------------------------------------------------------------

interface OrgProfile {
  name?: string;
  sector?: string;
  jurisdiction?: string;
  dpo_contact?: string;
}

interface Screening {
  outcome?: string;
  rationale?: string;
  criteria_triggered?: Array<{ criterion?: string; article?: string; description?: string }>;
  exemption_basis?: Array<{ article?: string; description?: string }>;
}

interface DpoConsultation {
  designated?: boolean;
  dpo_contact?: string;
  advice_sought?: boolean;
  advice_date?: string;
  advice_summary?: string;
  recommendation?: string;
  followed?: boolean;
  deviation_rationale?: string;
}

interface DataType {
  category?: string;
  sensitivity_flag?: string;
  source?: string;
  art9_type?: string;
  retention_period?: string;
  volume_estimate?: string;
}

interface DataSubject {
  type?: string;
  vulnerable?: boolean;
  volume_estimate?: string;
}

interface LegalBasis {
  article_6_basis?: { basis?: string; article?: string; verified?: boolean; verification_note?: string };
  article_9_condition?: { condition?: string; article?: string; applies?: boolean };
  article_10_basis?: { basis?: string; article?: string; applies?: boolean };
}

interface ProcessingDescription {
  data_types?: DataType[];
  data_subjects?: DataSubject[];
  purposes?: string[];
  legal_basis?: LegalBasis;
  processors?: Array<{ name?: string; country?: string; role?: string }>;
  international_transfers?: Array<{ destination?: string; mechanism?: string }>;
  high_risk_indicators?: Array<{ id?: number; name?: string; present?: boolean; rationale?: string }>;
  hri_count?: number;
  recommended_scope?: string;
}

interface NecessityAssessment {
  assessment_narrative?: string;
  proportionality_assessment?: string;
  alternatives_considered?: Array<{ alternative?: string; why_rejected?: string }>;
  lia_assessment?: { purpose_test?: string; necessity_test?: string; balancing_test?: string; outcome?: string };
  data_minimisation_assessment?: string;
}

interface Risk {
  id?: string;
  description?: string;
  category?: string;
  affected_rights?: Array<{ right?: string; article?: string }>;
  harm_description?: string;
  data_types_affected?: string[];
}

interface RiskAnalysisEntry {
  id?: string;
  likelihood?: string;
  likelihood_score?: number;
  likelihood_justification?: string;
  severity?: string;
  severity_score?: number;
  severity_justification?: string;
  score?: number;
}

interface RiskMatrixSummary {
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
}

interface DataSubjectViews {
  sought?: boolean;
  method?: string;
  summary?: string;
  reason_not_sought?: string;
}

interface Safeguard {
  risk_id?: string;
  measure?: string;
  type?: string;
  gdpr_article?: string;
  effort?: string;
  score_before?: number;
  score_after?: number;
  justification?: string;
}

interface ConsultationAssessment {
  consultation_required?: boolean;
  consultation_basis?: string;
  residual_high_risks?: Array<{ risk_id?: string; score_after?: number; why_still_high?: string }>;
  member_state_triggers_checked?: boolean;
  member_state_triggers?: Array<{ jurisdiction?: string; trigger?: string }>;
  processor_compliance?: Array<{ processor?: string; country?: string; art28_required?: boolean; dpa_in_place?: unknown; gap?: string }>;
  transfer_compliance?: Array<{ destination?: string; mechanism?: string; adequate?: boolean; note?: string }>;
}

interface JurisdictionFinding {
  jurisdiction_id?: string;
  expert_agent?: string;
  phase_id?: string;
  additional_requirements?: Array<{ requirement?: string; legal_reference?: string; impact?: string }>;
  source_kind?: string;
}

interface ScopeAndMethodology {
  assessment_date?: string;
  frameworks_assessed?: string[];
  documents_analyzed?: string[];
  methodology?: string;
  limitations?: string[];
  client_attestations?: string[];
}

interface Assumption {
  id?: string;
  assumption?: string;
  phase_id?: string;
  confidence_impact?: string;
}

interface ClientQuestion {
  id?: string;
  phase_id?: string;
  question?: string;
  status?: string;
  response?: string;
}

export interface DpiaReportInput {
  assessmentId: string;
  orgProfile: OrgProfile;
  screening: Screening;
  dpoConsultation: DpoConsultation;
  processingDescription: ProcessingDescription;
  necessityAssessment: NecessityAssessment;
  risks: Risk[];
  riskAnalysis: RiskAnalysisEntry[];
  riskMatrixSummary: RiskMatrixSummary;
  dataSubjectViews: DataSubjectViews;
  safeguards: Safeguard[];
  consultationAssessment: ConsultationAssessment;
  jurisdictionFindings: JurisdictionFinding[];
  scopeAndMethodology: ScopeAndMethodology;
  assumptions: Assumption[];
  clientQuestions: ClientQuestion[];
  qualityWarnings: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function riskLevel(score: number | undefined): string {
  if (!score) return "\u2014";
  if (score >= 20) return "Critical";
  if (score >= 12) return "High";
  if (score >= 6) return "Medium";
  return "Low";
}

function escMd(s: string | undefined): string {
  return (s ?? "\u2014").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

export function buildDpiaReport(input: DpiaReportInput): string {
  const {
    assessmentId,
    orgProfile,
    screening,
    dpoConsultation,
    processingDescription: pd,
    necessityAssessment: na,
    risks,
    riskAnalysis,
    riskMatrixSummary: rms,
    dataSubjectViews: dsv,
    safeguards,
    consultationAssessment: ca,
    jurisdictionFindings,
    scopeAndMethodology: sm,
    assumptions,
    clientQuestions,
    qualityWarnings,
  } = input;

  const sections: string[] = [];

  // Title
  sections.push(`# Data Protection Impact Assessment\n`);
  sections.push(`**Organisation:** ${orgProfile.name ?? assessmentId}`);
  sections.push(`**Sector:** ${orgProfile.sector ?? "\u2014"} | **Jurisdiction:** ${orgProfile.jurisdiction ?? "\u2014"}`);
  sections.push(`**Date:** ${sm.assessment_date ?? new Date().toISOString().slice(0, 10)}\n`);

  // 1. Executive Summary
  sections.push(`## 1. Executive Summary\n`);
  const totalRisks = risks.length;
  const criticalCount = rms.critical ?? 0;
  const highCount = rms.high ?? 0;
  const consultationRequired = ca.consultation_required ? "Yes" : "No";
  sections.push(
    `This DPIA assessed **${totalRisks}** risks across the processing activity. ` +
    `Risk distribution: ${criticalCount} Critical, ${highCount} High, ${rms.medium ?? 0} Medium, ${rms.low ?? 0} Low. ` +
    `DPA prior consultation ${consultationRequired.toLowerCase() === "yes" ? "is recommended" : "is not required"} under Art. 36.`,
  );
  if (dpoConsultation.recommendation) {
    sections.push(`\n**DPO Recommendation:** ${dpoConsultation.recommendation}`);
  }

  // 2. Art. 35(7) Compliance Mapping
  sections.push(`\n## 2. Art. 35(7) Compliance Mapping\n`);
  sections.push(`| Requirement | Section |`);
  sections.push(`|---|---|`);
  sections.push(`| (a) Systematic description of processing | Section 3 \u2014 Processing Description |`);
  sections.push(`| (b) Necessity and proportionality | Section 5 \u2014 Necessity & Proportionality |`);
  sections.push(`| (c) Risks to rights and freedoms | Sections 7\u20138 \u2014 Risk Register & Safeguards |`);
  sections.push(`| (d) Measures to address risks | Section 8 \u2014 Safeguards & Risk Reduction |`);

  // 3. Processing Description
  sections.push(`\n## 3. Processing Description\n`);
  sections.push(`**Purposes:** ${(pd.purposes ?? []).join("; ") || "\u2014"}\n`);

  if ((pd.data_types ?? []).length > 0) {
    sections.push(`### Data Types\n`);
    sections.push(`| Category | Sensitivity | Source | Art. 9 Type |`);
    sections.push(`|---|---|---|---|`);
    for (const dt of pd.data_types ?? []) {
      sections.push(`| ${escMd(dt.category)} | ${escMd(dt.sensitivity_flag)} | ${escMd(dt.source)} | ${escMd(dt.art9_type)} |`);
    }
  }

  if ((pd.data_subjects ?? []).length > 0) {
    sections.push(`\n### Data Subjects\n`);
    sections.push(`| Type | Vulnerable | Volume |`);
    sections.push(`|---|---|---|`);
    for (const ds of pd.data_subjects ?? []) {
      sections.push(`| ${escMd(ds.type)} | ${ds.vulnerable ? "Yes" : "No"} | ${escMd(ds.volume_estimate)} |`);
    }
  }

  // Legal basis
  sections.push(`\n### Legal Basis\n`);
  const a6 = pd.legal_basis?.article_6_basis;
  if (a6) {
    sections.push(`**Art. 6 basis:** ${a6.basis ?? "\u2014"} (${a6.article ?? "\u2014"}) \u2014 Verified: ${a6.verified ? "Yes" : "No"}`);
    if (a6.verification_note) sections.push(`\n> ${a6.verification_note}`);
  }
  const a9 = pd.legal_basis?.article_9_condition;
  if (a9?.applies) {
    sections.push(`\n**Art. 9 condition:** ${a9.condition ?? "\u2014"} (${a9.article ?? "\u2014"})`);
  }
  const a10 = pd.legal_basis?.article_10_basis;
  if (a10?.applies) {
    sections.push(`\n**Art. 10 basis:** ${a10.basis ?? "\u2014"} (${a10.article ?? "\u2014"})`);
  }

  // HRI
  if ((pd.high_risk_indicators ?? []).length > 0) {
    sections.push(`\n### High Risk Indicators (EDPB WP248)\n`);
    sections.push(`| # | Indicator | Present | Rationale |`);
    sections.push(`|---|---|---|---|`);
    for (const hri of pd.high_risk_indicators ?? []) {
      sections.push(`| ${hri.id ?? "\u2014"} | ${escMd(hri.name)} | ${hri.present ? "Yes" : "No"} | ${escMd(hri.rationale)} |`);
    }
    sections.push(`\n**HRI count:** ${pd.hri_count ?? 0} | **Recommended scope:** ${pd.recommended_scope ?? "\u2014"}`);
  }

  // Processors & transfers
  if ((pd.processors ?? []).length > 0) {
    sections.push(`\n### Processors\n`);
    sections.push(`| Name | Country | Role |`);
    sections.push(`|---|---|---|`);
    for (const p of pd.processors ?? []) {
      sections.push(`| ${escMd(p.name)} | ${escMd(p.country)} | ${escMd(p.role)} |`);
    }
  }
  if ((pd.international_transfers ?? []).length > 0) {
    sections.push(`\n### International Transfers\n`);
    sections.push(`| Destination | Mechanism |`);
    sections.push(`|---|---|`);
    for (const t of pd.international_transfers ?? []) {
      sections.push(`| ${escMd(t.destination)} | ${escMd(t.mechanism)} |`);
    }
  }

  // 4. DPO Consultation Record
  sections.push(`\n## 4. DPO Consultation Record (Art. 35(2))\n`);
  sections.push(`**DPO designated:** ${dpoConsultation.designated ? "Yes" : "No"}`);
  if (dpoConsultation.designated) {
    sections.push(`**Advice sought:** ${dpoConsultation.advice_sought ? "Yes" : "No"}`);
    if (dpoConsultation.advice_summary) {
      sections.push(`**Advice summary:** ${dpoConsultation.advice_summary}`);
    }
    sections.push(`**Recommendation followed:** ${dpoConsultation.followed ? "Yes" : "No"}`);
    if (!dpoConsultation.followed && dpoConsultation.deviation_rationale) {
      sections.push(`**Deviation rationale:** ${dpoConsultation.deviation_rationale}`);
    }
  }

  // 5. Necessity & Proportionality
  sections.push(`\n## 5. Necessity & Proportionality\n`);
  if (na.assessment_narrative) sections.push(`**Necessity:** ${na.assessment_narrative}\n`);
  if (na.proportionality_assessment) sections.push(`**Proportionality:** ${na.proportionality_assessment}\n`);
  if (na.data_minimisation_assessment) sections.push(`**Data minimisation:** ${na.data_minimisation_assessment}\n`);
  if (na.lia_assessment) {
    const lia = na.lia_assessment;
    sections.push(`### Legitimate Interests Assessment\n`);
    if (lia.purpose_test) sections.push(`**Purpose test:** ${lia.purpose_test}`);
    if (lia.necessity_test) sections.push(`**Necessity test:** ${lia.necessity_test}`);
    if (lia.balancing_test) sections.push(`**Balancing test:** ${lia.balancing_test}`);
    if (lia.outcome) sections.push(`**Outcome:** ${lia.outcome}`);
  }
  if ((na.alternatives_considered ?? []).length > 0) {
    sections.push(`\n### Alternatives Considered\n`);
    for (const alt of na.alternatives_considered ?? []) {
      sections.push(`- **${alt.alternative ?? "\u2014"}** \u2014 Rejected: ${alt.why_rejected ?? "\u2014"}`);
    }
  }

  // 6. Data Subject Views
  sections.push(`\n## 6. Data Subject Views (Art. 35(9))\n`);
  if (dsv.sought) {
    sections.push(`**Method:** ${dsv.method ?? "\u2014"}`);
    if (dsv.summary) sections.push(`**Summary:** ${dsv.summary}`);
  } else {
    sections.push(`Data subject views were not sought.`);
    if (dsv.reason_not_sought) sections.push(`**Justification:** ${dsv.reason_not_sought}`);
  }

  // 7. Risk Register
  sections.push(`\n## 7. Risk Register\n`);
  if (risks.length > 0) {
    // Build lookup for analysis scores
    const analysisMap = new Map<string, RiskAnalysisEntry>();
    for (const ra of riskAnalysis) {
      if (ra.id) analysisMap.set(ra.id, ra);
    }

    sections.push(`| ID | Description | Category | Score | Level | Rights |`);
    sections.push(`|---|---|---|---|---|---|`);
    // Sort by score descending
    const sortedRisks = [...risks].sort((a, b) => {
      const scoreA = analysisMap.get(a.id ?? "")?.score ?? 0;
      const scoreB = analysisMap.get(b.id ?? "")?.score ?? 0;
      return scoreB - scoreA;
    });
    for (const r of sortedRisks) {
      const ra = analysisMap.get(r.id ?? "");
      const rightsStr = (r.affected_rights ?? []).map((ar) => ar.article ?? ar.right ?? "").join(", ");
      sections.push(
        `| ${r.id ?? "\u2014"} | ${escMd(r.description)} | ${escMd(r.category)} | ${ra?.score ?? "\u2014"} | ${riskLevel(ra?.score)} | ${escMd(rightsStr)} |`,
      );
    }
  }

  // 8. Safeguards & Risk Reduction
  sections.push(`\n## 8. Safeguards & Risk Reduction\n`);
  if (safeguards.length > 0) {
    sections.push(`| Risk | Measure | Type | Art. | Before | After | Change |`);
    sections.push(`|---|---|---|---|---|---|---|`);
    for (const sg of safeguards) {
      const change = (typeof sg.score_before === "number" && typeof sg.score_after === "number")
        ? `${sg.score_before} \u2192 ${sg.score_after}`
        : "\u2014";
      sections.push(
        `| ${escMd(sg.risk_id)} | ${escMd(sg.measure)} | ${escMd(sg.type)} | ${escMd(sg.gdpr_article)} | ${sg.score_before ?? "\u2014"} | ${sg.score_after ?? "\u2014"} | ${change} |`,
      );
    }
  }

  // 9. DPA Consultation Assessment
  sections.push(`\n## 9. DPA Consultation Assessment (Art. 36)\n`);
  sections.push(`**Prior consultation required:** ${ca.consultation_required ? "Yes" : "No"}\n`);
  if (ca.consultation_basis) sections.push(`**Basis:** ${ca.consultation_basis}\n`);
  if ((ca.residual_high_risks ?? []).length > 0) {
    sections.push(`### Residual High Risks\n`);
    sections.push(`| Risk | Score After | Reason |`);
    sections.push(`|---|---|---|`);
    for (const rhr of ca.residual_high_risks ?? []) {
      sections.push(`| ${escMd(rhr.risk_id)} | ${rhr.score_after ?? "\u2014"} | ${escMd(rhr.why_still_high)} |`);
    }
  }
  if ((ca.processor_compliance ?? []).length > 0) {
    sections.push(`\n### Processor Compliance\n`);
    sections.push(`| Processor | Country | Art. 28 DPA | Gap |`);
    sections.push(`|---|---|---|---|`);
    for (const pc of ca.processor_compliance ?? []) {
      sections.push(`| ${escMd(pc.processor)} | ${escMd(pc.country)} | ${String(pc.dpa_in_place ?? "unknown")} | ${escMd(pc.gap)} |`);
    }
  }
  if ((ca.transfer_compliance ?? []).length > 0) {
    sections.push(`\n### Transfer Compliance\n`);
    sections.push(`| Destination | Mechanism | Adequate | Note |`);
    sections.push(`|---|---|---|---|`);
    for (const tc of ca.transfer_compliance ?? []) {
      sections.push(`| ${escMd(tc.destination)} | ${escMd(tc.mechanism)} | ${tc.adequate ? "Yes" : "No"} | ${escMd(tc.note)} |`);
    }
  }

  // 10. Jurisdiction-Specific Requirements
  if (jurisdictionFindings.length > 0) {
    sections.push(`\n## 10. Jurisdiction-Specific Requirements\n`);
    for (const jf of jurisdictionFindings) {
      sections.push(`### ${jf.jurisdiction_id ?? "Unknown"} (via ${jf.expert_agent ?? "\u2014"})\n`);
      for (const req of jf.additional_requirements ?? []) {
        sections.push(`- **${req.requirement ?? "\u2014"}** (${req.legal_reference ?? "\u2014"}): ${req.impact ?? "\u2014"}`);
      }
    }
  }

  // 11. Gaps, Assumptions & Limitations
  sections.push(`\n## 11. Gaps, Assumptions & Limitations\n`);
  const unanswered = (clientQuestions ?? []).filter(
    (q) => q.status === "pending" || q.status === "assumed",
  );
  if (unanswered.length > 0) {
    sections.push(`### Unanswered Questions\n`);
    for (const q of unanswered) {
      sections.push(`- **${q.question ?? "\u2014"}** (Phase: ${q.phase_id ?? "\u2014"}, Status: ${q.status ?? "\u2014"}${q.response ? `, Response: ${q.response}` : ""})`);
    }
  }
  if ((assumptions ?? []).length > 0) {
    sections.push(`\n### Assumptions\n`);
    for (const a of assumptions) {
      sections.push(`- **${a.assumption ?? "\u2014"}** (Phase: ${a.phase_id ?? "\u2014"}, Confidence impact: ${a.confidence_impact ?? "\u2014"})`);
    }
  }
  if ((sm.limitations ?? []).length > 0) {
    sections.push(`\n### Limitations\n`);
    for (const l of sm.limitations ?? []) {
      sections.push(`- ${l}`);
    }
  }
  if (qualityWarnings.length > 0) {
    sections.push(`\n### Quality Warnings\n`);
    for (const w of qualityWarnings) {
      sections.push(`- ${w}`);
    }
  }

  // 12. Recommendations
  sections.push(`\n## 12. Recommendations\n`);
  // Sort safeguards by score_after descending (highest residual risk first)
  const prioritized = [...safeguards]
    .filter((sg) => typeof sg.score_after === "number")
    .sort((a, b) => (b.score_after ?? 0) - (a.score_after ?? 0));
  if (prioritized.length > 0) {
    sections.push(`| Priority | Risk | Action | Residual Score |`);
    sections.push(`|---|---|---|---|`);
    prioritized.forEach((sg, i) => {
      sections.push(`| ${i + 1} | ${escMd(sg.risk_id)} | ${escMd(sg.measure)} | ${sg.score_after ?? "\u2014"} |`);
    });
  }
  if (ca.consultation_required) {
    sections.push(`\n**Action required:** Submit DPIA to supervisory authority for prior consultation under Art. 36.`);
  }

  // Footer
  sections.push(`\n---\n`);
  sections.push(`*Generated by Workflow Intelligence MCP \u2014 DPIA Assessment v1.0*`);

  return sections.join("\n");
}
