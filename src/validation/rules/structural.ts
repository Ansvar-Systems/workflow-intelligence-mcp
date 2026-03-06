/**
 * Structural DFD validation rules.
 *
 * Checks graph-level properties of a DFD: connectivity, orphan
 * detection, direct external-to-datastore flows, and trust
 * boundary crossing for external entities.
 */

import type { DfdStageState } from "../../types/dfd.js";
import type { RuleFailure } from "../../types/validation.js";

/**
 * Every process must participate in at least one data flow
 * (as either source or destination).
 */
export function checkEveryProcessHasFlow(
  state: DfdStageState,
): RuleFailure[] {
  const connectedIds = new Set<string>();

  for (const flow of state.data_flows) {
    connectedIds.add(flow.source_id);
    connectedIds.add(flow.destination_id);
  }

  const failures: RuleFailure[] = [];

  for (const process of state.processes) {
    if (!connectedIds.has(process.id)) {
      failures.push({
        rule: "every_process_has_flow",
        severity: "required",
        details: `Process '${process.id}' (${process.name}) has no connected data flows`,
        field: "processes",
      });
    }
  }

  return failures;
}

/**
 * Every data store must be connected to at least one process
 * via a data flow.
 */
export function checkNoOrphanDataStores(
  state: DfdStageState,
): RuleFailure[] {
  // Build a set of data_store IDs that appear in flows where the
  // other end is a process.
  const processIds = new Set(state.processes.map((p) => p.id));
  const connectedStoreIds = new Set<string>();

  for (const flow of state.data_flows) {
    const sourceIsProcess = processIds.has(flow.source_id);
    const destIsProcess = processIds.has(flow.destination_id);

    // If one end is a process, the other end (if a data store) is connected
    if (sourceIsProcess) connectedStoreIds.add(flow.destination_id);
    if (destIsProcess) connectedStoreIds.add(flow.source_id);
  }

  const failures: RuleFailure[] = [];

  for (const store of state.data_stores) {
    if (!connectedStoreIds.has(store.id)) {
      failures.push({
        rule: "no_orphan_data_stores",
        severity: "required",
        details: `Data store '${store.id}' (${store.name}) is not connected to any process`,
        field: "data_stores",
      });
    }
  }

  return failures;
}

/**
 * Warn if an external entity connects directly to a data store
 * (bypassing a process). In standard DFD practice, data stores
 * should only be accessed through processes.
 */
export function checkNoDirectExternalToDatastore(
  state: DfdStageState,
): RuleFailure[] {
  const externalIds = new Set(state.external_entities.map((e) => e.id));
  const storeIds = new Set(state.data_stores.map((ds) => ds.id));
  const failures: RuleFailure[] = [];

  for (const flow of state.data_flows) {
    const sourceIsExternal = externalIds.has(flow.source_id);
    const destIsStore = storeIds.has(flow.destination_id);
    const sourceIsStore = storeIds.has(flow.source_id);
    const destIsExternal = externalIds.has(flow.destination_id);

    if (
      (sourceIsExternal && destIsStore) ||
      (sourceIsStore && destIsExternal)
    ) {
      failures.push({
        rule: "no_direct_external_to_datastore",
        severity: "warning",
        details: `Data flow '${flow.id}' connects external entity directly to data store (source: '${flow.source_id}', destination: '${flow.destination_id}') without an intermediary process`,
        field: "data_flows",
      });
    }
  }

  return failures;
}

/**
 * Warn if an external entity does not cross a trust boundary
 * relative to the processes it connects to.
 *
 * An external entity "crosses a boundary" if it is NOT enclosed
 * in the same trust boundary as the processes it connects to.
 * If an external entity shares a boundary with all processes it
 * communicates with, that is a modelling concern.
 */
export function checkEveryExternalEntityCrossesBoundary(
  state: DfdStageState,
): RuleFailure[] {
  // Build a map: element ID -> set of boundary IDs that enclose it
  const elementBoundaries = new Map<string, Set<string>>();

  for (const boundary of state.trust_boundaries) {
    for (const enclosedId of boundary.enclosed_ids) {
      let boundaries = elementBoundaries.get(enclosedId);
      if (!boundaries) {
        boundaries = new Set<string>();
        elementBoundaries.set(enclosedId, boundaries);
      }
      boundaries.add(boundary.id);
    }
  }

  // Find all process IDs each external entity connects to
  const processIds = new Set(state.processes.map((p) => p.id));
  const externalToProcesses = new Map<string, Set<string>>();

  for (const ext of state.external_entities) {
    externalToProcesses.set(ext.id, new Set<string>());
  }

  for (const flow of state.data_flows) {
    if (
      externalToProcesses.has(flow.source_id) &&
      processIds.has(flow.destination_id)
    ) {
      externalToProcesses.get(flow.source_id)!.add(flow.destination_id);
    }
    if (
      externalToProcesses.has(flow.destination_id) &&
      processIds.has(flow.source_id)
    ) {
      externalToProcesses.get(flow.destination_id)!.add(flow.source_id);
    }
  }

  const failures: RuleFailure[] = [];

  for (const ext of state.external_entities) {
    const connectedProcessIds = externalToProcesses.get(ext.id)!;

    // If the external entity has no connected processes, skip
    // (other rules catch disconnected elements)
    if (connectedProcessIds.size === 0) continue;

    const extBoundaries = elementBoundaries.get(ext.id) ?? new Set<string>();

    // Check if the external entity shares ALL boundaries with EVERY
    // connected process. If so, it does not cross a boundary.
    let crossesSomeBoundary = false;

    for (const procId of connectedProcessIds) {
      const procBoundaries =
        elementBoundaries.get(procId) ?? new Set<string>();

      // The entity crosses a boundary relative to this process if
      // their boundary sets differ (entity is in a different zone).
      const sameBoundaries =
        extBoundaries.size === procBoundaries.size &&
        [...extBoundaries].every((b) => procBoundaries.has(b));

      if (!sameBoundaries) {
        crossesSomeBoundary = true;
        break;
      }
    }

    if (!crossesSomeBoundary) {
      failures.push({
        rule: "every_external_entity_crosses_boundary",
        severity: "warning",
        details: `External entity '${ext.id}' (${ext.name}) is in the same trust boundary as all connected processes and does not cross a boundary`,
        field: "external_entities",
      });
    }
  }

  return failures;
}
