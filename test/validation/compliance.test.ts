import { describe, it, expect } from "vitest";
import {
  checkEveryRequirementHasVerdict,
  checkEveryCompliantHasEvidence,
  checkEveryPartialHasGap,
  checkNoHighConfidenceWithoutQuote,
  checkIntakeResponsesComplete,
  checkFrameworkVersionRecorded,
} from "../../src/validation/rules/compliance.js";

describe("compliance structural rules", () => {
  describe("every_requirement_has_verdict", () => {
    it("passes when all applicable requirements have matrix entries", () => {
      const state = {
        requirement_register: [
          { req_id: "A.1", applicable: true },
          { req_id: "A.2", applicable: true },
          { req_id: "A.3", applicable: false },
        ],
        compliance_matrix: [
          { req_id: "A.1", verdict: "compliant" },
          { req_id: "A.2", verdict: "not_found" },
        ],
      };
      expect(checkEveryRequirementHasVerdict(state)).toHaveLength(0);
    });

    it("fails when applicable requirement lacks matrix entry", () => {
      const state = {
        requirement_register: [
          { req_id: "A.1", applicable: true },
          { req_id: "A.2", applicable: true },
        ],
        compliance_matrix: [{ req_id: "A.1", verdict: "compliant" }],
      };
      const failures = checkEveryRequirementHasVerdict(state);
      expect(failures).toHaveLength(1);
      expect(failures[0].details).toContain("A.2");
    });

    it("ignores non-applicable requirements", () => {
      const state = {
        requirement_register: [{ req_id: "A.1", applicable: false }],
        compliance_matrix: [],
      };
      expect(checkEveryRequirementHasVerdict(state)).toHaveLength(0);
    });

    it("returns empty when register or matrix is missing", () => {
      expect(checkEveryRequirementHasVerdict({})).toHaveLength(0);
      expect(
        checkEveryRequirementHasVerdict({ requirement_register: [] }),
      ).toHaveLength(0);
    });
  });

  describe("every_compliant_has_evidence", () => {
    it("passes when compliant entries have evidence", () => {
      const state = {
        compliance_matrix: [
          {
            req_id: "A.1",
            verdict: "compliant",
            evidence_refs: [{ doc_id: "d1", section_ref: "s1" }],
          },
          { req_id: "A.2", verdict: "not_found" },
        ],
      };
      expect(checkEveryCompliantHasEvidence(state)).toHaveLength(0);
    });

    it("fails when compliant entry has no evidence", () => {
      const state = {
        compliance_matrix: [
          { req_id: "A.1", verdict: "compliant", evidence_refs: [] },
          { req_id: "A.2", verdict: "compliant" },
        ],
      };
      const failures = checkEveryCompliantHasEvidence(state);
      expect(failures).toHaveLength(2);
    });

    it("does not check non-compliant verdicts", () => {
      const state = {
        compliance_matrix: [
          { req_id: "A.1", verdict: "not_found" },
          { req_id: "A.2", verdict: "partial", evidence_refs: [] },
        ],
      };
      expect(checkEveryCompliantHasEvidence(state)).toHaveLength(0);
    });
  });

  describe("every_partial_has_gap", () => {
    it("passes when partial entries have gap descriptions", () => {
      const state = {
        compliance_matrix: [
          {
            req_id: "A.1",
            verdict: "partial",
            gap_description: "Missing periodic review",
          },
        ],
      };
      expect(checkEveryPartialHasGap(state)).toHaveLength(0);
    });

    it("fails when partial entry lacks gap description", () => {
      const state = {
        compliance_matrix: [{ req_id: "A.1", verdict: "partial" }],
      };
      const failures = checkEveryPartialHasGap(state);
      expect(failures).toHaveLength(1);
      expect(failures[0].details).toContain("A.1");
    });
  });

  describe("no_high_confidence_without_quote", () => {
    it("passes when high-confidence entries have quotes", () => {
      const state = {
        compliance_matrix: [
          {
            req_id: "A.1",
            verdict: "compliant",
            confidence: "high",
            verbatim_quote: "Access is reviewed quarterly",
          },
        ],
      };
      expect(checkNoHighConfidenceWithoutQuote(state)).toHaveLength(0);
    });

    it("warns when high-confidence entry lacks quote", () => {
      const state = {
        compliance_matrix: [
          { req_id: "A.1", verdict: "compliant", confidence: "high" },
        ],
      };
      const failures = checkNoHighConfidenceWithoutQuote(state);
      expect(failures).toHaveLength(1);
      expect(failures[0].severity).toBe("warning");
    });

    it("skips not_applicable and not_found verdicts", () => {
      const state = {
        compliance_matrix: [
          { req_id: "A.1", verdict: "not_applicable", confidence: "high" },
          { req_id: "A.2", verdict: "not_found", confidence: "high" },
        ],
      };
      expect(checkNoHighConfidenceWithoutQuote(state)).toHaveLength(0);
    });

    it("does not warn for medium/low confidence", () => {
      const state = {
        compliance_matrix: [
          { req_id: "A.1", verdict: "compliant", confidence: "medium" },
          { req_id: "A.2", verdict: "partial", confidence: "low" },
        ],
      };
      expect(checkNoHighConfidenceWithoutQuote(state)).toHaveLength(0);
    });
  });

  describe("intake_responses_complete", () => {
    it("passes when all questions have responses", () => {
      const state = {
        intake_questions: [{ id: "q1" }, { id: "q2" }],
        intake_responses: [
          { question_id: "q1", response: "yes" },
          { question_id: "q2", response: "no" },
        ],
      };
      expect(checkIntakeResponsesComplete(state)).toHaveLength(0);
    });

    it("fails when a question has no response", () => {
      const state = {
        intake_questions: [{ id: "q1" }, { id: "q2" }],
        intake_responses: [{ question_id: "q1", response: "yes" }],
      };
      const failures = checkIntakeResponsesComplete(state);
      expect(failures).toHaveLength(1);
      expect(failures[0].details).toContain("q2");
    });

    it("returns empty when no intake questions", () => {
      expect(checkIntakeResponsesComplete({})).toHaveLength(0);
      expect(
        checkIntakeResponsesComplete({ intake_questions: [] }),
      ).toHaveLength(0);
    });

    it("fails all when no responses exist", () => {
      const state = {
        intake_questions: [{ id: "q1" }, { id: "q2" }],
      };
      expect(checkIntakeResponsesComplete(state)).toHaveLength(2);
    });
  });

  describe("framework_version_recorded", () => {
    it("passes when all frameworks have versions", () => {
      const state = {
        requirement_register: [
          { req_id: "A.1", framework: "iso27001" },
          { req_id: "B.1", framework: "nis2" },
        ],
        enumeration_metadata: {
          framework_versions: { iso27001: "2022", nis2: "2022/2555" },
        },
      };
      expect(checkFrameworkVersionRecorded(state)).toHaveLength(0);
    });

    it("fails when a framework is missing a version", () => {
      const state = {
        requirement_register: [
          { req_id: "A.1", framework: "iso27001" },
          { req_id: "B.1", framework: "nis2" },
        ],
        enumeration_metadata: {
          framework_versions: { iso27001: "2022" },
        },
      };
      const failures = checkFrameworkVersionRecorded(state);
      expect(failures).toHaveLength(1);
      expect(failures[0].details).toContain("nis2");
    });

    it("returns empty when metadata is missing", () => {
      expect(checkFrameworkVersionRecorded({})).toHaveLength(0);
    });

    it("fails when enumeration_metadata exists but framework_versions is missing", () => {
      const state = {
        requirement_register: [
          { req_id: "A.1", framework: "iso27001", applicable: true },
        ],
        enumeration_metadata: {
          frameworks_queried: ["iso27001"],
          total_requirements: 1,
        },
      };
      const failures = checkFrameworkVersionRecorded(state);
      expect(failures).toHaveLength(1);
      expect(failures[0].details).toContain("iso27001");
    });
  });
});
