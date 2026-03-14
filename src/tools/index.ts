/** Tool registry — maps tool names to handlers. */

import { listTasks } from "./list-tasks.js";
import { getTaskDefinition } from "./get-task-definition.js";
import { checkStageCompleteness } from "./check-stage-completeness.js";
import { suggestTrustBoundaries } from "./suggest-trust-boundaries.js";
import { about, listSources } from "./meta.js";
import {
  wkflStoreState,
  wkflLoadState,
  wkflListStates,
  wkflDeleteAssessment,
} from "./state.js";
import { wkflExportReport } from "./export-report.js";

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
  wkfl_store_state: wkflStoreState,
  wkfl_load_state: wkflLoadState,
  wkfl_list_states: wkflListStates,
  wkfl_delete_assessment: wkflDeleteAssessment,
  wkfl_export_report: wkflExportReport,
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
      "Get a task definition. When phase is provided, returns only that phase's criteria plus shared schema and relevant tools (much smaller response). When phase is omitted, returns the full definition. Use phase-scoped calls during execution to stay within context budget.",
    inputSchema: {
      type: "object" as const,
      properties: {
        task_id: {
          type: "string",
          description: "The task identifier (e.g., dfd_construction, stride_threat_model).",
        },
        phase: {
          type: "string",
          description: "Optional phase ID (e.g., phase_0_evidence_manifest, phase_2b_domain_challenge). When provided, returns only the specified phase plus shared schema and phase-relevant MCP tools. Omit to get the full definition.",
        },
      },
      required: ["task_id"],
    },
  },
  {
    name: "check_stage_completeness",
    description:
      'Validate stage data against task completion criteria and quality rubrics. Returns "incomplete", "complete_with_quality_warnings", or "complete". If stage_state is omitted, loads from stored state using assessment_id.',
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
        phase_id: {
          type: "string",
          description: "Optional phase identifier for multi-phase tasks. When provided, validates against the phase-specific completion criteria.",
        },
        definition_version: {
          type: "string",
          description: "Version from get_task_definition. Defaults to '1.0' if omitted.",
        },
        assessment_id: {
          type: "string",
          description: "Assessment identifier for loading stored state. Used when stage_state is omitted.",
        },
        stage_state: {
          type: "object",
          description: "The collected stage data. If omitted, the tool loads previously stored state using assessment_id.",
        },
      },
      required: ["task_id"],
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
    name: "wkfl_store_state",
    description:
      "Persist assessment state (phase outputs, completed domain groups, matrix slices) to disk. Enables context window management for large assessments and session resume after timeout.",
    inputSchema: {
      type: "object" as const,
      properties: {
        assessment_id: {
          type: "string",
          description:
            "Unique assessment identifier. Use a stable ID so state can be resumed across sessions.",
        },
        key: {
          type: "string",
          description:
            'State key (e.g., "phase_1_scoping", "group_access_control", "phase_2_requirements"). Alphanumeric, hyphens, underscores, dots.',
        },
        data: {
          description: "The data to persist (any JSON-serializable value).",
        },
      },
      required: ["assessment_id", "key", "data"],
    },
  },
  {
    name: "wkfl_load_state",
    description:
      "Load previously stored assessment state by assessment_id and key. Use to retrieve completed domain groups, phase outputs, or resume an interrupted assessment.",
    inputSchema: {
      type: "object" as const,
      properties: {
        assessment_id: {
          type: "string",
          description: "Assessment identifier.",
        },
        key: {
          type: "string",
          description: "State key to load.",
        },
      },
      required: ["assessment_id", "key"],
    },
  },
  {
    name: "wkfl_list_states",
    description:
      "List all stored state keys for an assessment. Use to check progress, find completed domain groups, or determine resume point after a session interruption.",
    inputSchema: {
      type: "object" as const,
      properties: {
        assessment_id: {
          type: "string",
          description: "Assessment identifier.",
        },
      },
      required: ["assessment_id"],
    },
  },
  {
    name: "wkfl_export_report",
    description:
      'Assemble a formatted assessment report from stored state. Supports two formats: compliance (default) and STRIDE threat model. For compliance: loads domain groups, coverage stats, scope/methodology, evidence refs — renders executive summary, compliance matrix, gap analysis, evidence register. For STRIDE: loads components, threats, mitigations, gaps, DFD — renders scope, DFD, threats by STRIDE category, risk matrix, mitigations, gaps register. Format auto-detected from stored state keys, or set report_format explicitly.',
    inputSchema: {
      type: "object" as const,
      properties: {
        assessment_id: {
          type: "string",
          description: "Assessment identifier to export.",
        },
        report_format: {
          type: "string",
          enum: ["compliance", "stride"],
          description:
            'Report format. "stride" for STRIDE threat model, "compliance" for compliance assessment. Auto-detected from stored state if omitted.',
        },
      },
      required: ["assessment_id"],
    },
  },
  {
    name: "wkfl_delete_assessment",
    description:
      "Delete all stored state for an assessment. Use for cleanup after delivery.",
    inputSchema: {
      type: "object" as const,
      properties: {
        assessment_id: {
          type: "string",
          description: "Assessment identifier to delete.",
        },
      },
      required: ["assessment_id"],
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
