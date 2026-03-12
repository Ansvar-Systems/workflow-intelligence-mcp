import { describe, it, expect } from "vitest";
import { checkDomainChallengeCoherence } from "../../src/validation/rules/stride.js";

describe("checkDomainChallengeCoherence", () => {
  it("returns no failures when no domains detected and no experts used", () => {
    const state = { threats: [], components: [] };
    const failures = checkDomainChallengeCoherence(state);
    expect(failures).toHaveLength(0);
  });

  it("warns when domains detected but no experts consulted", () => {
    const state = {
      detected_domains: ["healthcare", "cloud"],
      domain_experts_used: [],
      threats: [],
    };
    const failures = checkDomainChallengeCoherence(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe("domain_challenge_coherence");
    expect(failures[0].severity).toBe("warning");
    expect(failures[0].details).toContain("healthcare");
    expect(failures[0].details).toContain("cloud");
  });

  it("warns when an expert delegation failed", () => {
    const state = {
      detected_domains: ["healthcare"],
      domain_experts_used: [
        { agent_id: "healthcare-expert", status: "failed" },
      ],
      domain_findings: [],
      threats: [],
    };
    const failures = checkDomainChallengeCoherence(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].details).toContain("healthcare-expert");
    expect(failures[0].details).toContain("failed");
  });

  it("warns when finding has suggested_threat but was not merged or rejected", () => {
    const state = {
      detected_domains: ["healthcare"],
      domain_experts_used: [
        { agent_id: "healthcare-expert", status: "complete", findings_count: 1 },
      ],
      domain_findings: [
        {
          id: "DF-HC-001",
          domain: "healthcare",
          title: "PHI exposure",
          description: "FHIR bulk export returns unsegmented PHI",
          status: "net_new",
          source_agent: "healthcare-expert",
          suggested_threat: {
            stride_category: "Information Disclosure",
            title: "PHI bulk export",
            description: "Unsegmented PHI in bulk export",
          },
        },
      ],
      threats: [],
    };
    const failures = checkDomainChallengeCoherence(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].details).toContain("DF-HC-001");
    expect(failures[0].details).toContain("suggested_threat");
  });

  it("does not warn when finding with suggested_threat was merged", () => {
    const state = {
      detected_domains: ["healthcare"],
      domain_experts_used: [
        { agent_id: "healthcare-expert", status: "complete", findings_count: 1 },
      ],
      domain_findings: [
        {
          id: "DF-HC-001",
          domain: "healthcare",
          title: "PHI exposure",
          description: "FHIR bulk export returns unsegmented PHI",
          status: "merged",
          source_agent: "healthcare-expert",
          merged_as_threat_id: "T-I-010",
          suggested_threat: {
            stride_category: "Information Disclosure",
            title: "PHI bulk export",
            description: "Unsegmented PHI in bulk export",
          },
        },
      ],
      threats: [],
    };
    const failures = checkDomainChallengeCoherence(state);
    expect(failures).toHaveLength(0);
  });

  it("does not warn when finding with suggested_threat was rejected", () => {
    const state = {
      detected_domains: ["healthcare"],
      domain_experts_used: [
        { agent_id: "healthcare-expert", status: "complete", findings_count: 1 },
      ],
      domain_findings: [
        {
          id: "DF-HC-001",
          domain: "healthcare",
          title: "PHI exposure",
          description: "FHIR bulk export returns unsegmented PHI",
          status: "rejected",
          source_agent: "healthcare-expert",
          suggested_threat: {
            stride_category: "Information Disclosure",
            title: "PHI bulk export",
            description: "Unsegmented PHI in bulk export",
          },
        },
      ],
      threats: [],
    };
    const failures = checkDomainChallengeCoherence(state);
    expect(failures).toHaveLength(0);
  });

  it("errors when finding is missing source_agent", () => {
    const state = {
      detected_domains: ["automotive"],
      domain_experts_used: [
        { agent_id: "automotive-expert", status: "complete", findings_count: 1 },
      ],
      domain_findings: [
        {
          id: "DF-AUTO-001",
          domain: "automotive",
          title: "CAN bus injection",
          description: "No authentication on CAN bus frames",
          status: "net_new",
        },
      ],
      threats: [],
    };
    const failures = checkDomainChallengeCoherence(state);
    const sourceFailure = failures.find((f) => f.details.includes("source_agent"));
    expect(sourceFailure).toBeDefined();
    expect(sourceFailure!.severity).toBe("required");
  });

  it("returns no failures when domains detected and experts completed successfully", () => {
    const state = {
      detected_domains: ["healthcare"],
      domain_experts_used: [
        { agent_id: "healthcare-expert", status: "complete", findings_count: 2 },
      ],
      domain_findings: [
        {
          id: "DF-HC-001",
          domain: "healthcare",
          title: "PHI exposure",
          description: "FHIR bulk export returns unsegmented PHI",
          status: "merged",
          source_agent: "healthcare-expert",
          merged_as_threat_id: "T-I-010",
          suggested_threat: {
            stride_category: "Information Disclosure",
            title: "PHI bulk export",
            description: "Unsegmented PHI in bulk export",
          },
        },
        {
          id: "DF-HC-002",
          domain: "healthcare",
          title: "HL7v2 injection",
          description: "No auth on MLLP channel allows message injection",
          status: "net_new",
          source_agent: "healthcare-expert",
        },
      ],
      threats: [],
    };
    const failures = checkDomainChallengeCoherence(state);
    expect(failures).toHaveLength(0);
  });
});
