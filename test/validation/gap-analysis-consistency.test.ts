import { describe, it, expect } from "vitest";
import {
  checkExemptionBasisRequired,
  checkAssessorMetadataPresent,
} from "../../src/validation/rules/gap-analysis-consistency.js";
import type { GapAnalysisStageState } from "../../src/types/gap-analysis.js";
import completeFixture from "../fixtures/gap-analysis-complete.json";
import noBasisFixture from "../fixtures/gap-analysis-not-applicable-no-basis.json";

describe("checkExemptionBasisRequired", () => {
  it("passes when all not_applicable items have exemption_basis", () => {
    const failures = checkExemptionBasisRequired(
      completeFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(0);
  });

  it("fails when not_applicable item has no exemption_basis", () => {
    const failures = checkExemptionBasisRequired(
      noBasisFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].severity).toBe("required");
    expect(failures[0].rule).toBe("exemption_basis_required");
    expect(failures[0].details).toContain("DORA Art. 17(2)");
  });

  it("ignores non-not_applicable items without exemption_basis", () => {
    const failures = checkExemptionBasisRequired(
      completeFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(0);
  });
});

describe("checkAssessorMetadataPresent", () => {
  it("passes when all assessed provisions have assessor metadata", () => {
    const failures = checkAssessorMetadataPresent(
      completeFixture as unknown as GapAnalysisStageState,
    );
    expect(failures).toHaveLength(0);
  });

  it("fails when assessed provision has empty assessed_by", () => {
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
              assessed_by: "",
              assessed_at: "2026-03-06T00:00:00Z",
            },
          ],
        },
      ],
    };
    const failures = checkAssessorMetadataPresent(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe("assessor_metadata_present");
  });

  it("fails when assessed provision has empty assessed_at", () => {
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
              assessed_at: "",
            },
          ],
        },
      ],
    };
    const failures = checkAssessorMetadataPresent(state);
    expect(failures).toHaveLength(1);
  });

  it("skips not_assessed provisions (they have no assessor yet)", () => {
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
              status: "not_assessed",
              evidence: [],
              gaps: null,
              exemption_basis: null,
              assessed_by: "",
              assessed_at: "",
            },
          ],
        },
      ],
    };
    const failures = checkAssessorMetadataPresent(state);
    expect(failures).toHaveLength(0);
  });
});
