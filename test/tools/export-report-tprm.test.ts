import { describe, it, expect } from "vitest";
import { buildTprmTriageReport, buildTprmAssessmentReport } from "../../src/tools/export-report-tprm.js";

describe("TPRM triage report builder", () => {
  it("produces markdown with vendor name and recommendation", () => {
    const report = buildTprmTriageReport({
      assessmentId: "test-triage-001",
      vendorProfile: {
        name: "CloudVendor AB",
        lei_status: "verified",
        sanctions_status: "cleared",
        country: "SE",
      },
      riskProfile: {
        signal_sources: [{ source: "vendor_intelligence", status: "available" }],
        key_concerns: [],
      },
      riskClassification: {
        tier: "standard",
        dimension_scores: { data_sensitivity: "medium", business_criticality: "medium" },
        rationale: "Standard-tier vendor with adequate security posture.",
      },
      recommendation: { decision: "go", rationale: "Vendor passes all screening criteria." },
      documents: [],
    });
    expect(report).toContain("CloudVendor AB");
    expect(report).toContain("Vendor Risk Profile");
    expect(report).toContain("go");
    expect(report).toContain("standard");
  });

  it("includes blocking findings for no-go decisions", () => {
    const report = buildTprmTriageReport({
      assessmentId: "test-triage-002",
      vendorProfile: {
        name: "SanctionedCorp",
        lei_status: "not_found",
        sanctions_status: "match",
        sanctions_details: "OFAC SDN list match",
        country: "IR",
      },
      riskProfile: {
        signal_sources: [{ source: "sanctions-mcp", signal_type: "sanctions", finding: "OFAC match", confidence: "high" }],
        key_concerns: [{ concern: "Active sanctions match", severity: "critical", source: "sanctions-mcp", remediable: false }],
      },
      riskClassification: {
        tier: "critical",
        dimension_scores: { data_sensitivity: 5, regulatory_exposure: 5 },
        rationale: "Vendor is on sanctions list. No engagement permitted.",
      },
      recommendation: {
        decision: "no_go",
        rationale: "Vendor has an active sanctions match. Engagement is legally prohibited.",
        blocking_findings: [{ finding: "OFAC SDN list match", source: "sanctions-mcp", severity: "critical" }],
      },
      documents: [],
    });
    expect(report).toContain("no_go");
    expect(report).toContain("Blocking Findings");
    expect(report).toContain("OFAC SDN list match");
    expect(report).toContain("critical");
  });

  it("includes conditions for conditional decisions", () => {
    const report = buildTprmTriageReport({
      assessmentId: "test-triage-003",
      vendorProfile: { name: "ConditionalVendor Ltd", lei_status: "active", sanctions_status: "clear", country: "DE" },
      riskProfile: { signal_sources: [], key_concerns: [{ concern: "No SOC 2 report", severity: "high", remediable: true }] },
      riskClassification: { tier: "standard", dimension_scores: {}, rationale: "Standard tier but missing certification evidence." },
      recommendation: {
        decision: "conditional",
        rationale: "Vendor meets baseline requirements but must provide SOC 2 report before full engagement.",
        conditions: [{ condition: "Provide SOC 2 Type II report", deadline: "2026-06-30", priority: "high" }],
        monitoring_cadence: "semi_annual",
      },
      documents: [],
    });
    expect(report).toContain("conditional");
    expect(report).toContain("Conditions");
    expect(report).toContain("SOC 2 Type II");
    expect(report).toContain("2026-06-30");
    expect(report).toContain("semi annual");
  });

  it("handles empty state gracefully", () => {
    const report = buildTprmTriageReport({
      assessmentId: "empty-triage",
      vendorProfile: {},
      riskProfile: {},
      riskClassification: {},
      recommendation: {},
      documents: [],
    });
    expect(report).toContain("Vendor Risk Profile");
    expect(report).not.toThrow;
  });
});

