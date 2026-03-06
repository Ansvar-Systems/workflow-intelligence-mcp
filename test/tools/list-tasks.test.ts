import { describe, it, expect } from "vitest";
import { listTasks } from "../../src/tools/list-tasks.js";

describe("list_tasks", () => {
  it("returns DFD construction task", async () => {
    const result = await listTasks({});
    const data = JSON.parse(result.content[0].text);
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].id).toBe("dfd_construction");
    expect(data.tasks[0].standalone).toBe(true);
    expect(data.tasks[0].version).toBe("1.0");
  });

  it("filters by category", async () => {
    const result = await listTasks({ category: "threat_modeling" });
    const data = JSON.parse(result.content[0].text);
    expect(data.tasks).toHaveLength(1);

    const empty = await listTasks({ category: "nonexistent" });
    const emptyData = JSON.parse(empty.content[0].text);
    expect(emptyData.tasks).toHaveLength(0);
  });

  it("includes _meta", async () => {
    const result = await listTasks({});
    const data = JSON.parse(result.content[0].text);
    expect(data._meta).toBeDefined();
    expect(data._meta.server).toBe("workflow-intelligence-mcp");
  });
});
