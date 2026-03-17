import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TaskDefinition } from "../types/task.js";
import type { ToolResult } from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFINITIONS_DIR = join(__dirname, "..", "definitions", "tasks");

/** In-memory cache of loaded task definitions. */
const taskCache = new Map<string, TaskDefinition>();

/** Load all task definitions from the definitions directory. */
function ensureLoaded(): void {
  if (taskCache.size > 0) return;

  // In production, scan the directory. For Phase 1, we have one known task.
  const knownTasks = ["dfd-construction.json", "compliance-assessment.json", "stride-threat-model.json", "dpia-assessment.json", "vendor-risk-triage.json"];
  for (const file of knownTasks) {
    try {
      const raw = readFileSync(join(DEFINITIONS_DIR, file), "utf-8");
      const def = JSON.parse(raw) as TaskDefinition;
      taskCache.set(def.id, def);
    } catch {
      // Skip missing files — will be caught at tool call time.
    }
  }
}

/** Get all loaded task definitions (for list_tasks and about). */
export function getLoadedTasks(): TaskDefinition[] {
  ensureLoaded();
  return Array.from(taskCache.values());
}

/** Get a single task definition by ID. */
export function getTaskById(taskId: string): TaskDefinition | undefined {
  ensureLoaded();
  return taskCache.get(taskId);
}

export async function getTaskDefinition(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const taskId = args.task_id as string;
  if (!taskId) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "missing_parameter",
            message: "task_id is required.",
          }),
        },
      ],
      isError: true,
    };
  }

  const def = getTaskById(taskId);
  if (!def) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "task_not_found",
            message: `No task with ID '${taskId}'. Use list_tasks to see available tasks.`,
          }),
        },
      ],
      isError: true,
    };
  }

  const phaseId = args.phase as string | undefined;

  // Phase-scoped mode: return only the requested phase + shared essentials.
  // This keeps the response under the context budget cap (~18K vs 72K full).
  if (phaseId && def.phases) {
    const phase = def.phases.find((p) => p.id === phaseId);
    if (!phase) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "phase_not_found",
              message: `No phase '${phaseId}' in task '${taskId}'. Available phases: ${def.phases.map((p) => p.id).join(", ")}`,
            }),
          },
        ],
        isError: true,
      };
    }

    // Filter mcp_tools to those relevant to this phase
    const phaseTools = def.mcp_tools.filter(
      (t) => t.when === "all_phases" || t.when.includes(phaseId),
    );

    // Strip completion_criteria and quality_rubric from the phase object.
    // These are only needed by check_stage_completeness, not during execution.
    const { completion_criteria: _cc, quality_rubric: _qr, ...phaseExecView } = phase;

    const scoped = {
      id: def.id,
      name: def.name,
      version: def.version,
      description: def.description,
      prompting_guidance: def.prompting_guidance,
      mcp_tools: phaseTools,
      current_phase: phaseExecView,
      total_phases: def.phases.length,
      phase_sequence: def.phases.map((p) => ({ id: p.id, name: p.name })),
      // Include domain vocabulary and hints if present (used by Phase 2b)
      ...(("domain_vocabulary" in def) ? { domain_vocabulary: (def as Record<string, unknown>).domain_vocabulary } : {}),
      ...(("domain_expert_hints" in def) ? { domain_expert_hints: (def as Record<string, unknown>).domain_expert_hints } : {}),
      // Fields omitted to reduce context size (~15-20K savings).
      // The orchestrator does not need these during phase execution —
      // check_stage_completeness loads them directly from the task definition.
      stage_state_schema_note:
        "Omitted from phase-scoped response. Available via get_task_definition(task_id) without phase parameter.",
      completion_criteria_note:
        "Omitted. Phase completion is validated via check_stage_completeness.",
      quality_rubric_note:
        "Omitted. Quality checks run via check_stage_completeness.",
      _meta: {
        server: "workflow-intelligence-mcp",
        version: "1.0.0",
        mode: "phase_scoped",
        disclaimer:
          "Phase-scoped view. Call with phase omitted for full definition including stage_state_schema, completion_criteria, and quality_rubric.",
      },
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(scoped, null, 2),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            ...def,
            _meta: {
              server: "workflow-intelligence-mcp",
              version: "1.0.0",
              disclaimer:
                "Workflow definitions support structured assessments. Results depend on the accuracy and completeness of input data.",
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}
