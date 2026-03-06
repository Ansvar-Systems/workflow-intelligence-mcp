import type { ToolResult } from "./index.js";
import { getLoadedTasks } from "./get-task-definition.js";

export async function listTasks(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const category = args.category as string | undefined;
  let tasks = getLoadedTasks();

  if (category) {
    tasks = tasks.filter((t) => t.category === category);
  }

  const summaries = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    standalone: t.standalone,
    used_in_workflows: t.used_in_workflows,
    description: t.description,
    estimated_duration: t.estimated_duration,
    version: t.version,
  }));

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            tasks: summaries,
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
