import Ajv from "ajv";
import type { ToolResult } from "./index.js";
import { getTaskById } from "./get-task-definition.js";
import { evaluateCompleteness, evaluatePhaseCompleteness } from "../validation/engine.js";
import { loadState, listStates } from "../state/store.js";

const ajv = new Ajv({ allErrors: true });

export async function checkStageCompleteness(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const taskId = args.task_id as string;
  const definitionVersion = (args.definition_version as string) || "1.0";
  let stageState = args.stage_state as Record<string, unknown> | undefined;

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

  // If stage_state is not provided, try to reconstruct from stored state.
  // LLMs often call this without stage_state, expecting server-side state.
  if (!stageState) {
    const assessmentId = args.assessment_id as string;
    if (assessmentId) {
      const result = listStates(assessmentId);
      if (result && Array.isArray(result.entries) && result.entries.length > 0) {
        const assembled: Record<string, unknown> = {};
        for (const entry of result.entries) {
          const loaded = loadState(assessmentId, entry.key);
          if (loaded && loaded.data !== undefined) {
            assembled[entry.key] = loaded.data;
          }
        }
        stageState = assembled;
      }
    }

    // If still no state, return an informative incomplete status rather than error
    if (!stageState || Object.keys(stageState).length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "incomplete",
              missing: [
                {
                  rule: "no_state",
                  severity: "required",
                  details: "No stage data provided or found in stored state. Store phase outputs via wkfl_store_state before checking completeness.",
                },
              ],
              warnings: [],
              summary: "No stage data available yet. Complete the phase work first, store results, then check completeness.",
            }),
          },
        ],
      };
    }
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

  // --- Phase-aware schema selection ---
  let schema = def.stage_state_schema;
  const phaseId = args.phase_id as string | undefined;
  if (phaseId && def.phases) {
    const phase = def.phases.find((p) => p.id === phaseId);
    if (phase?.stage_state_schema) {
      schema = phase.stage_state_schema;
    }
  } else if (!phaseId && def.phases?.length && !def.completion_criteria?.rules?.length) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "incomplete",
            missing: [
              {
                rule: "phase_id_required",
                severity: "required",
                details: `Task '${def.id}' uses per-phase validation. Provide phase_id parameter.`,
              },
            ],
            warnings: [],
            summary: `Task '${def.id}' requires phase_id for stage completeness checks.`,
          }),
        },
      ],
    };
  }

  // JSON Schema validation
  const validate = ajv.compile(schema);
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

  // Run validation engine — phase-aware if phase_id provided and task has phases
  const result = phaseId && def.phases
    ? evaluatePhaseCompleteness(
        stageState,
        def.phases,
        phaseId,
        def.completion_criteria,
        def.quality_rubric,
      )
    : evaluateCompleteness(
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
