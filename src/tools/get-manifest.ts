import type { ToolResult } from "./index.js";
import { loadManifest, listAvailableManifests } from "../definitions/manifests/loader.js";

export async function getManifest(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const frameworkId = args.framework_id as string | undefined;

  if (!frameworkId) {
    const available = listAvailableManifests();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ available_manifests: available }),
        },
      ],
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
            message: `No manifest for framework '${frameworkId}'. Available: ${listAvailableManifests().join(", ")}`,
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
