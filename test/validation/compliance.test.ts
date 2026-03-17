import { describe, it, expect } from "vitest";
import {
  checkEveryRequirementHasVerdict,
  checkEveryCompliantHasEvidence,
  checkEveryPartialHasGap,
  checkNoHighConfidenceWithoutQuote,
  checkIntakeResponsesComplete,
  checkFrameworkVersionRecorded,
} from "../../src/validation/rules/compliance.js";
import { checkManifestCoverage, checkManifestCoverageRule, checkDepthIssuesRule } from "../../src/validation/rules/manifest-coverage.js";
import { loadManifest } from "../../src/definitions/manifests/loader.js";
import { getRegisteredRules } from "../../src/validation/engine.js";

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

describe("manifest_coverage_check integration", () => {
  it("rule is registered in the validation engine", () => {
    const rules = getRegisteredRules();
    expect(rules.has("manifest_coverage_check")).toBe(true);
  });

  it("rule wrapper extracts manifest_coverage_input and compliance_matrix from state", () => {
    const manifest = loadManifest("DORA")!;
    const matrix = manifest.article_groups
      .flatMap((g) => g.articles)
      .filter((a) => a.ref !== "Art. 28(6)")
      .map((a) => ({
        requirement_id: a.ref,
        authority_id: "DORA",
        verdict: "documented",
      }));

    const state: Record<string, unknown> = {
      manifest_coverage_input: { manifest, authority_id: "DORA" },
      compliance_matrix: matrix,
    };

    const failures = checkManifestCoverageRule(state);
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe("manifest_coverage_check");
    expect(failures[0].severity).toBe("required");
    expect(failures[0].details).toContain("Art. 28(6)");
  });

  it("rule wrapper returns required failure when manifest_coverage_input is missing", () => {
    const failures = checkManifestCoverageRule({ compliance_matrix: [] });
    expect(failures).toHaveLength(1);
    expect(failures[0].severity).toBe("required");
    expect(failures[0].details).toContain("manifest_coverage_input is missing");
  });

  it("depth issues rule returns warnings when flagged_shallow is populated", () => {
    const state = {
      validation_state: {
        flagged_shallow: [
          { ref: "Art. 5(2)", severity: "insufficient", detail: "Missing non-delegable accountability" },
          { ref: "Art. 19(2)", severity: "not_addressed", detail: "Missing three-phase reporting" },
        ],
      },
    };
    const failures = checkDepthIssuesRule(state);
    expect(failures).toHaveLength(2);
    expect(failures[0].severity).toBe("warning");
    expect(failures[0].details).toContain("Art. 5(2)");
    expect(failures[1].details).toContain("Art. 19(2)");
  });

  it("depth issues rule returns empty when no flagged_shallow", () => {
    expect(checkDepthIssuesRule({})).toHaveLength(0);
    expect(checkDepthIssuesRule({ validation_state: {} })).toHaveLength(0);
    expect(checkDepthIssuesRule({ validation_state: { flagged_shallow: [] } })).toHaveLength(0);
  });

  it("tool-level: returns complete_with_quality_warnings when coverage passes but depth issues exist", async () => {
    const { checkStageCompleteness } = await import("../../src/tools/check-stage-completeness.js");
    const manifest = loadManifest("DORA")!;

    // Full coverage — all refs assessed
    const matrix = manifest.article_groups
      .flatMap((g) => g.articles)
      .map((a) => ({
        authority_id: "DORA",
        authority_type: "regulation",
        authority_title: "DORA",
        requirement_id: a.ref,
        requirement_text: a.topic,
        source_kind: "mcp_grounded",
        verdict: "documented",
        confidence: "high",
      }));

    const result = await checkStageCompleteness({
      task_id: "gap_analysis",
      phase_id: "phase_4b_validate",
      definition_version: "2.0",
      stage_state: {
        manifest_coverage_input: { manifest, authority_id: "DORA" },
        compliance_matrix: matrix,
        validation_state: {
          flagged_shallow: [
            { ref: "Art. 5(2)", severity: "insufficient", detail: "Missing non-delegable accountability" },
          ],
        },
        documents: [{ doc_id: "test", filename: "test.pdf" }],
        detected_authorities: [{ authority_id: "DORA", authority_type: "regulation", authority_title: "DORA" }],
      },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("complete_with_quality_warnings");
    expect(parsed.warnings.some((w: any) => w.details.includes("Art. 5(2)"))).toBe(true);
  });

  it("tool-level: returns incomplete when manifest_coverage_input is missing", async () => {
    const { checkStageCompleteness } = await import("../../src/tools/check-stage-completeness.js");

    const result = await checkStageCompleteness({
      task_id: "gap_analysis",
      phase_id: "phase_4b_validate",
      definition_version: "2.0",
      stage_state: {
        compliance_matrix: [],
        documents: [{ doc_id: "test", filename: "test.pdf" }],
        detected_authorities: [{ authority_id: "DORA", authority_type: "regulation", authority_title: "DORA" }],
      },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("incomplete");
    expect(parsed.missing.some((f: any) => f.details.includes("manifest_coverage_input is missing"))).toBe(true);
  });

  it("full tool-level test: checkStageCompleteness returns incomplete for missing refs", async () => {
    const { checkStageCompleteness } = await import("../../src/tools/check-stage-completeness.js");
    const manifest = loadManifest("DORA")!;

    const matrix = manifest.article_groups
      .flatMap((g) => g.articles)
      .filter((a) => a.ref !== "Art. 28(6)")
      .map((a) => ({
        authority_id: "DORA",
        authority_type: "regulation",
        authority_title: "DORA",
        requirement_id: a.ref,
        requirement_text: a.topic,
        source_kind: "mcp_grounded",
        verdict: "documented",
        confidence: "high",
      }));

    const result = await checkStageCompleteness({
      task_id: "gap_analysis",
      phase_id: "phase_4b_validate",
      definition_version: "2.0",
      stage_state: {
        manifest_coverage_input: { manifest, authority_id: "DORA" },
        compliance_matrix: matrix,
        documents: [{ doc_id: "test", filename: "test.pdf" }],
        detected_authorities: [{ authority_id: "DORA", authority_type: "regulation", authority_title: "DORA" }],
      },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("incomplete");
    expect(parsed.missing.some((f: any) => f.details.includes("Art. 28(6)"))).toBe(true);
  });

  it("detects Art. 28(6) as missing — the systematic blind spot", () => {
    const manifest = loadManifest("DORA")!;
    expect(manifest).not.toBeNull();

    const matrix = manifest.article_groups
      .flatMap((g) => g.articles)
      .filter((a) => a.ref !== "Art. 28(6)")
      .map((a) => ({
        requirement_id: a.ref,
        authority_id: "DORA",
        verdict: "documented",
      }));

    const result = checkManifestCoverage(manifest, matrix, "DORA");
    expect(result.pass).toBe(false);
    expect(result.missing_refs).toEqual(["Art. 28(6)"]);
    expect(result.coverage_ratio).toBeCloseTo(63 / 64, 2);
  });

  it("detects Art. 31-33 as missing — the variance issue", () => {
    const manifest = loadManifest("DORA")!;
    const overseerRefs = new Set(["Art. 31", "Art. 32", "Art. 33"]);

    const matrix = manifest.article_groups
      .flatMap((g) => g.articles)
      .filter((a) => !overseerRefs.has(a.ref))
      .map((a) => ({
        requirement_id: a.ref,
        authority_id: "DORA",
        verdict: "documented",
      }));

    const result = checkManifestCoverage(manifest, matrix, "DORA");
    expect(result.pass).toBe(false);
    expect(result.missing_refs).toEqual(["Art. 31", "Art. 32", "Art. 33"]);
  });

  it("auto_remediate_cap limits to first 10 in manifest order", () => {
    const manifest = loadManifest("DORA")!;
    const result = checkManifestCoverage(manifest, [], "DORA");
    expect(result.missing_refs.length).toBe(64);

    const AUTO_REMEDIATE_CAP = 10;
    const autoRemediate = result.missing_refs.slice(0, AUTO_REMEDIATE_CAP);
    const overflow = result.missing_refs.slice(AUTO_REMEDIATE_CAP);

    expect(autoRemediate).toHaveLength(10);
    expect(overflow).toHaveLength(54);
    expect(autoRemediate[0]).toBe("Art. 5(1)");
  });
});
