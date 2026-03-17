/**
 * TPRM-specific report builders.
 *
 * Assembles vendor risk triage and full assessment reports from stored state.
 * Called by export-report.ts when task_id matches vendor_risk_triage or
 * vendor_risk_assessment.
 */

// ---------------------------------------------------------------------------
// Markdown escape helper
// ---------------------------------------------------------------------------

function esc(s: string | undefined): string {
  return (s ?? "\u2014").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

// ---------------------------------------------------------------------------
// Shared interfaces
// ---------------------------------------------------------------------------

interface VendorProfile {
  name?: string;
  legal_name?: string;
  lei?: string;
  lei_status?: string;
  sanctions_status?: string;
  sanctions_details?: string;
  country?: string;
  sector?: string;
  service_description?: string;
  certifications?: string[];
  breach_history?: Array<{
    date?: string;
    description?: string;
    severity?: string;
    source?: string;
  }>;
  cve_exposure?: {
    cpe_identifiers?: string[];
    critical_cves?: number;
    high_cves?: number;
    total_cves?: number;
    last_checked?: string;
  };
  financial_indicators?: {
    revenue_range?: string;
    employee_count?: string;
    year_founded?: string;
    publicly_traded?: boolean;
  };
}

interface DocumentRef {
  doc_id?: string;
  filename?: string;
  sections_count?: number;
  document_type?: string;
}

interface OrgProfile {
  name?: string;
  sector?: string;
  jurisdiction?: string;
}

// ---------------------------------------------------------------------------
// Triage interfaces
// ---------------------------------------------------------------------------

interface SignalSource {
  source?: string;
  signal_type?: string;
  finding?: string;
  confidence?: string;
  status?: string;
}

interface KeyConcern {
  concern?: string;
  severity?: string;
  source?: string;
  remediable?: boolean;
}

interface RiskProfile {
  signal_sources?: SignalSource[];
  security_posture_summary?: string;
  key_concerns?: KeyConcern[];
}

interface RiskClassification {
  tier?: string;
  dimension_scores?: Record<string, number | string>;
  rationale?: string;
}

interface Condition {
  condition?: string;
  deadline?: string;
  priority?: string;
}

interface BlockingFinding {
  finding?: string;
  source?: string;
  severity?: string;
}

interface Recommendation {
  decision?: string;
  rationale?: string;
  conditions?: Condition[];
  blocking_findings?: BlockingFinding[];
  monitoring_cadence?: string;
}

export interface TprmTriageReportInput {
  assessmentId: string;
  vendorProfile: VendorProfile;
  riskProfile: RiskProfile;
  riskClassification: RiskClassification;
  recommendation: Recommendation;
  documents: DocumentRef[];
}

// ---------------------------------------------------------------------------
// Assessment interfaces
// ---------------------------------------------------------------------------

interface DetectedAuthority {
  authority_id?: string;
  authority_type?: string;
  authority_title?: string;
  detection_signals?: string[];
  confidence?: string;
  sub_processor_relevant?: boolean;
}

interface Questionnaire {
  framework_sources?: string[];
  total_questions?: number;
  sections?: Array<{
    domain?: string;
    questions?: Array<{ requirement_id?: string; requirement_text?: string }>;
  }>;
}

interface EvidenceRef {
  doc_id?: string;
  section_ref?: string;
  filename?: string;
  verbatim_quote?: string;
  evidence_type?: string;
}

interface ExternalValidation {
  source?: string;
  finding?: string;
  corroborates?: boolean;
}

interface FindingsRegisterEntry {
  domain?: string;
  requirement_id?: string;
  requirement_text?: string;
  framework_ref?: string;
  source_kind?: string;
  source_ref?: string;
  vendor_response?: string;
  verdict?: string;
  evidence_refs?: EvidenceRef[];
  external_validation?: ExternalValidation;
  gap_description?: string;
  remediation_requirement?: string;
  risk_impact?: string;
  confidence?: string;
  sub_processor_relevant?: boolean;
  language?: string;
}

interface DomainScore {
  tier?: string;
  score?: number;
  weight?: number;
  total_entries?: number;
  denominator_count?: number;
  adequate_count?: number;
  partially_adequate_count?: number;
  inadequate_count?: number;
  not_addressed_count?: number;
  not_applicable_count?: number;
  requires_verification_count?: number;
}

interface OverallScore {
  tier?: string;
  weighted_score?: number;
  worst_domain?: string;
  concentration_risk_flag?: boolean;
}

interface ExternalValidationRecord {
  source?: string;
  finding?: string;
  corroborates?: boolean;
  related_requirement_id?: string;
  fidelity?: string;
}

interface ExpertUsed {
  agent_id?: string;
  display_name?: string;
  authority_ids?: string[];
  status?: string;
  entries_count?: number;
}

interface ScopeAndMethodology {
  assessment_date?: string;
  frameworks_assessed?: string[];
  documents_analyzed?: string[];
  experts_consulted?: string[];
  external_sources_used?: string[];
  methodology?: string;
  limitations?: string[];
}

export interface TprmAssessmentReportInput {
  assessmentId: string;
  vendorProfile: VendorProfile;
  orgProfile: OrgProfile;
  documents: DocumentRef[];
  detectedAuthorities: DetectedAuthority[];
  questionnaire: Questionnaire;
  findingsRegister: FindingsRegisterEntry[];
  domainScores: Record<string, DomainScore>;
  overallScore: OverallScore;
  externalValidations: ExternalValidationRecord[];
  expertsUsed: ExpertUsed[];
  supersededEntries: FindingsRegisterEntry[];
  scopeAndMethodology: ScopeAndMethodology;
}

// ---------------------------------------------------------------------------
// Triage report builder
// ---------------------------------------------------------------------------

export function buildTprmTriageReport(input: TprmTriageReportInput): string {
  const {
    vendorProfile: vp,
    riskProfile: rp,
    riskClassification: rc,
    recommendation: rec,
    documents,
  } = input;

  const sections: string[] = [];

  // 1. Title
  sections.push(`# Vendor Risk Profile \u2014 ${vp.name ?? input.assessmentId}\n`);

  // 2. Entity Verification
  sections.push(`## Entity Verification\n`);
  sections.push(`| Field | Value |`);
  sections.push(`|---|---|`);
  sections.push(`| Legal Name | ${esc(vp.legal_name ?? vp.name)} |`);
  sections.push(`| LEI | ${esc(vp.lei)} |`);
  sections.push(`| LEI Status | ${esc(vp.lei_status)} |`);
  sections.push(`| Sanctions Status | ${esc(vp.sanctions_status)} |`);
  if (vp.sanctions_details) {
    sections.push(`| Sanctions Details | ${esc(vp.sanctions_details)} |`);
  }
  sections.push(`| Country | ${esc(vp.country)} |`);
  if (vp.sector) {
    sections.push(`| Sector | ${esc(vp.sector)} |`);
  }
  if (vp.service_description) {
    sections.push(`| Service Description | ${esc(vp.service_description)} |`);
  }
  if (documents.length > 0) {
    sections.push(`| Documents Reviewed | ${documents.length} |`);
  }

  // 3. Risk Profile Summary
  sections.push(`\n## Risk Profile Summary\n`);
  const sources = rp.signal_sources ?? [];
  if (sources.length > 0) {
    sections.push(`### Signal Sources\n`);
    sections.push(`| Source | Type | Finding | Confidence |`);
    sections.push(`|---|---|---|---|`);
    for (const s of sources) {
      sections.push(`| ${esc(s.source)} | ${esc(s.signal_type ?? s.status)} | ${esc(s.finding)} | ${esc(s.confidence)} |`);
    }
  }
  if (rp.security_posture_summary) {
    sections.push(`\n**Security Posture:** ${rp.security_posture_summary}`);
  }
  const concerns = rp.key_concerns ?? [];
  if (concerns.length > 0) {
    sections.push(`\n### Key Concerns\n`);
    for (const c of concerns) {
      const remediable = c.remediable != null ? (c.remediable ? " (remediable)" : " (not remediable)") : "";
      sections.push(`- **${esc(c.concern)}** \u2014 Severity: ${c.severity ?? "\u2014"}, Source: ${c.source ?? "\u2014"}${remediable}`);
    }
  }

  // 4. Risk Classification
  sections.push(`\n## Risk Classification\n`);
  sections.push(`**Tier:** ${rc.tier ?? "\u2014"}\n`);
  const dims = rc.dimension_scores ?? {};
  const dimKeys = Object.keys(dims);
  if (dimKeys.length > 0) {
    sections.push(`| Dimension | Score |`);
    sections.push(`|---|---|`);
    for (const key of dimKeys) {
      sections.push(`| ${esc(key.replace(/_/g, " "))} | ${dims[key] ?? "\u2014"} |`);
    }
  }
  if (rc.rationale) {
    sections.push(`\n**Rationale:** ${rc.rationale}`);
  }

  // 5. Recommendation
  sections.push(`\n## Recommendation\n`);
  sections.push(`**Decision:** ${rec.decision ?? "\u2014"}\n`);
  if (rec.rationale) {
    sections.push(`**Rationale:** ${rec.rationale}\n`);
  }
  if (rec.monitoring_cadence) {
    sections.push(`**Monitoring Cadence:** ${rec.monitoring_cadence.replace(/_/g, " ")}\n`);
  }
  const conditions = rec.conditions ?? [];
  if (conditions.length > 0) {
    sections.push(`### Conditions\n`);
    for (const cond of conditions) {
      const deadline = cond.deadline ? ` (deadline: ${cond.deadline})` : "";
      const priority = cond.priority ? ` [${cond.priority}]` : "";
      sections.push(`- ${esc(cond.condition)}${deadline}${priority}`);
    }
  }
  const blocking = rec.blocking_findings ?? [];
  if (blocking.length > 0) {
    sections.push(`\n### Blocking Findings\n`);
    for (const bf of blocking) {
      sections.push(`- **${esc(bf.finding)}** \u2014 Source: ${bf.source ?? "\u2014"}, Severity: ${bf.severity ?? "\u2014"}`);
    }
  }

  // Footer
  sections.push(`\n---\n`);
  sections.push(`*Generated by Workflow Intelligence MCP \u2014 Vendor Risk Triage v1.0*`);

  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Assessment report builder
// ---------------------------------------------------------------------------

export function buildTprmAssessmentReport(input: TprmAssessmentReportInput): string {
  const {
    assessmentId,
    vendorProfile: vp,
    orgProfile: op,
    documents,
    detectedAuthorities,
    questionnaire,
    findingsRegister,
    domainScores,
    overallScore,
    externalValidations,
    expertsUsed,
    supersededEntries,
    scopeAndMethodology: sm,
  } = input;

  const sections: string[] = [];
  const date = sm.assessment_date ?? new Date().toISOString().slice(0, 10);

  // Title
  sections.push(`# Vendor Risk Assessment \u2014 ${vp.name ?? assessmentId}\n`);
  sections.push(`**Assessing Organisation:** ${op.name ?? "\u2014"}`);
  sections.push(`**Assessment Date:** ${date}`);
  sections.push(`**Assessment ID:** ${assessmentId}\n`);

  // 1. Executive Summary
  sections.push(`## 1. Executive Summary\n`);
  sections.push(`**Overall Risk Tier:** ${overallScore.tier ?? "\u2014"}`);
  sections.push(`**Weighted Score:** ${overallScore.weighted_score != null ? overallScore.weighted_score.toFixed(2) : "\u2014"}`);
  sections.push(`**Worst Domain:** ${esc(overallScore.worst_domain)}\n`);

  const criticalFindings = findingsRegister.filter(
    (f) => f.risk_impact === "critical" || f.verdict === "inadequate",
  );
  sections.push(`**Critical Findings:** ${criticalFindings.length}`);
  sections.push(`**Total Findings:** ${findingsRegister.length}\n`);

  // Per-domain key metrics summary
  const domainKeys = Object.keys(domainScores);
  if (domainKeys.length > 0) {
    sections.push(`| Domain | Tier | Score |`);
    sections.push(`|---|---|---|`);
    for (const dk of domainKeys) {
      const ds = domainScores[dk];
      sections.push(`| ${esc(dk.replace(/_/g, " "))} | ${ds.tier ?? "\u2014"} | ${ds.score != null ? ds.score.toFixed(2) : "\u2014"} |`);
    }
    sections.push(``);
  }

  // 2. Vendor Profile
  sections.push(`## 2. Vendor Profile\n`);
  sections.push(`### Entity Verification\n`);
  sections.push(`| Field | Value |`);
  sections.push(`|---|---|`);
  sections.push(`| Name | ${esc(vp.name)} |`);
  if (vp.legal_name) sections.push(`| Legal Name | ${esc(vp.legal_name)} |`);
  sections.push(`| LEI Status | ${esc(vp.lei_status)} |`);
  sections.push(`| Sanctions Status | ${esc(vp.sanctions_status)} |`);
  if (vp.country) sections.push(`| Country | ${esc(vp.country)} |`);
  if (vp.sector) sections.push(`| Sector | ${esc(vp.sector)} |`);

  // Certifications
  const certs = vp.certifications ?? [];
  if (certs.length > 0) {
    sections.push(`\n### Certifications\n`);
    sections.push(`| Certification |`);
    sections.push(`|---|`);
    for (const cert of certs) {
      sections.push(`| ${esc(cert)} |`);
    }
  }

  // Breach History
  const breaches = vp.breach_history ?? [];
  if (breaches.length > 0) {
    sections.push(`\n### Breach History\n`);
    sections.push(`| Date | Description | Severity | Source |`);
    sections.push(`|---|---|---|---|`);
    for (const b of breaches) {
      sections.push(`| ${esc(b.date)} | ${esc(b.description)} | ${esc(b.severity)} | ${esc(b.source)} |`);
    }
  }

  // Financial Indicators
  const fi = vp.financial_indicators;
  if (fi) {
    sections.push(`\n### Financial Indicators\n`);
    sections.push(`| Indicator | Value |`);
    sections.push(`|---|---|`);
    if (fi.revenue_range) sections.push(`| Revenue Range | ${esc(fi.revenue_range)} |`);
    if (fi.employee_count) sections.push(`| Employee Count | ${esc(fi.employee_count)} |`);
    if (fi.year_founded) sections.push(`| Year Founded | ${esc(fi.year_founded)} |`);
    if (fi.publicly_traded != null) sections.push(`| Publicly Traded | ${fi.publicly_traded ? "Yes" : "No"} |`);
  }

  // 3. Scope & Methodology
  sections.push(`\n## 3. Scope & Methodology\n`);
  sections.push(`**Date:** ${date}`);
  if (sm.methodology) {
    sections.push(`**Methodology:** ${sm.methodology}`);
  }

  if (detectedAuthorities.length > 0) {
    sections.push(`\n### Authorities Assessed\n`);
    sections.push(`| Authority | Type | Confidence |`);
    sections.push(`|---|---|---|`);
    for (const auth of detectedAuthorities) {
      sections.push(`| ${esc(auth.authority_title ?? auth.authority_id)} | ${esc(auth.authority_type)} | ${esc(auth.confidence)} |`);
    }
  }

  const fwAssessed = sm.frameworks_assessed ?? [];
  if (fwAssessed.length > 0) {
    sections.push(`\n**Frameworks:** ${fwAssessed.join(", ")}`);
  }

  if (documents.length > 0) {
    sections.push(`\n### Documents Analyzed\n`);
    sections.push(`| Filename | Type |`);
    sections.push(`|---|---|`);
    for (const doc of documents) {
      sections.push(`| ${esc(doc.filename)} | ${esc(doc.document_type)} |`);
    }
  }

  if (expertsUsed.length > 0) {
    sections.push(`\n### Experts Consulted\n`);
    sections.push(`| Expert | Status | Entries |`);
    sections.push(`|---|---|---|`);
    for (const e of expertsUsed) {
      sections.push(`| ${esc(e.display_name ?? e.agent_id)} | ${esc(e.status)} | ${e.entries_count ?? "\u2014"} |`);
    }
  }

  const limitations = sm.limitations ?? [];
  if (limitations.length > 0) {
    sections.push(`\n### Limitations\n`);
    for (const lim of limitations) {
      sections.push(`- ${lim}`);
    }
  }

  // 4. Assessment Questionnaire
  sections.push(`\n## 4. Assessment Questionnaire\n`);
  const fwSources = questionnaire.framework_sources ?? [];
  sections.push(`**Framework Sources:** ${fwSources.length > 0 ? fwSources.join(", ") : "\u2014"}`);
  sections.push(`**Total Questions:** ${questionnaire.total_questions ?? "\u2014"}\n`);
  const qSections = questionnaire.sections ?? [];
  if (qSections.length > 0) {
    sections.push(`| Domain | Questions |`);
    sections.push(`|---|---|`);
    for (const qs of qSections) {
      sections.push(`| ${esc(qs.domain?.replace(/_/g, " "))} | ${qs.questions?.length ?? 0} |`);
    }
  }

  // 5. Findings Register
  sections.push(`\n## 5. Findings Register\n`);
  if (findingsRegister.length > 0) {
    sections.push(`| Domain | Req ID | Framework Ref | Verdict | Confidence | Evidence | External Validation | Gap | Remediation |`);
    sections.push(`|---|---|---|---|---|---|---|---|---|`);
    for (const f of findingsRegister) {
      const evidenceSummary = (f.evidence_refs ?? []).length > 0
        ? (f.evidence_refs ?? []).map((e) => e.section_ref ?? e.doc_id ?? "").join(", ")
        : "\u2014";
      const extVal = f.external_validation
        ? `${f.external_validation.source ?? ""}: ${f.external_validation.corroborates ? "corroborates" : "contradicts"}`
        : "\u2014";
      sections.push(
        `| ${esc(f.domain?.replace(/_/g, " "))} | ${esc(f.requirement_id)} | ${esc(f.framework_ref)} | **${f.verdict ?? "\u2014"}** | ${esc(f.confidence)} | ${esc(evidenceSummary)} | ${esc(extVal)} | ${esc(f.gap_description)} | ${esc(f.remediation_requirement)} |`,
      );
    }
  } else {
    sections.push(`No findings recorded.`);
  }

  // 6. Domain Risk Scores
  sections.push(`\n## 6. Domain Risk Scores\n`);
  if (domainKeys.length > 0) {
    sections.push(`| Domain | Tier | Score | Weight | Adequate | Partial | Inadequate | Not Addressed | Requires Verification |`);
    sections.push(`|---|---|---|---|---|---|---|---|---|`);
    for (const dk of domainKeys) {
      const ds = domainScores[dk];
      sections.push(
        `| ${esc(dk.replace(/_/g, " "))} | ${ds.tier ?? "\u2014"} | ${ds.score != null ? ds.score.toFixed(2) : "\u2014"} | ${ds.weight != null ? ds.weight.toFixed(1) : "\u2014"} | ${ds.adequate_count ?? 0} | ${ds.partially_adequate_count ?? 0} | ${ds.inadequate_count ?? 0} | ${ds.not_addressed_count ?? 0} | ${ds.requires_verification_count ?? 0} |`,
      );
    }
  }

  // 7. Overall Vendor Risk Score
  sections.push(`\n## 7. Overall Vendor Risk Score\n`);
  sections.push(`**Tier:** ${overallScore.tier ?? "\u2014"}`);
  sections.push(`**Weighted Score:** ${overallScore.weighted_score != null ? overallScore.weighted_score.toFixed(2) : "\u2014"}`);
  sections.push(`**Worst Domain:** ${esc(overallScore.worst_domain)}`);
  if (overallScore.concentration_risk_flag) {
    sections.push(`**Concentration Risk:** Flagged \u2014 vendor provides services to >30% of critical functions.`);
  }

  // 8. Remediation Requirements
  const remediationEntries = findingsRegister
    .filter((f) => f.verdict === "inadequate" || f.verdict === "not_addressed")
    .sort((a, b) => {
      const impactOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (impactOrder[a.risk_impact ?? "low"] ?? 4) - (impactOrder[b.risk_impact ?? "low"] ?? 4);
    });

  sections.push(`\n## 8. Remediation Requirements\n`);
  if (remediationEntries.length > 0) {
    sections.push(`| # | Domain | Req ID | Risk Impact | Gap | Remediation |`);
    sections.push(`|---|---|---|---|---|---|`);
    remediationEntries.forEach((f, i) => {
      sections.push(
        `| ${i + 1} | ${esc(f.domain?.replace(/_/g, " "))} | ${esc(f.requirement_id)} | ${esc(f.risk_impact)} | ${esc(f.gap_description)} | ${esc(f.remediation_requirement)} |`,
      );
    });
  } else {
    sections.push(`No remediation requirements \u2014 all assessed requirements are adequate or partially adequate.`);
  }

  // 9. Contractual Requirements Checklist
  const doraDetected = detectedAuthorities.some(
    (a) => (a.authority_id ?? "").toUpperCase().includes("DORA"),
  );
  const gdprDetected = detectedAuthorities.some(
    (a) => (a.authority_id ?? "").toUpperCase().includes("GDPR"),
  );
  if (doraDetected || gdprDetected) {
    sections.push(`\n## 9. Contractual Requirements Checklist\n`);
    if (doraDetected) {
      sections.push(`### DORA Art. 30 \u2014 Key Contractual Provisions\n`);
      sections.push(`- [ ] Description of ICT services and functions`);
      sections.push(`- [ ] Locations of data processing and storage`);
      sections.push(`- [ ] Data protection provisions`);
      sections.push(`- [ ] Service level descriptions with quantitative targets`);
      sections.push(`- [ ] Reporting obligations for material incidents`);
      sections.push(`- [ ] Business continuity and disaster recovery requirements`);
      sections.push(`- [ ] Audit and access rights`);
      sections.push(`- [ ] Termination and exit provisions`);
      sections.push(`- [ ] Sub-contracting conditions (Art. 29)`);
    }
    if (gdprDetected) {
      sections.push(`${doraDetected ? "\n" : ""}### GDPR Art. 28 \u2014 Processor Requirements\n`);
      sections.push(`- [ ] Process personal data only on documented instructions`);
      sections.push(`- [ ] Confidentiality obligations for processing personnel`);
      sections.push(`- [ ] Technical and organisational security measures`);
      sections.push(`- [ ] Sub-processor engagement conditions (Art. 28(2))`);
      sections.push(`- [ ] Assistance with data subject rights`);
      sections.push(`- [ ] Assistance with DPIA and prior consultation`);
      sections.push(`- [ ] Deletion or return of data upon termination`);
      sections.push(`- [ ] Audit and inspection cooperation`);
    }
  }

  // 10. Monitoring Recommendations
  sections.push(`\n## 10. Monitoring Recommendations\n`);
  const cadence = overallScore.tier === "critical"
    ? "quarterly"
    : overallScore.tier === "high"
      ? "semi-annual"
      : "annual";
  sections.push(`**Recommended Review Cadence:** ${cadence}\n`);
  sections.push(`### Re-assessment Triggers\n`);
  sections.push(`- Material change in vendor services or data processing scope`);
  sections.push(`- Security incident or data breach involving the vendor`);
  sections.push(`- Change in vendor ownership, financial distress, or M&A activity`);
  sections.push(`- Regulatory change affecting the vendor relationship`);
  sections.push(`- Expiry of certifications (ISO 27001, SOC 2)`);
  if (overallScore.concentration_risk_flag) {
    sections.push(`- Concentration risk mitigation progress review`);
  }

  // 11. Framework-Specific Annexes
  if (doraDetected) {
    sections.push(`\n## 11. Framework-Specific Annexes\n`);
    sections.push(`### DORA Register of Information Fields\n`);
    sections.push(`| Field | Value |`);
    sections.push(`|---|---|`);
    sections.push(`| Vendor Name | ${esc(vp.name)} |`);
    sections.push(`| LEI | ${esc(vp.lei)} |`);
    sections.push(`| Country | ${esc(vp.country)} |`);
    sections.push(`| Service Description | ${esc(vp.service_description)} |`);
    sections.push(`| Risk Tier | ${overallScore.tier ?? "\u2014"} |`);
    sections.push(`| Certifications | ${certs.length > 0 ? certs.join(", ") : "\u2014"} |`);
    sections.push(`| Sub-processor Relevant | ${findingsRegister.some((f) => f.sub_processor_relevant) ? "Yes" : "No"} |`);
  }

  // 12. Assumptions & Limitations
  sections.push(`\n## 12. Assumptions & Limitations\n`);
  if (limitations.length > 0) {
    sections.push(`### Limitations\n`);
    for (const lim of limitations) {
      sections.push(`- ${lim}`);
    }
  }

  // External validations summary
  if (externalValidations.length > 0) {
    sections.push(`\n### External Validations\n`);
    sections.push(`| Source | Finding | Corroborates | Fidelity |`);
    sections.push(`|---|---|---|---|`);
    for (const ev of externalValidations) {
      sections.push(`| ${esc(ev.source)} | ${esc(ev.finding)} | ${ev.corroborates ? "Yes" : "No"} | ${esc(ev.fidelity)} |`);
    }
  }

  // Superseded entries note
  if (supersededEntries.length > 0) {
    sections.push(`\n### Superseded Entries\n`);
    sections.push(`${supersededEntries.length} baseline entries were superseded by expert-challenged findings during Phase 4.`);
  }

  sections.push(`\nThis assessment is based on document review, automated tool checks, and expert delegation. It does not include on-site audits or interviews unless explicitly noted.`);

  // Footer
  sections.push(`\n---\n`);
  sections.push(`*Generated by Workflow Intelligence MCP \u2014 Vendor Risk Assessment v1.0*`);

  return sections.join("\n");
}
