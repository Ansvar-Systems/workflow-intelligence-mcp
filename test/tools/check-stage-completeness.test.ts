import { describe, it, expect } from "vitest";
import { checkStageCompleteness } from "../../src/tools/check-stage-completeness.js";
import dfdValid from "../fixtures/dfd-valid-minimal.json";
import dfdComplex from "../fixtures/dfd-valid-complex.json";
import dfdEmpty from "../fixtures/dfd-empty.json";

describe("check_stage_completeness", () => {
  it("returns complete for valid minimal DFD", async () => {
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.0",
      stage_state: dfdValid,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toMatch(/^complete/);
    expect(data.missing).toHaveLength(0);
  });

  it("returns complete for valid complex DFD", async () => {
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.0",
      stage_state: dfdComplex,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("complete");
    expect(data.missing).toHaveLength(0);
    expect(data.warnings).toHaveLength(0);
  });

  it("returns incomplete for empty state", async () => {
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.0",
      stage_state: dfdEmpty,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    expect(data.missing.length).toBeGreaterThanOrEqual(5);
  });

  it("returns incomplete when only trust boundaries missing", async () => {
    const noBoundaries = {
      processes: [{ id: "proc-001", name: "A" }],
      data_stores: [{ id: "ds-001", name: "B" }],
      external_entities: [{ id: "ext-001", name: "C" }],
      data_flows: [
        { id: "df-001", source_id: "ext-001", destination_id: "proc-001" },
        { id: "df-002", source_id: "proc-001", destination_id: "ds-001" },
      ],
      trust_boundaries: [],
    };
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.0",
      stage_state: noBoundaries,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    const tbMissing = data.missing.find(
      (m: { field?: string }) => m.field === "trust_boundaries",
    );
    expect(tbMissing).toBeDefined();
  });

  it("returns complete_with_quality_warnings when structure OK but descriptions missing", async () => {
    const sparseDescriptions = {
      processes: [{ id: "proc-001", name: "API" }],
      data_stores: [{ id: "ds-001", name: "DB" }],
      external_entities: [{ id: "ext-001", name: "User" }],
      data_flows: [
        { id: "df-001", source_id: "ext-001", destination_id: "proc-001" },
        { id: "df-002", source_id: "proc-001", destination_id: "ds-001" },
      ],
      trust_boundaries: [
        { id: "tb-001", name: "Boundary", enclosed_ids: ["proc-001", "ds-001"] },
      ],
    };
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.0",
      stage_state: sparseDescriptions,
    });
    const data = JSON.parse(result.content[0].text);
    // Should be complete structurally, but quality warnings for missing descriptions
    expect(data.status).toMatch(/complete/);
    expect(data.missing).toHaveLength(0);
  });

  it("handles version mismatch (minor bump) with version_note", async () => {
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.1",
      stage_state: dfdValid,
    });
    const data = JSON.parse(result.content[0].text);
    // 1.1 vs 1.0 — same major, so proceed with note
    // (Current is 1.0, requested is 1.1 — ahead of current, but same major)
    expect(data.status).toMatch(/complete/);
  });

  it("returns error for unknown task_id", async () => {
    const result = await checkStageCompleteness({
      task_id: "nonexistent",
      stage_id: "nonexistent",
      definition_version: "1.0",
      stage_state: {},
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("task_not_found");
  });

  it("rejects invalid JSON Schema input", async () => {
    const invalidSchema = {
      processes: "not an array",
      data_stores: [],
      external_entities: [],
      data_flows: [],
      trust_boundaries: [],
    };
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.0",
      stage_state: invalidSchema,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    expect(data.missing[0].rule).toBe("schema_validation");
  });

  it("marks STRIDE phase 2 incomplete when a component is missing from coverage_matrix", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_2_stride_enumeration",
      definition_version: "1.0",
      stage_state: {
        system_name: "Payments API",
        components: [
          { id: "api", name: "API", type: "process" },
          { id: "db", name: "DB", type: "data_store" },
        ],
        threats: [
          {
            id: "T1",
            stride_category: "Spoofing",
            component_id: "api",
            title: "Forged token accepted",
            description: "An attacker can submit a forged bearer token to impersonate a trusted caller.",
            mcp_source: "search_stride_patterns",
          },
        ],
        coverage_matrix: {
          api: {
            Spoofing: true,
            Tampering: true,
            Repudiation: true,
            "Information Disclosure": true,
            "Denial of Service": true,
            "Elevation of Privilege": true,
          },
        },
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    expect(data.missing.some((m: { details: string }) => m.details.includes("db"))).toBe(true);
  });

  it("marks STRIDE phase 1b incomplete when scope_readiness is missing", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_1b_scope_gap_analysis",
      definition_version: "1.0",
      stage_state: {
        gaps: [
          {
            id: "gap-1",
            phase: "phase_1b_scope_gap_analysis",
            description: "Trust boundaries are unclear",
            blocking: true,
            question_id: "Q1",
          },
        ],
        client_questions: [
          {
            id: "Q1",
            question: "Where does the trust boundary sit between the public API and internal services?",
            blocking: true,
            response_type: "text",
            status: "answered",
            response: "At the API gateway.",
            answer_source: "user_attested",
          },
        ],
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    expect(data.missing.some((m: { rule: string }) => m.rule === "scope_readiness_recorded")).toBe(true);
  });

  it("marks STRIDE phase 0 incomplete when evidence manifest still has mismatch flags", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_0_evidence_manifest",
      definition_version: "1.0",
      stage_state: {
        evidence_manifest: {
          authorized_documents: [
            { doc_id: "doc-1", title: "FinPay360 Architecture" },
          ],
          system_identity: {
            name: "FinPay360",
          },
          document_coverage: [
            { dimension: "architecture", status: "covered" },
          ],
          mismatch_flags: ["Found different system name in scoped evidence"],
        },
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    expect(data.missing.some((m: { rule: string }) => m.rule === "evidence_manifest_ready")).toBe(true);
  });

  it("marks STRIDE phase 1b incomplete when a blocking question is still pending", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_1b_scope_gap_analysis",
      definition_version: "1.0",
      stage_state: {
        scope_readiness: {
          overall_status: "blocked",
          proceeding_mode: "awaiting_client_input",
          summary: "Need trust-boundary clarification before specialist fan-out.",
        },
        gaps: [
          {
            id: "gap-1",
            phase: "phase_1b_scope_gap_analysis",
            description: "Trust boundaries are unclear",
            blocking: true,
            question_id: "Q1",
          },
        ],
        client_questions: [
          {
            id: "Q1",
            question: "Where does the trust boundary sit between the public API and internal services?",
            rationale: "This determines which flows cross a privilege boundary.",
            blocking: true,
            response_type: "text",
            status: "pending",
          },
        ],
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    expect(data.missing.some((m: { rule: string }) => m.rule === "blocking_client_questions_resolved")).toBe(true);
  });

  it("returns complete for STRIDE phase 1b when blocking gaps are answered with provenance", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_1b_scope_gap_analysis",
      definition_version: "1.0",
      stage_state: {
        scope_readiness: {
          overall_status: "partial",
          proceeding_mode: "proceed",
          confidence: "medium",
          summary: "Scope is adequate after targeted clarifications.",
          blocking_gaps: ["Trust boundaries"],
          clarifications_needed: ["Token issuer ownership"],
        },
        gaps: [
          {
            id: "gap-1",
            phase: "phase_1b_scope_gap_analysis",
            description: "Trust boundaries are unclear",
            blocking: true,
            question_id: "Q1",
            resolution_status: "answered",
          },
        ],
        client_questions: [
          {
            id: "Q1",
            question: "Where does the trust boundary sit between the public API and internal services?",
            rationale: "This determines which flows cross a privilege boundary.",
            blocking: true,
            response_type: "text",
            status: "answered",
            response: "At the API gateway and again between the cloud app tier and the on-prem HSM network.",
            answer_source: "user_attested",
            affects_fields: ["trust_boundaries", "data_flows"],
          },
        ],
        client_attestations: [
          {
            question_id: "Q1",
            question: "Where does the trust boundary sit between the public API and internal services?",
            response: "At the API gateway and again between the cloud app tier and the on-prem HSM network.",
            answer_source: "user_attested",
          },
        ],
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("complete");
    expect(data.missing).toHaveLength(0);
  });

  it("marks STRIDE risk calibration incomplete when a threat is missing cvss_score", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_3c_risk_calibration",
      definition_version: "1.0",
      stage_state: {
        system_name: "Payments API",
        components: [
          { id: "api", name: "API", type: "process" },
          { id: "db", name: "DB", type: "data_store" },
        ],
        threats: [
          {
            id: "T1",
            stride_category: "Spoofing",
            component_id: "api",
            title: "Forged token accepted",
            description: "An attacker can submit a forged bearer token to impersonate a trusted caller.",
            mcp_source: "search_stride_patterns",
            cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:L/SC:N/SI:N/SA:N",
          },
        ],
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    expect(data.missing.some((m: { rule: string; details: string }) => m.rule === "every_threat_has_cvss" && m.details.includes("score"))).toBe(true);
  });

  it("marks STRIDE risk calibration incomplete when a threat is missing severity", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_3c_risk_calibration",
      definition_version: "1.0",
      stage_state: {
        system_name: "Payments API",
        threats: [
          {
            id: "T1",
            stride_category: "Spoofing",
            component_id: "api",
            title: "Forged token accepted",
            description: "An attacker can submit a forged bearer token to impersonate a trusted caller.",
            mcp_source: "search_stride_patterns",
            cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:L/SC:N/SI:N/SA:N",
            cvss_score: 8.7,
          },
        ],
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    expect(data.missing.some((m: { rule: string }) => m.rule === "every_threat_has_severity")).toBe(true);
  });

  it("marks STRIDE risk calibration incomplete when a threat is missing business context", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_3c_risk_calibration",
      definition_version: "1.0",
      stage_state: {
        system_name: "Payments API",
        threats: [
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
            business_impact: "Account takeover and unauthorized payment initiation.",
          },
        ],
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    expect(data.missing.some((m: { rule: string }) => m.rule === "every_threat_has_business_context")).toBe(true);
  });

  it("returns STRIDE quality warnings when too many threats are llm-reasoned", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_2_stride_enumeration",
      definition_version: "1.0",
      stage_state: {
        system_name: "Payments API",
        components: [
          { id: "api", name: "API", type: "process" },
        ],
        threats: [
          {
            id: "T1",
            stride_category: "Spoofing",
            component_id: "api",
            title: "Forged token accepted",
            description: "An attacker can submit a forged bearer token to impersonate a trusted caller.",
            mcp_source: "llm-reasoned",
          },
        ],
        coverage_matrix: {
          api: {
            Spoofing: true,
            Tampering: true,
            Repudiation: true,
            "Information Disclosure": true,
            "Denial of Service": true,
            "Elevation of Privilege": true,
          },
        },
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("complete_with_quality_warnings");
    expect(data.warnings.some((w: { rule: string }) => w.rule === "mcp_grounding_sufficient")).toBe(true);
  });

  it("returns STRIDE quality warnings when document evidence omits citation detail", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_2_stride_enumeration",
      definition_version: "1.0",
      stage_state: {
        system_name: "Payments API",
        components: [
          { id: "api", name: "API", type: "process" },
        ],
        threats: [
          {
            id: "T1",
            stride_category: "Spoofing",
            component_id: "api",
            title: "Forged token accepted",
            description: "An attacker can submit a forged bearer token to impersonate a trusted caller.",
            mcp_source: "search_stride_patterns",
            document_citations: [
              {
                document: "architecture.md",
                evidence_type: "document_evidence",
              },
            ],
          },
        ],
        coverage_matrix: {
          api: {
            Spoofing: true,
            Tampering: true,
            Repudiation: true,
            "Information Disclosure": true,
            "Denial of Service": true,
            "Elevation of Privilege": true,
          },
        },
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("complete_with_quality_warnings");
    expect(data.warnings.some((w: { rule: string }) => w.rule === "document_evidence_has_citation_details")).toBe(true);
  });

  it("returns STRIDE quality warnings when mitigation controls arrays are empty", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_5_mitigation_mapping",
      definition_version: "1.0",
      stage_state: {
        threats: [
          {
            id: "T1",
            stride_category: "Spoofing",
            component_id: "api",
            title: "Forged token accepted",
            mcp_source: "search_stride_patterns",
            severity: "medium",
          },
        ],
        threat_mitigations: [
          {
            threat_id: "T1",
            controls: [],
          },
        ],
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("complete_with_quality_warnings");
    expect(data.warnings.some((w: { field: string }) => w.field === "threat_mitigations[0].controls")).toBe(true);
  });

  it("returns STRIDE quality warnings when all scored threats have the same severity", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_3c_risk_calibration",
      definition_version: "1.0",
      stage_state: {
        threats: Array.from({ length: 5 }, (_, index) => ({
          id: `T${index + 1}`,
          stride_category: "Spoofing",
          component_id: "api",
          title: `Threat ${index + 1}`,
          description: "An attacker can submit a forged bearer token to impersonate a trusted caller.",
          mcp_source: "search_stride_patterns",
          cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:L/SC:N/SI:N/SA:N",
          cvss_score: 8.7,
          severity: "high",
          business_risk_tier: "high",
          business_impact: "Unauthorized account use and transaction fraud.",
          likelihood: "likely",
          likelihood_rationale: "The attack path is exposed over the network with no stated anti-replay controls.",
          cvss_rationale: "Network-reachable authentication bypass with direct integrity and confidentiality impact.",
        })),
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("complete_with_quality_warnings");
    expect(data.warnings.some((w: { rule: string }) => w.rule === "severity_distribution_has_signal")).toBe(true);
  });

  it("warns when a large enrichment phase has no batching metadata", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_3b_threat_enrichment",
      definition_version: "1.0",
      stage_state: {
        threats: Array.from({ length: 20 }, (_, index) => ({
          id: `T${index + 1}`,
          stride_category: "Tampering",
          component_id: `c${(index % 4) + 1}`,
          title: `Threat ${index + 1}`,
          description: "An attacker can alter payment instructions across an exposed trust boundary without robust integrity checks.",
          mcp_source: "search_stride_patterns",
        })),
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("complete_with_quality_warnings");
    expect(data.warnings.some((w: { rule: string }) => w.rule === "large_threat_models_use_batching")).toBe(true);
  });

  it("marks attack path synthesis incomplete when related threat ids are unknown", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_4a_attack_path_synthesis",
      definition_version: "1.0",
      stage_state: {
        threats: [
          {
            id: "T1",
            stride_category: "Spoofing",
            component_id: "api",
            title: "Forged token accepted",
            description: "An attacker can submit a forged bearer token to impersonate a trusted caller.",
            mcp_source: "search_stride_patterns",
          },
        ],
        attack_paths: [
          {
            id: "AP-1",
            title: "Session theft to fraudulent transfer",
            summary: "The attacker chains authentication spoofing into transaction manipulation.",
            related_threat_ids: ["T999"],
          },
        ],
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    expect(data.missing.some((m: { rule: string }) => m.rule === "attack_paths_reference_known_threats")).toBe(true);
  });

  it("marks verification test generation incomplete when related threat ids are unknown", async () => {
    const result = await checkStageCompleteness({
      task_id: "stride_threat_model",
      phase_id: "phase_4b_verification_test_generation",
      definition_version: "1.0",
      stage_state: {
        threats: [
          {
            id: "T1",
            stride_category: "Spoofing",
            component_id: "api",
            title: "Forged token accepted",
            description: "An attacker can submit a forged bearer token to impersonate a trusted caller.",
            mcp_source: "search_stride_patterns",
          },
        ],
        verification_tests: [
          {
            id: "VT-1",
            title: "Replay stale access token",
            objective: "Confirm expired or replayed tokens are rejected.",
            procedure: ["Capture a token and replay it after expiry."],
            expected_result: "The API rejects the replayed token and logs the attempt.",
            related_threat_ids: ["T404"],
          },
        ],
      },
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    expect(data.missing.some((m: { rule: string }) => m.rule === "verification_tests_reference_known_threats")).toBe(true);
  });
});
