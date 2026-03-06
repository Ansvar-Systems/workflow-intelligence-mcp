import type { ToolResult } from "./index.js";
import type {
  DfdProcess,
  DfdDataStore,
  DfdExternalEntity,
  DfdDataFlow,
  DfdTrustBoundary,
} from "../types/dfd.js";

interface BoundarySuggestion {
  name: string;
  reasoning: string;
  enclosed_ids: string[];
  external_ids: string[];
  confidence: "high" | "medium" | "low";
}

export async function suggestTrustBoundaries(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const processes = (args.processes ?? []) as DfdProcess[];
  const dataStores = (args.data_stores ?? []) as DfdDataStore[];
  const externalEntities = (args.external_entities ?? []) as DfdExternalEntity[];
  const dataFlows = (args.data_flows ?? []) as DfdDataFlow[];
  const existingBoundaries = (args.existing_boundaries ?? []) as DfdTrustBoundary[];

  // Collect all element IDs already enclosed in existing boundaries
  const alreadyEnclosed = new Set<string>();
  for (const b of existingBoundaries) {
    for (const id of b.enclosed_ids) {
      alreadyEnclosed.add(id);
    }
  }

  const allInternalIds = new Set([
    ...processes.map((p) => p.id),
    ...dataStores.map((d) => d.id),
  ]);
  const externalIds = new Set(externalEntities.map((e) => e.id));

  // Build adjacency: which elements connect to external entities?
  const externalFacing = new Set<string>();
  for (const flow of dataFlows) {
    if (externalIds.has(flow.source_id) && allInternalIds.has(flow.destination_id)) {
      externalFacing.add(flow.destination_id);
    }
    if (externalIds.has(flow.destination_id) && allInternalIds.has(flow.source_id)) {
      externalFacing.add(flow.source_id);
    }
  }

  const suggestions: BoundarySuggestion[] = [];

  // Heuristic 1: Internet/network boundary — separate external entities from internal components
  if (externalEntities.length > 0 && allInternalIds.size > 0) {
    const internalNotEnclosed = [...allInternalIds].filter(
      (id) => !alreadyEnclosed.has(id),
    );
    const externalsNotEnclosed = [...externalIds].filter(
      (id) => !alreadyEnclosed.has(id),
    );

    if (internalNotEnclosed.length > 0 || externalsNotEnclosed.length > 0) {
      suggestions.push({
        name: "Network Boundary",
        reasoning:
          `External entities (${externalEntities.map((e) => e.name).join(", ")}) ` +
          "communicate with internal components across a network boundary. " +
          "Standard practice separates external-facing from internal components.",
        enclosed_ids: internalNotEnclosed,
        external_ids: externalsNotEnclosed,
        confidence: "high",
      });
    }
  }

  // Heuristic 2: Data tier boundary — isolate data stores from application processes
  const restrictedStores = dataStores.filter(
    (d) =>
      (d.data_classification === "confidential" ||
        d.data_classification === "restricted") &&
      !alreadyEnclosed.has(d.id),
  );

  if (restrictedStores.length > 0) {
    const storeIds = restrictedStores.map((d) => d.id);
    // Only suggest if not all already grouped together
    const processIds = processes
      .filter((p) => !alreadyEnclosed.has(p.id))
      .map((p) => p.id);
    if (processIds.length > 0) {
      suggestions.push({
        name: "Data Tier Boundary",
        reasoning:
          `Data stores (${restrictedStores.map((d) => d.name).join(", ")}) ` +
          `contain ${restrictedStores.map((d) => d.data_classification).join("/")} data ` +
          "and should be isolated from application-tier processes.",
        enclosed_ids: storeIds,
        external_ids: [],
        confidence: "medium",
      });
    }
  }

  // Heuristic 3: DMZ boundary — if there are external-facing processes, separate them
  if (externalFacing.size > 0 && externalFacing.size < allInternalIds.size) {
    const dmzProcesses = [...externalFacing].filter(
      (id) => !alreadyEnclosed.has(id),
    );
    const backendProcesses = [...allInternalIds].filter(
      (id) => !externalFacing.has(id) && !alreadyEnclosed.has(id),
    );

    if (dmzProcesses.length > 0 && backendProcesses.length > 0) {
      suggestions.push({
        name: "DMZ Boundary",
        reasoning:
          "External-facing processes should be separated from backend services. " +
          `Processes directly handling external traffic: ${dmzProcesses.join(", ")}. ` +
          `Backend processes: ${backendProcesses.join(", ")}.`,
        enclosed_ids: dmzProcesses,
        external_ids: [],
        confidence: "medium",
      });
    }
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            suggestions,
            _meta: {
              server: "workflow-intelligence-mcp",
              disclaimer:
                "Suggestions are based on common architectural patterns. Review and adjust based on your actual deployment architecture.",
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}
