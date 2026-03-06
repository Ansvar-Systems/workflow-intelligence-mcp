import { describe, it, expect } from "vitest";
import { evaluateCompleteness } from "../../src/validation/engine.js";
import type { CompletionCriteria } from "../../src/types/task.js";
import emptyFixture from "../fixtures/gap-analysis-empty.json";
import completeFixture from "../fixtures/gap-analysis-complete.json";

const gapAnalysisCriteria: CompletionCriteria = {
  required_fields: [
    { field: "sections", rule: "min_count" as const, value: 1, message: "At least one section is required" },
  ],
  rules: [
    { id: "all_provisions_assessed", description: "", severity: "required" as const, message_template: "" },
    { id: "gaps_required_for_non_compliant", description: "", severity: "required" as const, message_template: "" },
    { id: "exemption_basis_required", description: "", severity: "required" as const, message_template: "" },
    { id: "evidence_required_for_compliant", description: "", severity: "required" as const, message_template: "" },
    { id: "assessor_metadata_present", description: "", severity: "required" as const, message_template: "" },
    { id: "evidence_has_date", description: "", severity: "warning" as const, message_template: "" },
  ],
  soft_warnings: [],
};

describe("gap analysis engine integration", () => {
  it("returns incomplete for empty gap analysis", () => {
    const result = evaluateCompleteness(emptyFixture, gapAnalysisCriteria, {});
    expect(result.status).toBe("incomplete");
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("returns complete or complete_with_quality_warnings for full assessment", () => {
    const result = evaluateCompleteness(completeFixture, gapAnalysisCriteria, {});
    expect(["complete", "complete_with_quality_warnings"]).toContain(result.status);
  });
});
