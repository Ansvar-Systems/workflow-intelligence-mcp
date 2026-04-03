import { describe, it, expect } from "vitest";
import { listTasks } from "../../src/tools/list-tasks.js";

describe("list_tasks", () => {
  it("returns all registered tasks", async () => {
    const result = await listTasks({});
    const data = JSON.parse(result.content[0].text);
    expect(data.tasks.length).toBeGreaterThanOrEqual(2);
    const ids = data.tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain("dfd_construction");
    expect(ids).toContain("gap_analysis");
  });

  it("filters by category", async () => {
    const result = await listTasks({ category: "threat_modeling" });
    const data = JSON.parse(result.content[0].text);
    expect(data.tasks).toHaveLength(3);

    const empty = await listTasks({ category: "nonexistent" });
    const emptyData = JSON.parse(empty.content[0].text);
    expect(emptyData.tasks).toHaveLength(0);
  });

  it("lists vendor_risk_triage in tprm category", async () => {
    const result = await listTasks({ category: "tprm" });
    const parsed = JSON.parse(result.content[0].text);
    const ids = parsed.tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain("vendor_risk_triage");
  });

  it("lists both TPRM tasks in tprm category", async () => {
    const result = await listTasks({ category: "tprm" });
    const parsed = JSON.parse(result.content[0].text);
    const ids = parsed.tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain("vendor_risk_assessment");
    expect(ids).toContain("vendor_risk_triage");
    expect(parsed.tasks.length).toBe(2);
  });

  it("includes _meta", async () => {
    const result = await listTasks({});
    const data = JSON.parse(result.content[0].text);
    expect(data._meta).toBeDefined();
    expect(data._meta.server).toBe("workflow-intelligence-mcp");
  });
});
