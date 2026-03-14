/** State storage tool handlers for assessment persistence and resume. */

import type { ToolResult } from "./index.js";
import { storeState, loadState, listStates, deleteAssessment } from "../state/store.js";

export async function wkflStoreState(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const assessmentId = args.assessment_id as string;
  const key = args.key as string;
  // Accept data, value, or state as the payload field — LLMs vary in naming.
  // If none provided, store an empty object (phase initialization pattern).
  const data = args.data ?? args.value ?? args.state ?? {};

  if (!assessmentId || !key) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "missing_parameter",
            message: "assessment_id and key are required.",
          }),
        },
      ],
      isError: true,
    };
  }

  const result = storeState(assessmentId, key, data);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export async function wkflLoadState(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const assessmentId = args.assessment_id as string;
  const key = args.key as string;

  if (!assessmentId || !key) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "missing_parameter",
            message: "assessment_id and key are required.",
          }),
        },
      ],
      isError: true,
    };
  }

  const entry = loadState(assessmentId, key);
  if (!entry) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "not_found",
            message: `No state found for assessment '${assessmentId}', key '${key}'.`,
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
        text: JSON.stringify(entry, null, 2),
      },
    ],
  };
}

export async function wkflListStates(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const assessmentId = args.assessment_id as string;

  if (!assessmentId) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "missing_parameter",
            message: "assessment_id is required.",
          }),
        },
      ],
      isError: true,
    };
  }

  const result = listStates(assessmentId);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export async function wkflDeleteAssessment(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const assessmentId = args.assessment_id as string;

  if (!assessmentId) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "missing_parameter",
            message: "assessment_id is required.",
          }),
        },
      ],
      isError: true,
    };
  }

  const result = deleteAssessment(assessmentId);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
