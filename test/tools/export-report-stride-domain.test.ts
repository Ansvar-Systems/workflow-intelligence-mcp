import { describe, it, expect } from "vitest";
import { buildStrideReport } from "../../src/tools/export-report-stride.js";
import type { StrideReportBuildInput } from "../../src/tools/export-report-stride.js";

function minimalInput(overrides: Partial<StrideReportBuildInput> = {}): StrideReportBuildInput {
  return {
    assessmentId: "test-001",
    systemName: "Test System",
    components: [{ id: "C1", name: "API", type: "process" }],
    dataFlows: [],
    trustBoundaries: [],
    existingControls: [],
    threats: [
      {
        id: "T-S-001",
        stride_category: "Spoofing",
        component_id: "C1",
        title: "Token forgery",
        description: "Attacker forges authentication token via weak signing key",
        severity: "high",
        cvss_score: 7.5,
        cvss_vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N",
        mcp_source: "stride-mcp:SP-001",
      },
    ],
    mitigations: [],
    gaps: [],
    dfdMarkdown: null,
    documentsReviewed: [],
    ...overrides,
  };
}

describe("buildStrideReport — Domain Expert Challenge section", () => {
  it("includes domain expert challenge section when domain data is present", () => {
    const input = minimalInput({
      detectedDomains: ["healthcare"],
      domainExpertsUsed: [
        { agent_id: "healthcare-expert", display_name: "Healthcare Compliance Expert", status: "complete", findings_count: 1, domain: "healthcare" },
      ],
      domainFindings: [
        {
          id: "DF-HC-001",
          domain: "healthcare",
          title: "PHI exposure via FHIR bulk export",
          description: "FHIR $export returns unsegmented PHI",
          status: "net_new",
          severity: "high",
          source_agent: "healthcare-expert",
        },
      ],
      domainAttestations: ["System processes PHI -- HIPAA Security Rule applies"],
    });
    const report = buildStrideReport(input);
    expect(report).toContain("Domain Expert Challenge");
    expect(report).toContain("healthcare-expert");
    expect(report).toContain("PHI exposure via FHIR bulk export");
    expect(report).toContain("System processes PHI");
  });

  it("shows skip message when no domain signals detected", () => {
    const input = minimalInput({
      detectedDomains: [],
      domainExpertsUsed: [],
      domainFindings: [],
    });
    const report = buildStrideReport(input);
    expect(report).toContain("Domain Expert Challenge");
    expect(report).toContain("No domain signals detected");
  });

  it("notes failed expert delegations", () => {
    const input = minimalInput({
      detectedDomains: ["automotive"],
      domainExpertsUsed: [
        { agent_id: "automotive-expert", display_name: "Automotive Cybersecurity Expert", status: "failed", findings_count: 0, domain: "automotive" },
      ],
      domainFindings: [],
    });
    const report = buildStrideReport(input);
    expect(report).toContain("failed");
    expect(report).toContain("automotive-expert");
  });

  it("omits domain section entirely when no domain fields are present (backwards compatibility)", () => {
    const input = minimalInput();
    const report = buildStrideReport(input);
    expect(report).not.toContain("Domain Expert Challenge");
  });
});
