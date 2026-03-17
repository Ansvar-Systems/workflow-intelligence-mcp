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

  it("returns vendor_risk_triage definition with correct metadata", async () => {
    const result = await getTaskDefinition({ task_id: "vendor_risk_triage" });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.id).toBe("vendor_risk_triage");
    expect(parsed.category).toBe("tprm");
    expect(parsed.version).toBe("1.0");
    expect(parsed.standalone).toBe(true);
    expect(parsed.stage_state_schema).toBeDefined();
    expect(parsed.completion_criteria).toBeDefined();
    expect(parsed.phases).toBeDefined();
    expect(parsed.phases.length).toBe(5);
    expect(parsed.mcp_tools).toBeDefined();
  });

  it("returns vendor_risk_assessment definition with authority detection and 7 phases", async () => {
    const result = await getTaskDefinition({ task_id: "vendor_risk_assessment" });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.id).toBe("vendor_risk_assessment");
    expect(parsed.category).toBe("tprm");
    expect(parsed.phases.length).toBe(7);
    expect(parsed.authority_detection).toBeDefined();
    expect(parsed.authority_detection.signals).toBeDefined();
    expect(parsed.authority_detection.authority_expert_hints).toBeDefined();
    expect(parsed.stage_state_schema).toBeDefined();
    expect(parsed.stage_state_schema.properties.intake_from_triage).toBeDefined();
    expect(parsed.stage_state_schema.properties.findings_register).toBeDefined();
    expect(parsed.stage_state_schema.properties.domain_scores).toBeDefined();
    expect(parsed.stage_state_schema.properties.overall_score).toBeDefined();
    expect(parsed.vendor_risk_entry_schema).toBeDefined();
    expect(parsed.mcp_tools.length).toBe(11);
  });

  it("exposes the expanded STRIDE workflow backbone and MCP grounding surface", async () => {
    const result = await getTaskDefinition({ task_id: "stride_threat_model" });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);

    const phaseIds = data.phases.map((phase: { id: string }) => phase.id);
    expect(phaseIds).toContain("phase_0_evidence_manifest");
    expect(phaseIds).toContain("phase_2b_domain_challenge");
    expect(phaseIds).toContain("phase_3b_threat_enrichment");
    expect(phaseIds).toContain("phase_3c_risk_calibration");
    expect(phaseIds).toContain("phase_4a_attack_path_synthesis");
    expect(phaseIds).toContain("phase_4b_verification_test_generation");
    expect(phaseIds).toContain("phase_5_mitigation_mapping");
    expect(phaseIds).toContain("phase_6_report_assembly");

    const threatIntel = data.mcp_tools.find((tool: { mcp: string }) => tool.mcp === "threat-intel-mcp");
    expect(threatIntel.tools).toContain("search_d3fend_defenses");
    expect(threatIntel.tools).toContain("search_atlas_techniques");

    const pentestKnowledge = data.mcp_tools.find((tool: { mcp: string }) => tool.mcp === "pentest-knowledge-mcp");
    expect(pentestKnowledge.tools).toContain("pt_get_attack_surface");

    const securityControls = data.mcp_tools.find((tool: { mcp: string }) => tool.mcp === "security-controls-mcp");
    expect(securityControls.tools).toContain("map_frameworks");
  });
});
