/**
 * request_review — Pause the workflow for user review.
 *
 * Called by the orchestrator agent after completing a phase that requires
 * customer approval. The executor detects this tool call and terminates the
 * turn (same pattern as offer_workflow). The portal shows a review card.
 *
 * This tool is intentionally simple — it echoes the input back as structured
 * data. All pause/resume logic lives in the executor, not here.
 */

import type { ToolResult } from "./index.js";

export async function requestReview(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const phaseId = String(args.phase_id || "");
  const phaseName = String(args.phase_name || "");
  const summary = String(args.summary || "");
  const assessmentId = args.assessment_id
    ? String(args.assessment_id)
    : undefined;

  if (!phaseId || !phaseName) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "phase_id and phase_name are required",
            isError: true,
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
        text: JSON.stringify({
          _review_gate: true,
          phase_id: phaseId,
          phase_name: phaseName,
          summary,
          assessment_id: assessmentId,
          status: "pending_review",
        }),
      },
    ],
  };
}
