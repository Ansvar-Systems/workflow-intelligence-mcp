/**
 * Referential integrity validation for DFD models.
 *
 * Ensures that data flow source/destination IDs and trust boundary
 * enclosed IDs all reference existing elements.
 */

import type { DfdStageState } from "../../types/dfd.js";
import type { RuleFailure } from "../../types/validation.js";

/**
 * Collect all valid element IDs from a DFD stage state.
 */
function collectElementIds(state: DfdStageState): Set<string> {
  const ids = new Set<string>();
  for (const p of state.processes) ids.add(p.id);
  for (const ds of state.data_stores) ids.add(ds.id);
  for (const ext of state.external_entities) ids.add(ext.id);
  return ids;
}

/**
 * Check that every data_flow.source_id and destination_id references
 * an existing process, data_store, or external_entity.
 */
export function checkFlowReferencesValid(state: DfdStageState): RuleFailure[] {
  const validIds = collectElementIds(state);
  const failures: RuleFailure[] = [];

  for (const flow of state.data_flows) {
    if (!validIds.has(flow.source_id)) {
      failures.push({
        rule: "flow_references_valid",
        severity: "required",
        details: `Data flow '${flow.id}' has source_id '${flow.source_id}' which does not reference any existing element`,
        field: "data_flows",
      });
    }

    if (!validIds.has(flow.destination_id)) {
      failures.push({
        rule: "flow_references_valid",
        severity: "required",
        details: `Data flow '${flow.id}' has destination_id '${flow.destination_id}' which does not reference any existing element`,
        field: "data_flows",
      });
    }
  }

  return failures;
}

/**
 * Check that every trust_boundary.enclosed_ids entry references
 * an existing element (process, data_store, or external_entity).
 */
export function checkBoundaryReferencesValid(
  state: DfdStageState,
): RuleFailure[] {
  const validIds = collectElementIds(state);
  const failures: RuleFailure[] = [];

  for (const boundary of state.trust_boundaries) {
    for (const enclosedId of boundary.enclosed_ids) {
      if (!validIds.has(enclosedId)) {
        failures.push({
          rule: "boundary_references_valid",
          severity: "required",
          details: `Trust boundary '${boundary.id}' encloses '${enclosedId}' which does not reference any existing element`,
          field: "trust_boundaries",
        });
      }
    }
  }

  return failures;
}
