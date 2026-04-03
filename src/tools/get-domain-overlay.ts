/**
 * wkfl_get_domain_overlay — fetch and merge domain overlays for workflow adaptation.
 *
 * Called by orchestrator agents during Phase 1 when domain context is detected.
 * Returns structured guidance that the LLM reads to calibrate subsequent phases:
 * additional asset categories, MCP tools to consult, impact/feasibility calibration,
 * compliance frameworks, and report addenda.
 *
 * Multiple domains can be requested — overlays are merged additively.
 */

import type { ToolResult } from "./index.js";
import {
  loadOverlay,
  mergeOverlays,
  listAvailableOverlays,
} from "../definitions/overlays/loader.js";

export async function wkflGetDomainOverlay(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const domainsRaw = args.domains;

  // No domains → list available overlays
  if (!domainsRaw) {
    const available = listAvailableOverlays();
    if (available.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { available_overlays: [], message: "No domain overlays installed." },
              null,
              2,
            ),
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ available_overlays: available }, null, 2),
        },
      ],
    };
  }

  // Parse domain list — accept string or array
  let domainIds: string[];
  if (Array.isArray(domainsRaw)) {
    domainIds = domainsRaw.map(String);
  } else if (typeof domainsRaw === "string") {
    domainIds = domainsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { error: "domains must be a string or array of strings" },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  if (domainIds.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { error: "No domain IDs provided", available: listAvailableOverlays() },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  // Load each overlay
  const loaded = [];
  const notFound = [];
  for (const id of domainIds) {
    const overlay = loadOverlay(id);
    if (overlay) {
      loaded.push(overlay);
    } else {
      notFound.push(id);
    }
  }

  if (loaded.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: `No overlays found for: ${notFound.join(", ")}`,
              available: listAvailableOverlays(),
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }

  // Merge and return
  const merged = mergeOverlays(loaded);

  const result: Record<string, unknown> = { ...merged };
  if (notFound.length > 0) {
    result.warnings = [`Overlays not found: ${notFound.join(", ")}`];
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
