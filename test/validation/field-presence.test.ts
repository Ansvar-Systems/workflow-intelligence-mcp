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

  describe("exists rule", () => {
    it("passes when field is present", () => {
      const rules: FieldRule[] = [
        { field: "org_profile", rule: "exists", message: "org_profile is required" },
      ];
      const failures = evaluateFieldPresence({ org_profile: { name: "Acme" } }, rules);
      expect(failures).toHaveLength(0);
    });

    it("passes when field is falsy but not null/undefined", () => {
      const rules: FieldRule[] = [
        { field: "count", rule: "exists", message: "count is required" },
      ];
      expect(evaluateFieldPresence({ count: 0 }, rules)).toHaveLength(0);
      expect(evaluateFieldPresence({ count: "" }, rules)).toHaveLength(0);
      expect(evaluateFieldPresence({ count: false }, rules)).toHaveLength(0);
    });

    it("fails when field is undefined", () => {
      const rules: FieldRule[] = [
        { field: "org_profile", rule: "exists", message: "org_profile is required" },
      ];
      const failures = evaluateFieldPresence({}, rules);
      expect(failures).toHaveLength(1);
      expect(failures[0].details).toBe("org_profile is required");
    });

    it("fails when field is null", () => {
      const rules: FieldRule[] = [
        { field: "org_profile", rule: "exists", message: "org_profile is required" },
      ];
      const failures = evaluateFieldPresence({ org_profile: null }, rules);
      expect(failures).toHaveLength(1);
    });
  });

  describe("equals rule", () => {
    it("passes when field equals expected value", () => {
      const rules: FieldRule[] = [
        { field: "report_ready", rule: "equals", value: true, message: "report must be ready" },
      ];
      const failures = evaluateFieldPresence({ report_ready: true }, rules);
      expect(failures).toHaveLength(0);
    });

    it("fails when field has different value", () => {
      const rules: FieldRule[] = [
        { field: "report_ready", rule: "equals", value: true, message: "report must be ready" },
      ];
      const failures = evaluateFieldPresence({ report_ready: false }, rules);
      expect(failures).toHaveLength(1);
      expect(failures[0].details).toBe("report must be ready");
    });

    it("fails when field is missing", () => {
      const rules: FieldRule[] = [
        { field: "status", rule: "equals", value: "complete", message: "status must be complete" },
      ];
      const failures = evaluateFieldPresence({}, rules);
      expect(failures).toHaveLength(1);
    });

    it("uses strict equality", () => {
      const rules: FieldRule[] = [
        { field: "count", rule: "equals", value: 5, message: "count must be 5" },
      ];
      expect(evaluateFieldPresence({ count: 5 }, rules)).toHaveLength(0);
      expect(evaluateFieldPresence({ count: "5" }, rules)).toHaveLength(1);
    });
  });
});
