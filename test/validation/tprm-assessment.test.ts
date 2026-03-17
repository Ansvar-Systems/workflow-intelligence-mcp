import { describe, it, expect } from "vitest";
import { checkStageCompleteness } from "../../src/tools/check-stage-completeness.js";

describe("vendor_risk_assessment completion criteria", () => {
  // Helper to build a domain score object with full audit shape
  function domainScore(overrides: Partial<{
    tier: string;
    score: number;
    weight: number;
    total_entries: number;
    denominator_count: number;
    adequate_count: number;
    partially_adequate_count: number;
    inadequate_count: number;
    not_addressed_count: number;
    not_applicable_count: number;
    requires_verification_count: number;
  }> = {}) {
    return {
      tier: "low",
      score: 0.85,
      weight: 1.0,
      total_entries: 5,
      denominator_count: 5,
      adequate_count: 4,
      partially_adequate_count: 1,
      inadequate_count: 0,
      not_addressed_count: 0,
      not_applicable_count: 0,
      requires_verification_count: 0,
      ...overrides,
    };
  }

  // Adequate finding — must have evidence_refs with verbatim_quote
  const adequateFinding = {
    finding_id: "F-001",
    domain: "information_security",
    requirement_id: "ISO27001_A.5.19",
    requirement_text: "Information security in supplier relationships shall be established and maintained",
    framework_ref: "ISO 27001:2022 Annex A",
    source_kind: "document_extracted",
    source_ref: "docidx_get_section(doc_id='soc2-report', section_ref='3.2')",
    vendor_response: "We maintain a supplier security management program as described in our SOC 2 report section 3.2",
    verdict: "adequate",
    evidence_refs: [
      {
        doc_id: "soc2-report",
        section_ref: "3.2",
        filename: "acme-soc2-2025.pdf",
        verbatim_quote: "Acme maintains a formal vendor risk management program that includes security assessments for all critical suppliers, ongoing monitoring, and annual recertification requirements.",
        evidence_type: "certification_evidence",
      },
    ],
    risk_impact: "medium",
    confidence: "high",
  };

  // Inadequate finding — must have gap_description AND remediation_requirement
  const inadequateFinding = {
    finding_id: "F-002",
    domain: "data_protection",
    requirement_id: "GDPR_Art.28(3)(a)",
    requirement_text: "The processor shall process personal data only on documented instructions from the controller",
    framework_ref: "GDPR Art. 28",
    source_kind: "mcp_grounded",
    source_ref: "eu_get_article(regulation='GDPR', article='28')",
    verdict: "inadequate",
    gap_description: "The vendor's DPA does not specify that processing occurs only on documented instructions. The current agreement uses vague language about 'reasonable processing purposes' without binding the vendor to controller instructions.",
    remediation_requirement: "Vendor must amend DPA clause 4.1 to state that personal data is processed only on documented instructions from the controller, including transfers to third countries (per GDPR Art. 28(3)(a)).",
    risk_impact: "high",
    confidence: "high",
  };

  const baseState = {
    vendor_profile: {
      name: "Acme Cloud Services B.V.",
      legal_name: "Acme Cloud Services B.V.",
      lei: "529900T8BM49AURSDO55",
      lei_status: "active",
      sanctions_status: "clear",
      country: "NL",
      sector: "cloud_infrastructure",
      service_description: "Cloud-hosted data processing platform for financial services",
      certifications: ["ISO 27001:2022", "SOC 2 Type II"],
    },
    detected_authorities: [
      {
        authority_id: "GDPR_PROCESSOR",
        authority_type: "regulation",
        authority_title: "GDPR — Processor obligations",
        detection_signals: ["personal data", "processor", "DPA"],
        confidence: "high",
      },
      {
        authority_id: "ISO_27001",
        authority_type: "standard",
        authority_title: "ISO/IEC 27001:2022",
        detection_signals: ["ISO 27001", "ISMS"],
        confidence: "high",
      },
    ],
    baseline_entries: [
      {
        domain: "information_security",
        requirement_id: "ISO27001_A.5.19",
        requirement_text: "Information security in supplier relationships shall be established and maintained",
        source_kind: "document_extracted",
        source_ref: "docidx_get_section(doc_id='soc2-report', section_ref='3.2')",
        verdict: "adequate",
        evidence_refs: [
          {
            doc_id: "soc2-report",
            section_ref: "3.2",
            verbatim_quote: "Acme maintains a formal vendor risk management program.",
          },
        ],
        confidence: "high",
      },
    ],
    findings_register: [adequateFinding, inadequateFinding],
    domain_scores: {
      information_security: domainScore({ tier: "low", score: 0.85, weight: 1.0 }),
      data_protection: domainScore({ tier: "high", score: 0.25, weight: 0.8, inadequate_count: 3, adequate_count: 1, partially_adequate_count: 1 }),
      business_continuity: domainScore({ tier: "low", score: 0.90, weight: 0.8 }),
      contractual: domainScore({ tier: "medium", score: 0.60, weight: 0.6 }),
      financial_stability: domainScore({ tier: "low", score: 1.0, weight: 0.4 }),
      regulatory_compliance: domainScore({ tier: "medium", score: 0.55, weight: 0.6 }),
      concentration_risk: domainScore({ tier: "low", score: 1.0, weight: 0.4, total_entries: 2, denominator_count: 2, adequate_count: 2, partially_adequate_count: 0 }),
    },
    overall_score: {
      tier: "high",
      weighted_score: 0.62,
      worst_domain: "data_protection",
      concentration_risk_flag: false,
    },
    scope_and_methodology: {
      assessment_date: "2026-03-17",
      frameworks_assessed: ["GDPR", "ISO 27001:2022"],
      documents_analyzed: ["acme-soc2-2025.pdf", "acme-dpa-v3.pdf"],
      experts_consulted: ["gdpr-expert"],
      external_sources_used: ["vendor-intelligence-mcp", "gleif-mcp", "sanctions-mcp"],
      methodology: "Document-based baseline assessment with expert challenge and external validation per Ansvar TPRM methodology v1.0",
      limitations: ["No pentest report provided by vendor"],
    },
    experts_used: [
      {
        agent_id: "gdpr-expert",
        display_name: "GDPR Expert",
        authority_ids: ["GDPR_PROCESSOR"],
        status: "complete",
        entries_count: 8,
      },
    ],
    report_ready: true,
  };

  it("marks complete state as complete", async () => {
    const result = await checkStageCompleteness({
      task_id: "vendor_risk_assessment",
      stage_id: "vendor_risk_assessment",
      definition_version: "1.0",
      stage_state: baseState,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).not.toBe("incomplete");
  });

  it("rejects adequate verdict without evidence", async () => {
    const state = {
      ...baseState,
      findings_register: [
        {
          ...adequateFinding,
          evidence_refs: [],
        },
        inadequateFinding,
      ],
    };
    const result = await checkStageCompleteness({
      task_id: "vendor_risk_assessment",
      definition_version: "1.0",
      stage_state: state,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("incomplete");
    const ruleIds = parsed.missing.map((f: { rule: string }) => f.rule);
    expect(ruleIds).toContain("adequate_has_evidence");
  });

  it("rejects adequate verdict without verbatim_quote", async () => {
    const state = {
      ...baseState,
      findings_register: [
        {
          ...adequateFinding,
          evidence_refs: [
            {
              doc_id: "soc2-report",
              section_ref: "3.2",
              filename: "acme-soc2-2025.pdf",
              // no verbatim_quote
            },
          ],
        },
        inadequateFinding,
      ],
    };
    const result = await checkStageCompleteness({
      task_id: "vendor_risk_assessment",
      definition_version: "1.0",
      stage_state: state,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("incomplete");
    const details = parsed.missing.map((f: { details: string }) => f.details);
    expect(details.some((d: string) => d.includes("verbatim_quote"))).toBe(true);
  });

  it("rejects inadequate verdict without gap_description", async () => {
    const state = {
      ...baseState,
      findings_register: [
        adequateFinding,
        {
          ...inadequateFinding,
          gap_description: undefined,
        },
      ],
    };
    const result = await checkStageCompleteness({
      task_id: "vendor_risk_assessment",
      definition_version: "1.0",
      stage_state: state,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("incomplete");
    const ruleIds = parsed.missing.map((f: { rule: string }) => f.rule);
    expect(ruleIds).toContain("inadequate_has_gap_and_remediation");
  });

  it("rejects inadequate verdict without remediation_requirement", async () => {
    const state = {
      ...baseState,
      findings_register: [
        adequateFinding,
        {
          ...inadequateFinding,
          remediation_requirement: undefined,
        },
      ],
    };
    const result = await checkStageCompleteness({
      task_id: "vendor_risk_assessment",
      definition_version: "1.0",
      stage_state: state,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("incomplete");
    const ruleIds = parsed.missing.map((f: { rule: string }) => f.rule);
    expect(ruleIds).toContain("inadequate_has_gap_and_remediation");
  });

  it("rejects partially_adequate verdict without gap_description", async () => {
    const partiallyAdequateFinding = {
      finding_id: "F-003",
      domain: "business_continuity",
      requirement_id: "ISO27001_A.5.30",
      requirement_text: "ICT readiness for business continuity shall be planned, implemented, maintained and tested",
      source_kind: "document_extracted",
      source_ref: "docidx_get_section(doc_id='soc2-report', section_ref='5.1')",
      verdict: "partially_adequate",
      // gap_description deliberately omitted
      evidence_refs: [
        {
          doc_id: "soc2-report",
          section_ref: "5.1",
          verbatim_quote: "Acme has a business continuity plan covering primary data center failover.",
        },
      ],
      confidence: "medium",
    };
    const state = {
      ...baseState,
      findings_register: [adequateFinding, partiallyAdequateFinding],
    };
    const result = await checkStageCompleteness({
      task_id: "vendor_risk_assessment",
      definition_version: "1.0",
      stage_state: state,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("incomplete");
    const ruleIds = parsed.missing.map((f: { rule: string }) => f.rule);
    expect(ruleIds).toContain("partially_adequate_has_gap");
  });

  it("rejects not_addressed verdict without gap_description or remediation", async () => {
    const notAddressedFinding = {
      finding_id: "F-004",
      domain: "contractual",
      requirement_id: "DORA_Art.30(2)(a)",
      requirement_text: "Contractual arrangements on the use of ICT services shall include a clear description of all functions and ICT services",
      source_kind: "mcp_grounded",
      source_ref: "eu_get_article(regulation='DORA', article='30')",
      verdict: "not_addressed",
      // gap_description and remediation_requirement deliberately omitted
      confidence: "high",
    };
    const state = {
      ...baseState,
      findings_register: [adequateFinding, notAddressedFinding],
    };
    const result = await checkStageCompleteness({
      task_id: "vendor_risk_assessment",
      definition_version: "1.0",
      stage_state: state,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("incomplete");
    const details = parsed.missing.map((f: { details: string }) => f.details);
    expect(details.some((d: string) => d.includes("gap_description"))).toBe(true);
    expect(details.some((d: string) => d.includes("remediation_requirement"))).toBe(true);
  });

  it("rejects document_extracted entry without source_ref", async () => {
    const noSourceRefFinding = {
      finding_id: "F-005",
      domain: "information_security",
      requirement_id: "ISO27001_A.8.1",
      requirement_text: "User endpoint devices shall be protected",
      source_kind: "document_extracted",
      // source_ref deliberately omitted
      verdict: "adequate",
      evidence_refs: [
        {
          doc_id: "soc2-report",
          section_ref: "4.3",
          verbatim_quote: "All endpoint devices are managed via MDM with enforced encryption and remote wipe capability.",
        },
      ],
      confidence: "high",
    };
    const state = {
      ...baseState,
      findings_register: [noSourceRefFinding, inadequateFinding],
    };
    const result = await checkStageCompleteness({
      task_id: "vendor_risk_assessment",
      definition_version: "1.0",
      stage_state: state,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("incomplete");
    const ruleIds = parsed.missing.map((f: { rule: string }) => f.rule);
    expect(ruleIds).toContain("tprm_grounded_has_source_ref");
  });

  it("warns when no experts were consulted", async () => {
    const state = {
      ...baseState,
      experts_used: [],
    };
    const result = await checkStageCompleteness({
      task_id: "vendor_risk_assessment",
      definition_version: "1.0",
      stage_state: state,
    });
    const parsed = JSON.parse(result.content[0].text);
    // Should not be incomplete — experts_used is a soft warning, not required
    expect(parsed.status).not.toBe("incomplete");
    const warningDetails = parsed.warnings.map((w: { details: string }) => w.details);
    expect(warningDetails.some((d: string) => d.toLowerCase().includes("expert"))).toBe(true);
  });
});