describe("TPRM assessment report builder", () => {
  it("produces markdown with findings register and domain scores", () => {
    const report = buildTprmAssessmentReport({
      assessmentId: "test-assessment-001",
      vendorProfile: { name: "CloudVendor AB", lei_status: "verified", sanctions_status: "cleared" },
      orgProfile: { name: "Test Corp" },
      documents: [{ doc_id: "doc-1", filename: "policy.pdf" }],
      detectedAuthorities: [{ authority_id: "ISO_27001", authority_type: "standard", authority_title: "ISO/IEC 27001:2022" }],
      questionnaire: { framework_sources: ["ISO_27001"], total_questions: 10 },
      findingsRegister: [{
        domain: "information_security",
        requirement_id: "IS-001",
        requirement_text: "Access control",
        framework_ref: "A.5.15",
        source_kind: "document_extracted",
        verdict: "adequate",
        confidence: "high",
        evidence_refs: [{ doc_id: "doc-1", section_ref: "4.2", verbatim_quote: "MFA required" }],
      }],
      domainScores: {
        information_security: { tier: "low", score: 1.0, weight: 1.0, total_entries: 1, denominator_count: 1, adequate_count: 1, partially_adequate_count: 0, inadequate_count: 0, not_addressed_count: 0, not_applicable_count: 0, requires_verification_count: 0 },
      },
      overallScore: { tier: "low", weighted_score: 1.0, worst_domain: "information_security" },
      externalValidations: [],
      expertsUsed: [],
      supersededEntries: [],
      scopeAndMethodology: { assessment_date: "2026-03-17", frameworks_assessed: ["ISO 27001"], methodology: "Document-based" },
    });
    expect(report).toContain("Vendor Risk Assessment");
    expect(report).toContain("CloudVendor AB");
    expect(report).toContain("Findings Register");
    expect(report).toContain("Domain Risk Scores");
    expect(report).toContain("IS-001");
    expect(report).toContain("information_security");
  });

  it("includes DORA contractual checklist when DORA detected", () => {
    const report = buildTprmAssessmentReport({
      assessmentId: "test-assessment-dora",
      vendorProfile: { name: "ICT Provider GmbH", lei_status: "active", sanctions_status: "clear", country: "DE" },
      orgProfile: { name: "Financial Corp" },
      documents: [],
      detectedAuthorities: [
        { authority_id: "DORA_ICT", authority_type: "regulation", authority_title: "DORA (EU) 2022/2554" },
      ],
      questionnaire: { framework_sources: ["DORA"], total_questions: 30 },
      findingsRegister: [{
        domain: "contractual",
        requirement_id: "DORA-30-1",
        requirement_text: "Service level descriptions",
        framework_ref: "DORA Art. 30(2)(a)",
        source_kind: "mcp_grounded",
        verdict: "not_addressed",
        confidence: "high",
        gap_description: "No SLA documented",
        remediation_requirement: "Provide SLA with quantitative targets",
        risk_impact: "high",
      }],
      domainScores: {
        contractual: { tier: "high", score: 0.0, weight: 0.6, total_entries: 1, denominator_count: 1, adequate_count: 0, partially_adequate_count: 0, inadequate_count: 0, not_addressed_count: 1, not_applicable_count: 0, requires_verification_count: 0 },
      },
      overallScore: { tier: "high", weighted_score: 0.0, worst_domain: "contractual" },
      externalValidations: [],
      expertsUsed: [],
      supersededEntries: [],
      scopeAndMethodology: { assessment_date: "2026-03-17", frameworks_assessed: ["DORA"], methodology: "Framework-based" },
    });
    expect(report).toContain("Contractual Requirements Checklist");
    expect(report).toContain("DORA Art. 30");
    expect(report).toContain("Audit and access rights");
    expect(report).toContain("DORA Register of Information");
  });

  it("includes GDPR Art. 28 checklist when GDPR detected", () => {
    const report = buildTprmAssessmentReport({
      assessmentId: "test-assessment-gdpr",
      vendorProfile: { name: "DataProcessor BV", lei_status: "active", sanctions_status: "clear" },
      orgProfile: { name: "Controller Corp" },
      documents: [],
      detectedAuthorities: [
        { authority_id: "GDPR_PROCESSOR", authority_type: "regulation", authority_title: "GDPR Art. 28" },
      ],
      questionnaire: { framework_sources: ["GDPR"], total_questions: 15 },
      findingsRegister: [],
      domainScores: {},
      overallScore: { tier: "low", weighted_score: 1.0, worst_domain: "data_protection" },
      externalValidations: [],
      expertsUsed: [],
      supersededEntries: [],
      scopeAndMethodology: { assessment_date: "2026-03-17" },
    });
    expect(report).toContain("GDPR Art. 28");
    expect(report).toContain("Processor Requirements");
    expect(report).toContain("Sub-processor engagement conditions");
  });

  it("sorts remediation requirements by risk impact", () => {
    const report = buildTprmAssessmentReport({
      assessmentId: "test-assessment-remediation",
      vendorProfile: { name: "WeakVendor Inc" },
      orgProfile: { name: "Strict Corp" },
      documents: [],
      detectedAuthorities: [],
      questionnaire: {},
      findingsRegister: [
        { domain: "information_security", requirement_id: "LOW-1", verdict: "inadequate", confidence: "high", risk_impact: "low", gap_description: "Minor gap", remediation_requirement: "Fix minor issue" },
        { domain: "data_protection", requirement_id: "CRIT-1", verdict: "not_addressed", confidence: "high", risk_impact: "critical", gap_description: "Critical gap", remediation_requirement: "Fix critical issue" },
        { domain: "business_continuity", requirement_id: "HIGH-1", verdict: "inadequate", confidence: "medium", risk_impact: "high", gap_description: "High gap", remediation_requirement: "Fix high issue" },
      ],
      domainScores: {},
      overallScore: { tier: "critical", weighted_score: 0.0 },
      externalValidations: [],
      expertsUsed: [],
      supersededEntries: [],
      scopeAndMethodology: {},
    });
    const critPos = report.indexOf("CRIT-1");
    const highPos = report.indexOf("HIGH-1");
    const lowPos = report.indexOf("LOW-1");
    // In remediation section, critical should come before high, high before low
    // Find the remediation section to check ordering within it
    const remediationSection = report.substring(report.indexOf("## 8. Remediation Requirements"));
    const critInRemediation = remediationSection.indexOf("CRIT-1");
    const highInRemediation = remediationSection.indexOf("HIGH-1");
    const lowInRemediation = remediationSection.indexOf("LOW-1");
    expect(critInRemediation).toBeLessThan(highInRemediation);
    expect(highInRemediation).toBeLessThan(lowInRemediation);
  });

  it("handles empty state gracefully", () => {
    const report = buildTprmAssessmentReport({
      assessmentId: "empty-assessment",
      vendorProfile: {},
      orgProfile: {},
      documents: [],
      detectedAuthorities: [],
      questionnaire: {},
      findingsRegister: [],
      domainScores: {},
      overallScore: {},
      externalValidations: [],
      expertsUsed: [],
      supersededEntries: [],
      scopeAndMethodology: {},
    });
    expect(report).toContain("Vendor Risk Assessment");
    expect(report).toContain("Assumptions & Limitations");
  });
});
