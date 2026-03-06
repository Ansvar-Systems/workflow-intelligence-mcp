import Ajv from "ajv";
import type { ToolResult } from "./index.js";
import { getTaskById } from "./get-task-definition.js";
import { evaluateCompleteness } from "../validation/engine.js";

const ajv = new Ajv({ allErrors: true });

export async function checkStageCompleteness(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const taskId = args.task_id as string;
  const definitionVersion = args.definition_version as string;
  const stageState = args.stage_state as Record<string, unknown>;

  if (!taskId || !definitionVersion || !stageState) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "missing_parameter",
            message:
              "task_id, definition_version, and stage_state are all required.",
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
            message: `No task with ID '${taskId}'.`,
          }),
        },
      ],
      isError: true,
    };
  }

  // Version negotiation
  const currentMajor = parseInt(def.version.split(".")[0], 10);
  const requestedMajor = parseInt(definitionVersion.split(".")[0], 10);
  let versionNote: string | undefined;
  let versionWarning: string | undefined;

  if (definitionVersion !== def.version) {
    if (requestedMajor === currentMajor) {
      // Minor bump — proceed normally with a note
      versionNote = `Definition updated to ${def.version}. This session uses ${definitionVersion}.`;
    } else if (requestedMajor < currentMajor) {
      // Major bump — warn but continue validation against current rules
      versionWarning = `Definition ${def.version} available. This session uses ${definitionVersion}. New sessions will use ${def.version}.`;
    } else {
      // Requested version is ahead of current — shouldn't happen
      versionWarning = `Requested version ${definitionVersion} is newer than current ${def.version}.`;
    }
  }

  // JSON Schema validation
  // Strip $schema meta-identifier — AJV defaults to draft-07 and cannot
  // resolve the 2020-12 meta-schema URI at runtime.
  const { $schema: _strip, ...schemaBody } = def.stage_state_schema as Record<string, unknown>;
  const validate = ajv.compile(schemaBody);
  const valid = validate(stageState);
  if (!valid) {
    const errors = (validate.errors ?? [])
      .map((e) => `${e.instancePath || "/"}: ${e.message}`)
      .join("; ");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "incomplete",
            missing: [
              {
                rule: "schema_validation",
                severity: "required",
                details: `Stage state does not match schema: ${errors}`,
              },
            ],
            warnings: [],
            summary: `Schema validation failed: ${errors}`,
            ...(versionNote ? { version_note: versionNote } : {}),
            ...(versionWarning ? { version_warning: versionWarning } : {}),
          }),
        },
      ],
    };
  }

  // Run validation engine
  const result = evaluateCompleteness(
    stageState,
    def.completion_criteria,
    def.quality_rubric,
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            ...result,
            ...(versionNote ? { version_note: versionNote } : {}),
            ...(versionWarning ? { version_warning: versionWarning } : {}),
          },
          null,
          2,
        ),
      },
    ],
  };
}
