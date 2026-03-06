import { describe, it, expect } from "vitest";
import { evaluateFieldPresence } from "../../src/validation/rules/field-presence.js";
import type { FieldRule } from "../../src/types/task.js";
import dfdEmpty from "../fixtures/dfd-empty.json";
import dfdValid from "../fixtures/dfd-valid-minimal.json";

const RULES: FieldRule[] = [
  { field: "processes", rule: "min_count", value: 1, message: "At least one process is required" },
  { field: "data_stores", rule: "min_count", value: 1, message: "At least one data store is required" },
  { field: "external_entities", rule: "min_count", value: 1, message: "At least one external entity is required" },
  { field: "trust_boundaries", rule: "min_count", value: 1, message: "At least one trust boundary is required" },
  { field: "data_flows", rule: "min_count", value: 1, message: "At least one data flow is required" },
];

describe("field-presence", () => {
  it("passes when all fields meet min_count", () => {
    const failures = evaluateFieldPresence(dfdValid, RULES);
    expect(failures).toHaveLength(0);
  });

  it("fails all 5 checks for empty state", () => {
    const failures = evaluateFieldPresence(dfdEmpty, RULES);
    expect(failures).toHaveLength(5);
    for (const f of failures) {
      expect(f.severity).toBe("required");
    }
  });

  it("fails only for missing fields", () => {
    const partial = {
      processes: [{ id: "proc-001", name: "A" }],
      data_stores: [],
      external_entities: [{ id: "ext-001", name: "B" }],
      data_flows: [],
      trust_boundaries: [],
    };
    const failures = evaluateFieldPresence(partial, RULES);
    expect(failures).toHaveLength(3);
    const fields = failures.map((f) => f.field);
    expect(fields).toContain("data_stores");
    expect(fields).toContain("data_flows");
    expect(fields).toContain("trust_boundaries");
  });

  it("passes soft_warnings when above threshold", () => {
    const softRules: FieldRule[] = [
      { field: "data_flows", rule: "min_count", value: 3, message: "Most systems have more than 2 data flows" },
    ];
    const state = {
      data_flows: [
        { id: "df-001", source_id: "a", destination_id: "b" },
        { id: "df-002", source_id: "a", destination_id: "c" },
        { id: "df-003", source_id: "b", destination_id: "c" },
        { id: "df-004", source_id: "c", destination_id: "a" },
      ],
    };
    const failures = evaluateFieldPresence(state, softRules);
    expect(failures).toHaveLength(0);
  });

  it("fails soft_warnings when below threshold", () => {
    const softRules: FieldRule[] = [
      { field: "data_flows", rule: "min_count", value: 3, message: "Most systems have more than 2 data flows" },
    ];
    const state = { data_flows: [{ id: "df-001", source_id: "a", destination_id: "b" }] };
    const failures = evaluateFieldPresence(state, softRules);
    expect(failures).toHaveLength(1);
    expect(failures[0].details).toContain("more than 2");
  });
});
