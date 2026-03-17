import { describe, it, expect } from "vitest";
import {
  checkManifestCoverage,
  type ManifestCoverageResult,
} from "../../src/validation/rules/manifest-coverage.js";

const MINI_MANIFEST = {
  framework_id: "DORA",
  scope: "Regulation (EU) 2022/2554",
  version: "2025-01-17",
  article_groups: [
    {
      id: "governance",
      name: "Governance",
      articles: [
        { ref: "Art. 5(1)", topic: "Board responsibility" },
        { ref: "Art. 5(2)", topic: "Non-delegable accountability" },
      ],
    },
    {
      id: "tpp",
      name: "TPP",
      articles: [
        { ref: "Art. 28(6)", topic: "Notification to competent authority" },
        { ref: "Art. 31", topic: "Designation of critical TPPs" },
      ],
    },
  ],
};

describe("manifest_coverage_check", () => {
  it("returns complete when all manifest refs have matrix entries", () => {
    const matrix = [
      { requirement_id: "Art. 5(1)", authority_id: "DORA", verdict: "documented" },
      { requirement_id: "Art. 5(2)", authority_id: "DORA", verdict: "not_found" },
      { requirement_id: "Art. 28(6)", authority_id: "DORA", verdict: "partially_documented" },
      { requirement_id: "Art. 31", authority_id: "DORA", verdict: "documented" },
    ];
    const result = checkManifestCoverage(MINI_MANIFEST, matrix, "DORA");
    expect(result.missing_refs).toHaveLength(0);
    expect(result.coverage_ratio).toBe(1.0);
    expect(result.pass).toBe(true);
  });

  it("detects missing refs", () => {
    const matrix = [
      { requirement_id: "Art. 5(1)", authority_id: "DORA", verdict: "documented" },
      { requirement_id: "Art. 5(2)", authority_id: "DORA", verdict: "documented" },
    ];
    const result = checkManifestCoverage(MINI_MANIFEST, matrix, "DORA");
    expect(result.missing_refs).toEqual(["Art. 28(6)", "Art. 31"]);
    expect(result.coverage_ratio).toBe(0.5);
    expect(result.pass).toBe(false);
  });

  it("treats null/empty verdict as missing", () => {
    const matrix = [
      { requirement_id: "Art. 5(1)", authority_id: "DORA", verdict: "documented" },
      { requirement_id: "Art. 5(2)", authority_id: "DORA", verdict: "" },
      { requirement_id: "Art. 28(6)", authority_id: "DORA", verdict: null },
      { requirement_id: "Art. 31", authority_id: "DORA", verdict: "documented" },
    ];
    const result = checkManifestCoverage(MINI_MANIFEST, matrix, "DORA");
    expect(result.missing_refs).toEqual(["Art. 5(2)", "Art. 28(6)"]);
    expect(result.pass).toBe(false);
  });

  it("only matches entries with the correct authority_id", () => {
    const matrix = [
      { requirement_id: "Art. 5(1)", authority_id: "DORA", verdict: "documented" },
      { requirement_id: "Art. 5(2)", authority_id: "NIS2", verdict: "documented" },
      { requirement_id: "Art. 28(6)", authority_id: "DORA", verdict: "documented" },
      { requirement_id: "Art. 31", authority_id: "DORA", verdict: "documented" },
    ];
    const result = checkManifestCoverage(MINI_MANIFEST, matrix, "DORA");
    expect(result.missing_refs).toEqual(["Art. 5(2)"]);
    expect(result.pass).toBe(false);
  });

  it("returns manifest-order for missing refs", () => {
    const matrix: any[] = [];
    const result = checkManifestCoverage(MINI_MANIFEST, matrix, "DORA");
    expect(result.missing_refs).toEqual([
      "Art. 5(1)", "Art. 5(2)", "Art. 28(6)", "Art. 31",
    ]);
  });

  it("handles empty manifest gracefully", () => {
    const emptyManifest = { ...MINI_MANIFEST, article_groups: [] };
    const result = checkManifestCoverage(emptyManifest, [], "DORA");
    expect(result.missing_refs).toHaveLength(0);
    expect(result.coverage_ratio).toBe(1.0);
    expect(result.pass).toBe(true);
  });

  it("ignores extra matrix entries not in manifest", () => {
    const matrix = [
      { requirement_id: "Art. 5(1)", authority_id: "DORA", verdict: "documented" },
      { requirement_id: "Art. 5(2)", authority_id: "DORA", verdict: "documented" },
      { requirement_id: "Art. 28(6)", authority_id: "DORA", verdict: "documented" },
      { requirement_id: "Art. 31", authority_id: "DORA", verdict: "documented" },
      { requirement_id: "Art. 99", authority_id: "DORA", verdict: "documented" },
    ];
    const result = checkManifestCoverage(MINI_MANIFEST, matrix, "DORA");
    expect(result.pass).toBe(true);
    expect(result.coverage_ratio).toBe(1.0);
  });
});
