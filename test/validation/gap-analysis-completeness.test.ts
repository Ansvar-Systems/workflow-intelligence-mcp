import { describe, it, expect } from "vitest";
import { checkAllProvisionsAssessed } from "../../src/validation/rules/gap-analysis-completeness.js";
import type { GapAnalysisStageState } from "../../src/types/gap-analysis.js";
import emptyFixture from "../fixtures/gap-analysis-empty.json";
import completeFixture from "../fixtures/gap-analysis-complete.json";
import partialFixture from "../fixtures/gap-analysis-partial.json";

describe("checkAllProvisionsAssessed", () => {
  it("passes when all provisions are assessed", () => {
    const failures = checkAllProvisionsAssessed(
      completeFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(0);
  });

  it("fails for every not_assessed provision", () => {
    const failures = checkAllProvisionsAssessed(
      emptyFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(6);
    expect(failures[0].severity).toBe("required");
    expect(failures[0].rule).toBe("all_provisions_assessed");
  });

  it("fails only for not_assessed provisions in partial state", () => {
    const failures = checkAllProvisionsAssessed(
      partialFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(3);
    for (const f of failures) {
      expect(f.details).toContain("pillar_2");
    }
  });

  it("includes provision_ref in failure details", () => {
    const failures = checkAllProvisionsAssessed(
      emptyFixture as unknown as GapAnalysisStageState,
    );
    expect(failures[0].details).toContain("DORA Art. 5(1)");
  });
});
