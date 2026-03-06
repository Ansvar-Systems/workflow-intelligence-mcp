import { describe, it, expect } from "vitest";
import { getTaskDefinition } from "../../src/tools/get-task-definition.js";
import Ajv from "ajv";

describe("get_task_definition", () => {
  it("returns full definition for dfd_construction", async () => {
    const result = await getTaskDefinition({ task_id: "dfd_construction" });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe("dfd_construction");
    expect(data.version).toBe("1.0");
    expect(data.stage_state_schema).toBeDefined();
    expect(data.completion_criteria).toBeDefined();
    expect(data.quality_rubric).toBeDefined();
    expect(data.mcp_tools).toBeDefined();
    expect(data.dependencies).toEqual([]);
    expect(data.prompting_guidance).toContain("DFD");
  });

  it("returns error for nonexistent task", async () => {
    const result = await getTaskDefinition({ task_id: "nonexistent" });
    expect(result.isError).toBe(true);
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toBe("task_not_found");
  });

  it("includes _meta with disclaimer", async () => {
    const result = await getTaskDefinition({ task_id: "dfd_construction" });
    const data = JSON.parse(result.content[0].text);
    expect(data._meta).toBeDefined();
    expect(data._meta.server).toBe("workflow-intelligence-mcp");
    expect(data._meta.disclaimer).toBeDefined();
  });

  it("returns compilable JSON Schema in stage_state_schema", async () => {
    const result = await getTaskDefinition({ task_id: "dfd_construction" });
    const data = JSON.parse(result.content[0].text);
    const ajv = new Ajv();
    const validate = ajv.compile(data.stage_state_schema);
    expect(typeof validate).toBe("function");
  });

  it("includes cross-MCP tool manifest", async () => {
    const result = await getTaskDefinition({ task_id: "dfd_construction" });
    const data = JSON.parse(result.content[0].text);
    expect(data.mcp_tools).toHaveLength(2);
    expect(data.mcp_tools[0].mcp).toBe("security-controls-mcp");
    expect(data.mcp_tools[0].tools).toContain("search_controls");
    expect(data.mcp_tools[0].guidance).toBeDefined();
  });
});
