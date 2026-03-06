import { describe, it, expect } from "vitest";
import { listTasks } from "../../src/tools/list-tasks.js";
import { getTaskDefinition } from "../../src/tools/get-task-definition.js";
import { checkStageCompleteness } from "../../src/tools/check-stage-completeness.js";
import { generateGapSummary } from "../../src/tools/generate-gap-summary.js";
import emptyFixture from "../fixtures/gap-analysis-empty.json";
import completeFixture from "../fixtures/gap-analysis-complete.json";

describe("DORA gap analysis — end-to-end workflow", () => {
  it("discovers dora_gap_analysis via list_tasks", async () => {
    const result = await listTasks({ category: "compliance_gap_analysis" });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    const ids = data.tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain("dora_gap_analysis");
  });

  it("retrieves the full task definition with 6+ completion rules", async () => {
    const result = await getTaskDefinition({ task_id: "dora_gap_analysis" });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe("dora_gap_analysis");
    expect(data.completion_criteria).toBeDefined();
    expect(data.completion_criteria.rules.length).toBeGreaterThanOrEqual(6);
  });

  it("reports incomplete for empty stage state", async () => {
    const result = await checkStageCompleteness({
      task_id: "dora_gap_analysis",
      stage_id: "dora_gap_analysis",
      definition_version: "1.0",
      stage_state: emptyFixture,
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("incomplete");
  });

  it("reports complete or complete_with_quality_warnings for full stage state", async () => {
    const result = await checkStageCompleteness({
      task_id: "dora_gap_analysis",
      stage_id: "dora_gap_analysis",
      definition_version: "1.0",
      stage_state: completeFixture,
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toMatch(/^complete/);
  });

  it("generates a gap summary with ranking and assessors", async () => {
    const result = await generateGapSummary({
      task_id: "dora_gap_analysis",
      stage_state: completeFixture,
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    expect(data.overall_status).toBe("gaps_identified");
    expect(data.remediation_ranking.length).toBeGreaterThan(0);
    expect(data.assessors).toContain("J. Smith");
  });
});
