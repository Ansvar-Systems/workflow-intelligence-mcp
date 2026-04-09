import { describe, it, expect } from "vitest";
import { checkDomainFindingsMerged } from "../../src/validation/rules/ai-tara-domain.js";

describe("checkDomainFindingsMerged", () => {
  it("should fail when findings have pending status", () => {
    const state = {
      domain_findings: [
        { id: "df1", status: "merged", merged_as_threat_id: "P-010" },
        { id: "df2", status: "pending" },
      ],
    };
    const failures = checkDomainFindingsMerged(state);
    expect(failures.length).toBe(1);
    expect(failures[0].details).toContain("df2");
  });

  it("should pass when all findings are merged or rejected", () => {
    const state = {
      domain_findings: [
        { id: "df1", status: "merged", merged_as_threat_id: "P-010" },
        { id: "df2", status: "rejected", rejection_reason: "duplicate" },
      ],
    };
    const failures = checkDomainFindingsMerged(state);
    expect(failures.length).toBe(0);
  });

  it("should pass when domain_findings is empty", () => {
    const state = { domain_findings: [] };
    const failures = checkDomainFindingsMerged(state);
    expect(failures.length).toBe(0);
  });

  it("should pass when domain_findings is absent", () => {
    const state = {};
    const failures = checkDomainFindingsMerged(state);
    expect(failures.length).toBe(0);
  });
});
