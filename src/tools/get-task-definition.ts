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
  const knownTasks = ["dfd-construction.json", "compliance-assessment.json", "stride-threat-model.json"];
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
