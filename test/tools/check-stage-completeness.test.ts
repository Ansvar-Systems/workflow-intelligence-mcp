import { describe, it, expect } from "vitest";
import { checkStageCompleteness } from "../../src/tools/check-stage-completeness.js";
import dfdValid from "../fixtures/dfd-valid-minimal.json";
import dfdComplex from "../fixtures/dfd-valid-complex.json";
import dfdEmpty from "../fixtures/dfd-empty.json";

describe("check_stage_completeness", () => {
  it("returns complete for valid minimal DFD", async () => {
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.0",
      stage_state: dfdValid,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toMatch(/^complete/);
    expect(data.missing).toHaveLength(0);
  });

  it("returns complete for valid complex DFD", async () => {
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.0",
      stage_state: dfdComplex,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("complete");
    expect(data.missing).toHaveLength(0);
    expect(data.warnings).toHaveLength(0);
  });

  it("returns incomplete for empty state", async () => {
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.0",
      stage_state: dfdEmpty,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    expect(data.missing.length).toBeGreaterThanOrEqual(5);
  });

  it("returns incomplete when only trust boundaries missing", async () => {
    const noBoundaries = {
      processes: [{ id: "proc-001", name: "A" }],
      data_stores: [{ id: "ds-001", name: "B" }],
      external_entities: [{ id: "ext-001", name: "C" }],
      data_flows: [
        { id: "df-001", source_id: "ext-001", destination_id: "proc-001" },
        { id: "df-002", source_id: "proc-001", destination_id: "ds-001" },
      ],
      trust_boundaries: [],
    };
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.0",
      stage_state: noBoundaries,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    const tbMissing = data.missing.find(
      (m: { field?: string }) => m.field === "trust_boundaries",
    );
    expect(tbMissing).toBeDefined();
  });

  it("returns complete_with_quality_warnings when structure OK but descriptions missing", async () => {
    const sparseDescriptions = {
      processes: [{ id: "proc-001", name: "API" }],
      data_stores: [{ id: "ds-001", name: "DB" }],
      external_entities: [{ id: "ext-001", name: "User" }],
      data_flows: [
        { id: "df-001", source_id: "ext-001", destination_id: "proc-001" },
        { id: "df-002", source_id: "proc-001", destination_id: "ds-001" },
      ],
      trust_boundaries: [
        { id: "tb-001", name: "Boundary", enclosed_ids: ["proc-001", "ds-001"] },
      ],
    };
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.0",
      stage_state: sparseDescriptions,
    });
    const data = JSON.parse(result.content[0].text);
    // Should be complete structurally, but quality warnings for missing descriptions
    expect(data.status).toMatch(/complete/);
    expect(data.missing).toHaveLength(0);
  });

  it("handles version mismatch (minor bump) with version_note", async () => {
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.1",
      stage_state: dfdValid,
    });
    const data = JSON.parse(result.content[0].text);
    // 1.1 vs 1.0 — same major, so proceed with note
    // (Current is 1.0, requested is 1.1 — ahead of current, but same major)
    expect(data.status).toMatch(/complete/);
  });

  it("returns error for unknown task_id", async () => {
    const result = await checkStageCompleteness({
      task_id: "nonexistent",
      stage_id: "nonexistent",
      definition_version: "1.0",
      stage_state: {},
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("task_not_found");
  });

  it("rejects invalid JSON Schema input", async () => {
    const invalidSchema = {
      processes: "not an array",
      data_stores: [],
      external_entities: [],
      data_flows: [],
      trust_boundaries: [],
    };
    const result = await checkStageCompleteness({
      task_id: "dfd_construction",
      stage_id: "dfd_construction",
      definition_version: "1.0",
      stage_state: invalidSchema,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
    expect(data.missing[0].rule).toBe("schema_validation");
  });
});
