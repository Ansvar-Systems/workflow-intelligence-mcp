import type { ToolResult } from "./index.js";
import { loadManifest, listAvailableManifests } from "../definitions/manifests/loader.js";
import { getTaskById } from "./get-task-definition.js";

/**
 * Get the list of production-ready manifests from the gap_analysis task definition.
 * Only manifests in framework_manifests.available are served to the orchestrator.
 * The loader sees all manifest files; this function filters to what's released.
 */
function getAvailableManifestIds(): string[] {
  const def = getTaskById("gap_analysis");
  if (!def) return listAvailableManifests();
  const fm = (def as unknown as Record<string, unknown>).framework_manifests as
    | { available?: string[] }
    | undefined;
  return fm?.available ?? listAvailableManifests();
}

export async function getManifest(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const frameworkId = args.framework_id as string | undefined;
  const available = getAvailableManifestIds();

  if (!frameworkId) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ available_manifests: available }),
        },
      ],
    };
  }

  if (!available.includes(frameworkId)) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "manifest_not_available",
            message: `Manifest for '${frameworkId}' is not in the available set. Available: ${available.join(", ")}. Pending manifests exist but are not production-ready.`,
          }),
        },
      ],
      isError: true,
    };
  }

  const manifest = loadManifest(frameworkId);
  if (!manifest) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "manifest_not_found",
            message: `Manifest file for '${frameworkId}' could not be loaded.`,
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
        text: JSON.stringify(manifest, null, 2),
      },
    ],
  };
}
