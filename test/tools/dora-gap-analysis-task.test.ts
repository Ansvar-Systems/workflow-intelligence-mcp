import { describe, it, expect } from "vitest";
import { getTaskDefinition, getTaskById, getLoadedTasks } from "../../src/tools/get-task-definition.js";
import Ajv from "ajv";

describe("DORA gap analysis task definition", () => {
  it("loads the DORA task definition", () => {
    const def = getTaskById("dora_gap_analysis");
    expect(def).toBeDefined();
    expect(def!.name).toBe("DORA Gap Analysis");
    expect(def!.category).toBe("compliance_gap_analysis");
  });

  it("has 5 sections in sections_definition", () => {
    const def = getTaskById("dora_gap_analysis");
    expect(def).toBeDefined();
    const sections = (def as Record<string, unknown>).sections_definition as unknown[];
    expect(sections).toHaveLength(5);
    const ids = sections.map((s: Record<string, unknown>) => s.id);
    expect(ids).toContain("pillar_1_ict_risk_management");
    expect(ids).toContain("pillar_2_incident_reporting");
    expect(ids).toContain("pillar_3_resilience_testing");
    expect(ids).toContain("pillar_4_third_party_risk");
    expect(ids).toContain("pillar_5_information_sharing");
  });

  it("declares eu-regulations-mcp in tool manifest", () => {
    const def = getTaskById("dora_gap_analysis");
    expect(def).toBeDefined();
    const euRegTool = def!.mcp_tools.find((t) => t.mcp === "eu-regulations-mcp");
    expect(euRegTool).toBeDefined();
    expect(euRegTool!.tools).toContain("get_article");
    expect(euRegTool!.tools).toContain("search_regulations");
    expect(euRegTool!.when).toBe("always");
  });

  it("declares security-controls-mcp in tool manifest", () => {
    const def = getTaskById("dora_gap_analysis");
    expect(def).toBeDefined();
    const secTool = def!.mcp_tools.find((t) => t.mcp === "security-controls-mcp");
    expect(secTool).toBeDefined();
    expect(secTool!.tools).toContain("search_controls");
    expect(secTool!.tools).toContain("get_control");
    expect(secTool!.when).toBe("evidence_gathering");
  });

  it("has completion criteria with all 9 gap analysis rules", () => {
    const def = getTaskById("dora_gap_analysis");
    expect(def).toBeDefined();
    const rules = def!.completion_criteria.rules;
    expect(rules).toHaveLength(9);
    const ruleIds = rules.map((r) => r.id);
    expect(ruleIds).toContain("all_provisions_assessed");
    expect(ruleIds).toContain("gaps_required_for_non_compliant");
    expect(ruleIds).toContain("exemption_basis_required");
    expect(ruleIds).toContain("evidence_required_for_compliant");
    expect(ruleIds).toContain("assessor_metadata_present");
    expect(ruleIds).toContain("evidence_has_date");
    expect(ruleIds).toContain("gap_description_quality");
    expect(ruleIds).toContain("exemption_basis_quality");
    expect(ruleIds).toContain("evidence_reference_quality");
  });

  it("has scoping schema with DORA entity types", () => {
    const def = getTaskById("dora_gap_analysis");
    expect(def).toBeDefined();
    const schema = def!.stage_state_schema as Record<string, unknown>;
    const props = schema.properties as Record<string, unknown>;
    expect(props.scoping).toBeDefined();
    const scopingProps = (props.scoping as Record<string, unknown>).properties as Record<string, unknown>;
    const entityType = scopingProps.entity_type as Record<string, unknown>;
    const entityTypeEnum = entityType.enum as string[];
    expect(entityTypeEnum).toHaveLength(21);
    expect(entityTypeEnum).toContain("credit_institution");
    expect(entityTypeEnum).toContain("crypto_asset_service_provider");
    expect(entityTypeEnum).toContain("ict_third_party_service_provider");
  });

  it("stage_state_schema is a valid JSON Schema", () => {
    const def = getTaskById("dora_gap_analysis");
    expect(def).toBeDefined();
    // Strip $schema meta-identifier before AJV compilation (AJV uses draft-07 by default)
    const { $schema, ...schemaBody } = def!.stage_state_schema as Record<string, unknown>;
    expect($schema).toBe("https://json-schema.org/draft/2020-12/schema");
    const ajv = new Ajv();
    const validate = ajv.compile(schemaBody);
    expect(typeof validate).toBe("function");
  });

  it("appears in list_tasks", () => {
    const tasks = getLoadedTasks();
    const dora = tasks.find((t) => t.id === "dora_gap_analysis");
    expect(dora).toBeDefined();
    expect(dora!.standalone).toBe(true);
    expect(dora!.version).toBe("1.0");
  });

  it("returns full definition via getTaskDefinition tool", async () => {
    const result = await getTaskDefinition({ task_id: "dora_gap_analysis" });
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe("dora_gap_analysis");
    expect(data.description).toContain("DORA");
    expect(data.prompting_guidance).toContain("entity scoping");
    expect(data._meta).toBeDefined();
    expect(data._meta.server).toBe("workflow-intelligence-mcp");
  });

  it("has 231 total provisions across all pillars (Level 1 + 8 RTS + 2 ITS)", () => {
    const def = getTaskById("dora_gap_analysis");
    expect(def).toBeDefined();
    const sections = (def as Record<string, unknown>).sections_definition as Array<Record<string, unknown>>;
    const totalProvisions = sections.reduce(
      (sum, section) => sum + (section.provisions as unknown[]).length,
      0,
    );
    expect(totalProvisions).toBe(231);
  });

  it("pillar provision counts match expected distribution", () => {
    const def = getTaskById("dora_gap_analysis");
    expect(def).toBeDefined();
    const sections = (def as Record<string, unknown>).sections_definition as Array<Record<string, unknown>>;
    const counts: Record<string, number> = {};
    for (const section of sections) {
      counts[section.id as string] = (section.provisions as unknown[]).length;
    }
    expect(counts.pillar_1_ict_risk_management).toBe(98);
    expect(counts.pillar_2_incident_reporting).toBe(39);
    expect(counts.pillar_3_resilience_testing).toBe(35);
    expect(counts.pillar_4_third_party_risk).toBe(56);
    expect(counts.pillar_5_information_sharing).toBe(3);
  });

  it("quality rubric is empty (min_words enforced via structural rules)", () => {
    const def = getTaskById("dora_gap_analysis");
    expect(def).toBeDefined();
    const rubric = def!.quality_rubric as Record<string, unknown>;
    expect(Object.keys(rubric)).toHaveLength(0);
  });
});
