import { describe, it, expect } from "vitest";
import {
  checkFlowReferencesValid,
  checkBoundaryReferencesValid,
} from "../../src/validation/rules/referential-integrity.js";
import type { DfdStageState } from "../../src/types/dfd.js";
import dfdValid from "../fixtures/dfd-valid-minimal.json";
import dfdInvalidRef from "../fixtures/dfd-invalid-ref.json";
import dfdBoundaryInvalid from "../fixtures/dfd-boundary-invalid.json";
import dfdComplex from "../fixtures/dfd-valid-complex.json";

describe("referential-integrity", () => {
  describe("checkFlowReferencesValid", () => {
    it("passes when all references are valid", () => {
      const failures = checkFlowReferencesValid(dfdValid as DfdStageState);
      expect(failures).toHaveLength(0);
    });

    it("passes for complex DFD with many cross-type references", () => {
      const failures = checkFlowReferencesValid(dfdComplex as DfdStageState);
      expect(failures).toHaveLength(0);
    });

    it("fails when a flow references non-existent element", () => {
      const failures = checkFlowReferencesValid(dfdInvalidRef as DfdStageState);
      expect(failures.length).toBeGreaterThanOrEqual(1);
      const invalidRefFailure = failures.find((f) =>
        f.details.includes("ext-999"),
      );
      expect(invalidRefFailure).toBeDefined();
      expect(invalidRefFailure!.severity).toBe("required");
    });

    it("reports each invalid reference separately", () => {
      const state: DfdStageState = {
        processes: [{ id: "proc-001", name: "A" }],
        data_stores: [],
        external_entities: [],
        data_flows: [
          { id: "df-001", source_id: "ghost-001", destination_id: "ghost-002" },
        ],
        trust_boundaries: [],
      };
      const failures = checkFlowReferencesValid(state);
      expect(failures).toHaveLength(2);
    });
  });

  describe("checkBoundaryReferencesValid", () => {
    it("passes when all enclosed IDs are valid", () => {
      const failures = checkBoundaryReferencesValid(dfdValid as DfdStageState);
      expect(failures).toHaveLength(0);
    });

    it("fails when boundary encloses non-existent element", () => {
      const failures = checkBoundaryReferencesValid(
        dfdBoundaryInvalid as DfdStageState,
      );
      expect(failures.length).toBeGreaterThanOrEqual(1);
      const invalidFailure = failures.find((f) =>
        f.details.includes("proc-999"),
      );
      expect(invalidFailure).toBeDefined();
      expect(invalidFailure!.severity).toBe("required");
    });
  });
});
