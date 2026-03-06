import { describe, it, expect } from "vitest";
import {
  checkEveryProcessHasFlow,
  checkNoOrphanDataStores,
  checkNoDirectExternalToDatastore,
  checkEveryExternalEntityCrossesBoundary,
} from "../../src/validation/rules/structural.js";
import type { DfdStageState } from "../../src/types/dfd.js";
import dfdValid from "../fixtures/dfd-valid-minimal.json";
import dfdComplex from "../fixtures/dfd-valid-complex.json";
import dfdOrphanProcess from "../fixtures/dfd-orphan-process.json";
import dfdOrphanDatastore from "../fixtures/dfd-orphan-datastore.json";
import dfdExternalDirect from "../fixtures/dfd-external-direct.json";
import dfdNoBoundaryCross from "../fixtures/dfd-no-boundary-cross.json";

describe("structural rules", () => {
  describe("checkEveryProcessHasFlow", () => {
    it("passes when all processes have flows", () => {
      const failures = checkEveryProcessHasFlow(dfdValid as DfdStageState);
      expect(failures).toHaveLength(0);
    });

    it("passes for complex DFD", () => {
      const failures = checkEveryProcessHasFlow(dfdComplex as DfdStageState);
      expect(failures).toHaveLength(0);
    });

    it("fails for orphan process", () => {
      const failures = checkEveryProcessHasFlow(dfdOrphanProcess as DfdStageState);
      expect(failures).toHaveLength(1);
      expect(failures[0].severity).toBe("required");
      expect(failures[0].details).toContain("Logging Service");
    });

    it("passes when process has only incoming flows", () => {
      const state: DfdStageState = {
        processes: [{ id: "proc-001", name: "Receiver" }],
        data_stores: [{ id: "ds-001", name: "DB" }],
        external_entities: [{ id: "ext-001", name: "Client" }],
        data_flows: [
          { id: "df-001", source_id: "ext-001", destination_id: "proc-001" },
        ],
        trust_boundaries: [{ id: "tb-001", name: "B", enclosed_ids: ["proc-001", "ds-001"] }],
      };
      const failures = checkEveryProcessHasFlow(state);
      expect(failures).toHaveLength(0);
    });
  });

  describe("checkNoOrphanDataStores", () => {
    it("passes when all data stores are connected", () => {
      const failures = checkNoOrphanDataStores(dfdValid as DfdStageState);
      expect(failures).toHaveLength(0);
    });

    it("fails for orphan data store", () => {
      const failures = checkNoOrphanDataStores(dfdOrphanDatastore as DfdStageState);
      expect(failures).toHaveLength(1);
      expect(failures[0].severity).toBe("required");
    });
  });

  describe("checkNoDirectExternalToDatastore", () => {
    it("passes when no direct external-to-datastore flows", () => {
      const failures = checkNoDirectExternalToDatastore(dfdValid as DfdStageState);
      expect(failures).toHaveLength(0);
    });

    it("warns when external entity connects directly to data store", () => {
      const failures = checkNoDirectExternalToDatastore(dfdExternalDirect as DfdStageState);
      expect(failures).toHaveLength(1);
      expect(failures[0].severity).toBe("warning");
    });
  });

  describe("checkEveryExternalEntityCrossesBoundary", () => {
    it("passes when external entities are outside boundaries", () => {
      const failures = checkEveryExternalEntityCrossesBoundary(dfdValid as DfdStageState);
      expect(failures).toHaveLength(0);
    });

    it("warns when external entity is inside same boundary as internal components", () => {
      const failures = checkEveryExternalEntityCrossesBoundary(dfdNoBoundaryCross as DfdStageState);
      expect(failures.length).toBeGreaterThanOrEqual(1);
      expect(failures[0].severity).toBe("warning");
    });
  });
});
