import type { ToolResult } from "./index.js";
import { getLoadedTasks } from "./get-task-definition.js";

const META = {
  server: "workflow-intelligence-mcp",
  version: "1.0.0",
  disclaimer:
    "Workflow definitions support structured assessments. Results depend on the accuracy and completeness of input data.",
};

export async function about(): Promise<ToolResult> {
  const tasks = getLoadedTasks();
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            name: "Workflow Intelligence MCP",
            version: META.version,
            description:
              "Provides workflow definitions, domain intelligence, and quality gates for structured assessments. Agents use this MCP to guide users through tasks like DFD construction, threat modeling, and compliance gap analysis.",
            available_tasks: tasks.length,
            capabilities: [
              "Task definitions with stage-state schemas and completion criteria",
              "Quality gates: structural validation + quality rubrics",
              "Cross-MCP tool manifests (declares which external MCP tools are relevant per stage)",
              "Trust boundary suggestion heuristics for DFD construction",
            ],
            tier_model: {
              starter: "Basic workflows (MSB InfoSec, IR Readiness, standalone DFD)",
              professional:
                "Full catalog (STRIDE, DORA, MDR, AI Act, NIS 2 Gap Analysis, all domain tools)",
            },
            _meta: META,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function listSources(): Promise<ToolResult> {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            sources: [
              {
                id: "workflow-definitions",
                name: "Ansvar Workflow Definitions",
                type: "internal",
                description:
                  "JSON-based workflow and task definitions with stage-state schemas, completion criteria, quality rubrics, and dependency declarations.",
                update_frequency: "Per release",
              },
              {
                id: "dfd-validation-rules",
                name: "DFD Structural Validation Rules",
                type: "internal",
                description:
                  "Rules for validating data flow diagram structural completeness: referential integrity, connectivity, trust boundary placement.",
                update_frequency: "Per release",
              },
              {
                id: "trust-boundary-heuristics",
                name: "Trust Boundary Placement Heuristics",
                type: "internal",
                description:
                  "Rule-based architectural patterns for suggesting trust boundary placement in data flow diagrams.",
                update_frequency: "Per release",
              },
              {
                id: "dora-gap-analysis-structure",
                name: "DORA Gap Analysis Structure",
                type: "internal",
                description:
                  "Pillar-to-provision mapping for DORA (Regulation (EU) 2022/2554) covering 103 provisions across 5 pillars. Provision text fetched from eu-regulations-mcp at runtime.",
                update_frequency: "Per release",
              },
              {
                id: "gap-analysis-validation-rules",
                name: "Gap Analysis Validation Rules",
                type: "internal",
                description:
                  "6 validation rules for regulatory gap analyses: completeness, evidence quality, exemption basis, assessor metadata, consistency checks.",
                update_frequency: "Per release",
              },
            ],
            _meta: {
              server: META.server,
              version: META.version,
              disclaimer: META.disclaimer,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}
