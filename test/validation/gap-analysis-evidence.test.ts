import { describe, it, expect } from "vitest";
import {
  checkGapsRequiredForNonCompliant,
  checkEvidenceRequiredForCompliant,
  checkEvidenceHasDate,
  checkGapDescriptionQuality,
} from "../../src/validation/rules/gap-analysis-evidence.js";
import type { GapAnalysisStageState } from "../../src/types/gap-analysis.js";
import completeFixture from "../fixtures/gap-analysis-complete.json";
import noGapsFixture from "../fixtures/gap-analysis-non-compliant-no-gaps.json";
import noEvidenceFixture from "../fixtures/gap-analysis-compliant-no-evidence.json";

describe("checkGapsRequiredForNonCompliant", () => {
  it("passes when all non-compliant items have gaps", () => {
    const failures = checkGapsRequiredForNonCompliant(
      completeFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(0);
  });

  it("fails when non_compliant item has no gaps", () => {
    const failures = checkGapsRequiredForNonCompliant(
      noGapsFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].severity).toBe("required");
    expect(failures[0].rule).toBe("gaps_required_for_non_compliant");
    expect(failures[0].details).toContain("RTS ICT Risk Art. 1(1)");
  });

  it("also requires gaps for partially_compliant items", () => {
    const failures = checkGapsRequiredForNonCompliant(
      completeFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(0);
  });
});

describe("checkEvidenceRequiredForCompliant", () => {
  it("passes when all compliant items have evidence", () => {
    const failures = checkEvidenceRequiredForCompliant(
      completeFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(0);
  });

  it("fails when compliant item has empty evidence", () => {
    const failures = checkEvidenceRequiredForCompliant(
      noEvidenceFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].severity).toBe("required");
    expect(failures[0].rule).toBe("evidence_required_for_compliant");
    expect(failures[0].details).toContain("DORA Art. 5(1)");
  });

  it("does not require evidence for non_compliant items", () => {
    const failures = checkEvidenceRequiredForCompliant(
      completeFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(0);
  });
});

describe("checkEvidenceHasDate", () => {
  it("passes when all evidence records have dates", () => {
    const failures = checkEvidenceHasDate(
      completeFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(0);
  });

  it("warns when evidence record is missing date", () => {
    const state: GapAnalysisStageState = {
      scoping: {},
      sections: [
        {
          section_id: "test",
          section_name: "Test",
          provisions: [
            {
              provision_ref: "Test Art. 1",
              regulation_source: "test",
              status: "compliant",
              evidence: [{ type: "policy", reference: "Policy XYZ" }],
              gaps: null,
              exemption_basis: null,
              assessed_by: "Tester",
              assessed_at: "2026-03-06T00:00:00Z",
            },
          ],
        },
      ],
    };
    const failures = checkEvidenceHasDate(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].severity).toBe("warning");
    expect(failures[0].rule).toBe("evidence_has_date");
  });
});

describe("checkGapDescriptionQuality", () => {
  it("passes when gap descriptions have enough words", () => {
    const failures = checkGapDescriptionQuality(
      completeFixture as unknown as GapAnalysisStageState,
    );
    // Complete fixture has ~25-word gap descriptions
    expect(failures).toHaveLength(0);
  });

  it("warns when gap description is too brief", () => {
    const state: GapAnalysisStageState = {
      scoping: {},
      sections: [
        {
          section_id: "test",
          section_name: "Test",
          provisions: [
            {
              provision_ref: "Test Art. 1",
              regulation_source: "test",
              status: "non_compliant",
              evidence: [],
              gaps: "Too short",
              exemption_basis: null,
              assessed_by: "Tester",
              assessed_at: "2026-03-06T00:00:00Z",
            },
          ],
        },
      ],
    };
    const failures = checkGapDescriptionQuality(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].severity).toBe("warning");
    expect(failures[0].rule).toBe("gap_description_quality");
  });

  it("skips provisions with null gaps", () => {
    const state: GapAnalysisStageState = {
      scoping: {},
      sections: [
        {
          section_id: "test",
          section_name: "Test",
          provisions: [
            {
              provision_ref: "Test Art. 1",
              regulation_source: "test",
              status: "compliant",
              evidence: [
                { type: "policy", reference: "Policy ABC", date: "2026-01-01" },
              ],
              gaps: null,
              exemption_basis: null,
              assessed_by: "Tester",
              assessed_at: "2026-03-06T00:00:00Z",
            },
          ],
        },
      ],
    };
    const failures = checkGapDescriptionQuality(state);
    expect(failures).toHaveLength(0);
  });
});
