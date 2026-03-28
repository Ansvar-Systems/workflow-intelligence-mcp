/** Tool registry — maps tool names to handlers. */

import { listTasks } from "./list-tasks.js";
import { getTaskDefinition } from "./get-task-definition.js";
import { checkStageCompleteness } from "./check-stage-completeness.js";
import { suggestTrustBoundaries } from "./suggest-trust-boundaries.js";
import { generateGapSummary } from "./generate-gap-summary.js";
import { requestReview } from "./request-review.js";
import { about, listSources } from "./meta.js";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<ToolResult>;

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  list_tasks: listTasks,
  get_task_definition: getTaskDefinition,
  check_stage_completeness: checkStageCompleteness,
  suggest_trust_boundaries: suggestTrustBoundaries,
  generate_gap_summary: generateGapSummary,
  request_review: requestReview,
  about,
  list_sources: listSources,
};

export const TOOL_DEFINITIONS = [
  {
    name: "list_tasks",
    description:
      "List all available tasks with metadata. Tasks are atomic structured activities (e.g., DFD construction, control mapping) that can run standalone or compose into workflows.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description:
            'Filter by category (e.g., "threat_modeling", "gap_analysis"). Omit to list all.',
        },
      },
    },
  },
  {
    name: "get_task_definition",
    description:
      "Get the full definition of a task including its stage-state schema, completion criteria, quality rubrics, dependencies, cross-MCP tool manifest, and prompting guidance.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: {
          type: "string",
          description: "The task identifier (e.g., dfd_construction).",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "check_stage_completeness",
    description:
      'Validate collected stage data against the task\'s completion criteria and quality rubrics. Returns "incomplete" (blocking issues), "complete_with_quality_warnings" (structure OK but depth issues), or "complete" (all gates pass).',
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: {
          type: "string",
          description: "The task identifier.",
        },
        stage_id: {
          type: "string",
          description: "The stage identifier (same as task_id for standalone tasks).",
        },
        definition_version: {
          type: "string",
          description: "Version from get_task_definition, for version negotiation.",
        },
        stage_state: {
          type: "object",
          description: "The collected stage data, conforming to the task's stage_state_schema.",
        },
      },
      required: ["task_id", "stage_id", "definition_version", "stage_state"],
    },
  },
  {
    name: "suggest_trust_boundaries",
    description:
      "Given DFD elements (processes, data stores, external entities, data flows), suggest trust boundary placement using architectural heuristics. Deterministic, no LLM calls.",
    inputSchema: {
      type: "object" as const,
      properties: {
        processes: {
          type: "array",
          description: "Array of DFD processes.",
        },
        data_stores: {
          type: "array",
          description: "Array of DFD data stores.",
        },
        external_entities: {
          type: "array",
          description: "Array of DFD external entities.",
        },
        data_flows: {
          type: "array",
          description: "Array of DFD data flows.",
        },
        existing_boundaries: {
          type: "array",
          description: "Already-defined trust boundaries (optional). Suggestions will exclude elements already enclosed.",
        },
      },
      required: ["processes", "data_stores", "external_entities", "data_flows"],
    },
  },
  {
    name: "generate_gap_summary",
    description:
      "Generate a structured compliance gap summary from a completed regulatory gap analysis. Returns per-section compliance counts, prioritized gap inventory ranked by regulatory weight, and export-ready metadata. Deterministic output, no LLM calls.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: {
          type: "string",
          description:
            "The gap analysis task ID (e.g., 'dora_gap_analysis')",
        },
        stage_state: {
          type: "object",
          description:
            "The completed GapAnalysisStageState with scoping and section assessments",
        },
      },
      required: ["task_id", "stage_state"],
    },
  },
  {
    name: "request_review",
    description:
      "Pause the workflow and request user review before continuing to the next phase. Call this after wkfl_check_stage_completeness passes for a phase that requires customer approval. The workflow will stop and show a review card to the user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        phase_id: {
          type: "string",
          description:
            "Phase identifier (e.g., 'phase_2_dfd_construction')",
        },
        phase_name: {
          type: "string",
          description: "Human-readable phase name shown to the user",
        },
        summary: {
          type: "string",
          description:
            "Summary of completed work for the user to review. Include key outputs, counts, and any decisions made.",
        },
        assessment_id: {
          type: "string",
          description: "Assessment ID for state retrieval (optional)",
        },
      },
      required: ["phase_id", "phase_name", "summary"],
    },
  },
  {
    name: "about",
    description: "Information about the Workflow Intelligence MCP server.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_sources",
    description: "List the data sources and knowledge bases used by this MCP.",
    inputSchema: { type: "object" as const, properties: {} },
  },
];
