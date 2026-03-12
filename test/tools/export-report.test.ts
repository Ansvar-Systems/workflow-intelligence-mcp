import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { wkflExportReport } from "../../src/tools/export-report.js";
import { storeState, deleteAssessment } from "../../src/state/store.js";
import { mkdirSync, rmSync } from "node:fs";

const ORIGINAL_CWD = process.cwd();
const TEST_ROOT = `/tmp/workflow-intelligence-mcp-export-report-${process.pid}`;
const DATA_DIR = "data";
const ASSESSMENT_ID = "export-test-001";

function store(key: string, data: unknown) {
  storeState(ASSESSMENT_ID, key, data, DATA_DIR);
}

beforeEach(() => {
  mkdirSync(TEST_ROOT, { recursive: true });
  process.chdir(TEST_ROOT);
  mkdirSync(DATA_DIR, { recursive: true });
});

afterEach(() => {
  deleteAssessment(ASSESSMENT_ID, DATA_DIR);
  process.chdir(ORIGINAL_CWD);
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe("wkfl_export_report", () => {
  it("returns error when assessment has no state", async () => {
    const result = await wkflExportReport({ assessment_id: "nonexistent" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("no_state");
  });

  it("returns error when assessment_id is missing", async () => {
    const result = await wkflExportReport({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("missing_parameter");
  });

  it("assembles a report from stored state", async () => {
    // Store Phase 1 data
    store("org_profile", { name: "Acme Corp", sector: "Technology" });
    store("documents", [
      { filename: "isms-policy.pdf", doc_id: "doc-1" },
    ]);
    store("applicable_frameworks", ["ISO 27001:2022"]);

    // Store a domain group (Phase 3 output)
    store("group_access_control", [
      {
        req_id: "A.5.1",
        framework: "ISO 27001:2022",
        requirement_text: "Information security policy",
        verdict: "compliant",
        confidence: "high",
        evidence_refs: [
          { doc_id: "doc-1", section_ref: "Section 3.1", page_start: 5, page_end: 7, filename: "isms-policy.pdf" },
        ],
        verbatim_quote: "The organization shall establish an information security policy...",
        evidence_summary: "ISMS policy document explicitly defines the information security policy.",
      },
      {
        req_id: "A.5.2",
        framework: "ISO 27001:2022",
        requirement_text: "Review of policies",
        verdict: "partial",
        confidence: "medium",
        evidence_refs: [
          { doc_id: "doc-1", section_ref: "Section 3.2", page_start: 8 },
        ],
        evidence_summary: "Policy mentions annual review but no schedule defined.",
        gap_description: "No defined review schedule or review records.",
      },
      {
        req_id: "A.5.3",
        framework: "ISO 27001:2022",
        requirement_text: "Segregation of duties",
        verdict: "not_found",
        confidence: "high",
        evidence_summary: "",
      },
    ]);

    // Store Phase 4 data
    store("coverage_stats", {
      total_requirements: 3,
      compliant: 1,
      partial: 1,
      not_found: 1,
      contradicted: 0,
      not_applicable: 0,
      requires_human_review: 0,
      coverage_percentage: 33.3,
    });
    store("scope_and_methodology", {
      assessment_date: "2026-03-07",
      frameworks_assessed: [
        { name: "ISO 27001:2022", version: "2022", source_mcp: "security-controls" },
      ],
      documents_analyzed: [
        { filename: "isms-policy.pdf", doc_id: "doc-1", sections_count: 15, quality_signal: "high" },
      ],
      methodology: "Automated compliance assessment using document evidence analysis.",
      limitations: ["Only indexed documents were analyzed.", "No interviews conducted."],
      client_attestations: [
        { question: "Do you develop software in-house?", response: "No", impact: "A.8.25-A.8.33 marked not_applicable" },
      ],
    });

    const result = await wkflExportReport({ assessment_id: ASSESSMENT_ID });
    expect(result.isError).toBeUndefined();

    const report = result.content[0].text;

    // Title and metadata
    expect(report).toContain("# Compliance Assessment Report");
    expect(report).toContain("Acme Corp");
    expect(report).toContain("ISO 27001:2022");

    // Executive Summary
    expect(report).toContain("## 1. Executive Summary");
    expect(report).toContain("33.3%");

    // Scope
    expect(report).toContain("## 2. Scope & Methodology");
    expect(report).toContain("isms-policy.pdf");
    expect(report).toContain("No interviews conducted");

    // Compliance Matrix
    expect(report).toContain("## 3. Compliance Matrix");
    expect(report).toContain("A.5.1");
    expect(report).toContain("**compliant**");
    expect(report).toContain("**partial**");
    expect(report).toContain("**not_found**");

    // Gap Analysis
    expect(report).toContain("## 4. Gap Analysis");
    expect(report).toContain("Not Found (1)");
    expect(report).toContain("Partial Compliance (1)");
    expect(report).toContain("No defined review schedule");

    // Evidence Register
    expect(report).toContain("## 5. Evidence Register");
    expect(report).toContain("Section 3.1");
    expect(report).toContain("5–7");

    // Client Attestations
    expect(report).toContain("## 6. Client Attestations");
    expect(report).toContain("Do you develop software in-house?");
  });

  it("handles pre-assembled compliance_matrix key", async () => {
    store("org_profile", { name: "Beta Inc" });
    store("compliance_matrix", [
      { req_id: "R-1", verdict: "compliant", framework: "SOC 2" },
    ]);
    store("coverage_stats", { total_requirements: 1, compliant: 1, coverage_percentage: 100 });

    const result = await wkflExportReport({ assessment_id: ASSESSMENT_ID });
    const report = result.content[0].text;

    expect(report).toContain("Beta Inc");
    expect(report).toContain("R-1");
    expect(report).toContain("**compliant**");
  });

  it("handles domain groups with nested matrix property", async () => {
    store("org_profile", { name: "Gamma LLC" });
    store("group_network", {
      group_id: "network",
      matrix: [
        { req_id: "N-1", verdict: "not_found", framework: "NIST CSF" },
      ],
    });
    store("coverage_stats", { total_requirements: 1, not_found: 1 });

    const result = await wkflExportReport({ assessment_id: ASSESSMENT_ID });
    const report = result.content[0].text;

    expect(report).toContain("N-1");
    expect(report).toContain("Not Found (1)");
  });

  it("assembles a STRIDE report from the documented scope_and_dfd and threats keys", async () => {
    store("evidence_manifest", {
      authorized_documents: [
        { doc_id: "doc-1", title: "architecture.md", role: "primary_architecture" },
      ],
      system_identity: {
        name: "Payments API",
        aliases: ["FinPay360 Payments API"],
        evidence_doc_ids: ["doc-1"],
      },
      document_coverage: [
        { dimension: "architecture", status: "covered", supporting_doc_ids: ["doc-1"] },
        { dimension: "trust_boundaries", status: "partial", supporting_doc_ids: ["doc-1"] },
      ],
      mismatch_flags: [],
      extraction_confidence: "high",
    });
    store("scope_and_dfd", {
      system_name: "Payments API",
      components: [
        { id: "api", name: "API", type: "process", trust_zone: "Cloud App", technology: "Node.js", confidence: "confirmed" },
        { id: "db", name: "DB", type: "data_store", trust_zone: "Data Zone", technology: "PostgreSQL", confidence: "confirmed" },
      ],
      data_flows: [
        { id: "F1", from: "User", to: "API", data: "Bearer token + payment request", protocol: "HTTPS", authenticated: "OAuth2 bearer token", encrypted: true, crosses_boundary: true },
      ],
      trust_boundaries: [
        { id: "TB1", name: "Internet to Cloud App", from_zone: "Internet", to_zone: "Cloud App", flows: ["F1"], data_types: ["Credentials", "Payment data"] },
      ],
      existing_controls: [
        { id: "EC-1", name: "Managed identity", type: "identity", applies_to: ["api"] },
      ],
      dfd_markdown: "graph TD\n  User-->API\n  API-->DB",
      document_citations: [
        { document: "architecture.md", doc_id: "doc-1" },
      ],
      gaps: [
        {
          id: "gap-1",
          phase: "phase_1_scope_and_dfd",
          description: "Token issuer not documented",
          impact_if_wrong: "Spoofing coverage may be incomplete",
        },
      ],
    });
    store("scope_gap_analysis", {
      scope_readiness: {
        overall_status: "partial",
        proceeding_mode: "proceed",
        confidence: "medium",
        summary: "Scope is usable after targeted client clarifications.",
        blocking_gaps: ["Trust boundary between cloud workload and on-prem HSM"],
      },
      client_questions: [
        {
          id: "Q1",
          question: "Where is the trust boundary between the cloud workload and the HSM enclave?",
          rationale: "This determines whether key operations cross a privilege boundary.",
          blocking: true,
          response_type: "text",
          status: "answered",
          response: "The boundary is between the Azure app subnet and the dedicated on-prem HSM network.",
          answer_source: "user_attested",
          affects_fields: ["trust_boundaries", "data_flows"],
        },
      ],
      client_attestations: [
        {
          question_id: "Q1",
          question: "Where is the trust boundary between the cloud workload and the HSM enclave?",
          response: "The boundary is between the Azure app subnet and the dedicated on-prem HSM network.",
          impact: "Hybrid trust-boundary threats must be assessed explicitly.",
          answer_source: "user_attested",
        },
      ],
      gaps: [
        {
          id: "gap-2",
          phase: "phase_1b_scope_gap_analysis",
          description: "Hybrid trust-boundary placement needed clarification",
          blocking: true,
          question_id: "Q1",
          resolution_status: "answered",
        },
      ],
    });
    store("threats", [
      {
        id: "T1",
        stride_category: "Spoofing",
        component_id: "api",
        title: "Forged token accepted",
        description: "An attacker can submit a forged bearer token to impersonate a trusted caller.",
        mcp_source: "search_stride_patterns",
        cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:L/SC:N/SI:N/SA:N",
        cvss_score: 8.7,
        cvss_rationale: "The API is externally reachable and token forgery would directly compromise authorization decisions.",
        severity: "high",
        business_risk_tier: "critical",
        business_risk_label: "Critical",
        business_impact: "Fraudulent payment initiation and unauthorized account actions become possible.",
        business_impact_severity: "critical",
        likelihood: "Likely",
        likelihood_rationale: "The document shows an internet-facing API but does not document issuer validation hardening.",
        priority_score: 90,
        impact_index: 5,
        likelihood_index: 4,
        affected_components: ["API"],
        affected_flows: ["F1"],
        affected_trust_boundaries: ["TB1"],
        attack_techniques: ["T1528"],
        cwe_ids: ["CWE-287"],
        capec_ids: ["CAPEC-115"],
        atlas_ids: ["AML.TA0001"],
        d3fend_ids: ["D3-AUTHE"],
        existing_controls: ["Managed identity"],
        recommended_controls: ["Validate token issuer and audience before accepting bearer tokens."],
        residual_risk: "medium",
        residual_risk_rationale: "Residual abuse would require control bypass rather than direct token forgery.",
        attack_path_refs: ["AP-1"],
        verification_test_refs: ["TC-1"],
        provenance: {
          source_type: "document_grounded",
          confidence: "medium",
          document_grounded_fields: ["title", "affected_components"],
          assumed_fields: ["issuer validation path"],
          pattern_mapped_fields: ["capec_ids", "attack_techniques"],
        },
        document_citations: [
          {
            document: "architecture.md",
            doc_id: "doc-1",
            page: 3,
            section: "Authentication Flow",
            verbatim_quote: "The API accepts OAuth2 bearer tokens from the client tier.",
            evidence_type: "document_evidence",
          },
        ],
        pattern_citations: [
          {
            source: "stride-mcp",
            pattern_id: "SPOOF-API-01",
            cwe_id: "CWE-287",
            tool_call: "search_stride_patterns",
          },
        ],
      },
    ]);
    store("attack_paths", [
      {
        id: "AP-1",
        title: "Token forgery to payment fraud",
        summary: "Forge or replay a bearer token to impersonate a trusted caller and submit fraudulent payment instructions.",
        related_threat_ids: ["T1"],
        steps: [
          "Obtain a reusable bearer token or forge a token accepted by the API.",
          "Submit a payment initiation request over the documented external interface.",
          "Persist fraudulent ledger changes through downstream processing.",
        ],
      },
    ]);
    store("verification_tests", [
      {
        id: "TC-1",
        title: "Reject forged bearer token",
        objective: "Verify the API rejects tokens with invalid issuer or audience claims.",
        procedure: [
          "Generate a token with an invalid issuer claim.",
          "Call the payment initiation endpoint with the forged token.",
        ],
        expected_result: "The API rejects the request and records an authentication failure.",
        related_threat_ids: ["T1"],
      },
    ]);
    store("red_flags", [
      {
        id: "RF-1",
        title: "Issuer validation not documented",
        severity: "high",
        description: "The architecture evidence confirms bearer-token use but does not describe issuer or audience validation.",
        rationale: "This gap directly affects spoofing risk for the public API.",
      },
    ]);
    store("coverage_matrix", {
      api: {
        Spoofing: true,
        Tampering: true,
        Repudiation: true,
        "Information Disclosure": true,
        "Denial of Service": true,
        "Elevation of Privilege": true,
      },
      db: {
        Spoofing: true,
        Tampering: true,
        Repudiation: true,
        "Information Disclosure": true,
        "Denial of Service": true,
        "Elevation of Privilege": true,
      },
    });
    store("threat_mitigations", [
      {
        threat_id: "T1",
        controls: [
          {
            control_id: "AC-1",
            framework: "NIST SP 800-53",
            control_name: "Authenticator Management",
            implementation_guidance: "Validate token issuer and audience before accepting bearer tokens.",
          },
        ],
      },
    ]);

    const result = await wkflExportReport({ assessment_id: ASSESSMENT_ID });
    const report = result.content[0].text;

    expect(report).toContain("# STRIDE Threat Model Report");
    expect(report).toContain("Payments API");
    expect(report).toContain("Components:** 2");
    expect(report).toContain("Threats Identified:** 1");
    expect(report).toContain("## 1. Executive Summary");
    expect(report).toContain("## 2. Scope, Evidence, and Limitations");
    expect(report).toContain("### Authorized Evidence Manifest");
    expect(report).toContain("FinPay360 Payments API");
    expect(report).toContain("## 3. Architecture Summary");
    expect(report).toContain("## 4. Detailed Threat Register");
    expect(report).toContain("## 8. Traceability Appendix");
    expect(report).toContain("Scope is usable after targeted client clarifications.");
    expect(report).toContain("### Client Clarifications and Attestations");
    expect(report).toContain("Where is the trust boundary between the cloud workload and the HSM enclave?");
    expect(report).toContain("User-attested");
    expect(report).toContain("architecture.md");
    expect(report).toContain("Authentication Flow");
    expect(report).toContain("Business Risk Distribution");
    expect(report).toContain("Critical");
    expect(report).toContain("CVSS Vector");
    expect(report).toContain("CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:L/SC:N/SI:N/SA:N");
    expect(report).toContain("ATT&CK:T1528");
    expect(report).toContain("CWE:CWE-287");
    expect(report).toContain("CAPEC:CAPEC-115");
    expect(report).toContain("ATLAS:AML.TA0001");
    expect(report).toContain("D3FEND:D3-AUTHE");
    expect(report).toContain("## 5. Remediation Priorities");
    expect(report).toContain("## 6. Attack Paths");
    expect(report).toContain("## 7. Verification Test Cases");
    expect(report).toContain("## 9. Gaps and Assumptions Register");
    expect(report).toContain("Forged token accepted");
    expect(report).toContain("8.7");
    expect(report).toContain("Fraudulent payment initiation and unauthorized account actions become possible.");
    expect(report).toContain("Validate token issuer and audience before accepting bearer tokens.");
    expect(report).toContain("Token forgery to payment fraud");
    expect(report).toContain("Reject forged bearer token");
    expect(report).toContain("Spoofing coverage may be incomplete");
  });

  it("blocks STRIDE export when the required state is incomplete", async () => {
    store("coverage_matrix", {});

    const result = await wkflExportReport({ assessment_id: ASSESSMENT_ID });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("incomplete_stride_state");
  });

  it("blocks STRIDE export when scope gap analysis was never recorded", async () => {
    store("evidence_manifest", {
      authorized_documents: [
        { doc_id: "doc-1", title: "architecture.md" },
      ],
      system_identity: {
        name: "Payments API",
      },
      document_coverage: [
        { dimension: "architecture", status: "covered" },
      ],
      mismatch_flags: [],
    });
    store("scope_and_dfd", {
      system_name: "Payments API",
      components: [
        { id: "api", name: "API", type: "process" },
        { id: "db", name: "DB", type: "data_store" },
      ],
      data_flows: [
        { id: "F1", source_id: "user", destination_id: "api" },
      ],
      dfd_markdown: "graph TD\n  User-->API\n  API-->DB",
    });
    store("threats", [
      {
        id: "T1",
        stride_category: "Spoofing",
        component_id: "api",
        title: "Forged token accepted",
        description: "An attacker can submit a forged bearer token to impersonate a trusted caller.",
        mcp_source: "search_stride_patterns",
        cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:L/SC:N/SI:N/SA:N",
        cvss_score: 8.7,
        severity: "high",
        business_risk_tier: "high",
        business_impact: "Unauthorized payment initiation.",
        likelihood: "likely",
        likelihood_rationale: "The API is internet-facing and issuer validation is not documented.",
        cvss_rationale: "Network-reachable spoofing would compromise account integrity.",
      },
    ]);
    store("coverage_matrix", {
      api: {
        Spoofing: true,
        Tampering: true,
        Repudiation: true,
        "Information Disclosure": true,
        "Denial of Service": true,
        "Elevation of Privilege": true,
      },
      db: {
        Spoofing: true,
        Tampering: true,
        Repudiation: true,
        "Information Disclosure": true,
        "Denial of Service": true,
        "Elevation of Privilege": true,
      },
    });
    store("threat_mitigations", [
      {
        threat_id: "T1",
        controls: [
          {
            control_id: "AC-1",
            framework: "NIST SP 800-53",
            control_name: "Authenticator Management",
            implementation_guidance: "Validate token issuer and audience before accepting bearer tokens.",
          },
        ],
      },
    ]);
    store("attack_paths", [
      {
        id: "AP-1",
        title: "Spoof to transaction action",
        summary: "An attacker spoofs a trusted user and submits a transaction.",
        related_threat_ids: ["T1"],
      },
    ]);
    store("verification_tests", [
      {
        id: "VT-1",
        title: "Reject spoofed token",
        objective: "Confirm spoofed tokens are rejected.",
        procedure: ["Replay a token with an invalid issuer."],
        expected_result: "The API rejects the request.",
        related_threat_ids: ["T1"],
      },
    ]);

    const result = await wkflExportReport({ assessment_id: ASSESSMENT_ID });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("incomplete_stride_state");
    expect(result.content[0].text).toContain("scope_readiness");
  });

  it("blocks STRIDE export when a threat is missing severity", async () => {
    store("evidence_manifest", {
      authorized_documents: [
        { doc_id: "doc-1", title: "architecture.md" },
      ],
      system_identity: {
        name: "Payments API",
      },
      document_coverage: [
        { dimension: "architecture", status: "covered" },
      ],
      mismatch_flags: [],
    });
    store("scope_and_dfd", {
      system_name: "Payments API",
      components: [
        { id: "api", name: "API", type: "process" },
        { id: "db", name: "DB", type: "data_store" },
      ],
      data_flows: [
        { id: "F1", source_id: "user", destination_id: "api" },
      ],
      dfd_markdown: "graph TD\n  User-->API\n  API-->DB",
    });
    store("scope_gap_analysis", {
      scope_readiness: {
        overall_status: "ready",
        proceeding_mode: "proceed",
        summary: "Scope is sufficient for threat modeling.",
      },
    });
    store("threats", [
      {
        id: "T1",
        stride_category: "Spoofing",
        component_id: "api",
        title: "Forged token accepted",
        description: "An attacker can submit a forged bearer token to impersonate a trusted caller.",
        mcp_source: "search_stride_patterns",
        cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:L/SC:N/SI:N/SA:N",
        cvss_score: 8.7,
        business_risk_tier: "high",
        business_impact: "Unauthorized payment initiation.",
        likelihood: "likely",
        likelihood_rationale: "The API is internet-facing and issuer validation is not documented.",
        cvss_rationale: "Network-reachable spoofing would compromise account integrity.",
      },
    ]);
    store("coverage_matrix", {
      api: {
        Spoofing: true,
        Tampering: true,
        Repudiation: true,
        "Information Disclosure": true,
        "Denial of Service": true,
        "Elevation of Privilege": true,
      },
      db: {
        Spoofing: true,
        Tampering: true,
        Repudiation: true,
        "Information Disclosure": true,
        "Denial of Service": true,
        "Elevation of Privilege": true,
      },
    });
    store("threat_mitigations", [
      { threat_id: "T1", controls: [] },
    ]);
    store("attack_paths", [
      {
        id: "AP-1",
        title: "Spoof to action",
        summary: "An attacker spoofs a trusted caller and submits a transaction.",
        related_threat_ids: ["T1"],
      },
    ]);
    store("verification_tests", [
      {
        id: "VT-1",
        title: "Reject spoofed token",
        objective: "Confirm spoofed tokens are rejected.",
        procedure: ["Replay a token with an invalid issuer."],
        expected_result: "The API rejects the request.",
        related_threat_ids: ["T1"],
      },
    ]);

    const result = await wkflExportReport({ assessment_id: ASSESSMENT_ID });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("incomplete_stride_state");
    expect(result.content[0].text).toContain("every_threat_has_severity");
  });
});
