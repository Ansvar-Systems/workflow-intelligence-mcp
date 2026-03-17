import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  storeState,
  loadState,
  listStates,
  deleteAssessment,
} from "../../src/state/store.js";

describe("state storage", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "wkfl-state-test-"));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  describe("storeState", () => {
    it("creates assessment directory and stores data", () => {
      const result = storeState("assess-001", "phase_1", { org: "Acme" }, dataDir);
      expect(result.assessment_id).toBe("assess-001");
      expect(result.key).toBe("phase_1");
      expect(result.stored_at).toBeTruthy();
    });

    it("overwrites existing key", () => {
      storeState("assess-001", "phase_1", { v: 1 }, dataDir);
      storeState("assess-001", "phase_1", { v: 2 }, dataDir);
      const entry = loadState("assess-001", "phase_1", dataDir);
      expect(entry).not.toBeNull();
      expect((entry!.data as { v: number }).v).toBe(2);
    });

    it("sanitizes key names", () => {
      const result = storeState("assess-001", "group/access control", { x: 1 }, dataDir);
      expect(result.key).toBe("group/access control");
      // File should exist with sanitized name
      const entry = loadState("assess-001", "group/access control", dataDir);
      expect(entry).not.toBeNull();
    });
  });

  describe("loadState", () => {
    it("returns stored data with timestamp", () => {
      storeState("assess-001", "phase_2", { requirements: [1, 2, 3] }, dataDir);
      const entry = loadState("assess-001", "phase_2", dataDir);
      expect(entry).not.toBeNull();
      expect(entry!.data).toEqual({ requirements: [1, 2, 3] });
      expect(entry!.stored_at).toBeTruthy();
    });

    it("returns null for nonexistent key", () => {
      const entry = loadState("assess-001", "missing", dataDir);
      expect(entry).toBeNull();
    });

    it("returns null for nonexistent assessment", () => {
      const entry = loadState("nonexistent", "phase_1", dataDir);
      expect(entry).toBeNull();
    });
  });

  describe("listStates", () => {
    it("returns empty for nonexistent assessment", () => {
      const result = listStates("nonexistent", dataDir);
      expect(result.entries).toEqual([]);
      expect(result.meta).toBeNull();
    });

    it("lists all stored keys with metadata", () => {
      storeState("assess-001", "phase_1", { a: 1 }, dataDir);
      storeState("assess-001", "phase_2", { b: 2 }, dataDir);
      storeState("assess-001", "group_crypto", { c: 3 }, dataDir);

      const result = listStates("assess-001", dataDir);
      expect(result.entries).toHaveLength(3);

      const keys = result.entries.map((e) => e.key).sort();
      expect(keys).toEqual(["group_crypto", "phase_1", "phase_2"]);

      for (const entry of result.entries) {
        expect(entry.stored_at).toBeTruthy();
        expect(entry.size_bytes).toBeGreaterThan(0);
      }
    });

    it("returns meta with assessment info", () => {
      storeState("assess-001", "phase_1", {}, dataDir);
      const result = listStates("assess-001", dataDir);

      expect(result.meta).not.toBeNull();
      expect(result.meta!.assessment_id).toBe("assess-001");
      expect(result.meta!.created_at).toBeTruthy();
      expect(result.meta!.last_updated).toBeTruthy();
      expect(result.meta!.keys).toContain("phase_1");
    });
  });

  describe("deleteAssessment", () => {
    it("deletes all state for an assessment", () => {
      storeState("assess-001", "phase_1", { a: 1 }, dataDir);
      storeState("assess-001", "phase_2", { b: 2 }, dataDir);

      const result = deleteAssessment("assess-001", dataDir);
      expect(result.deleted).toBe(true);

      const after = listStates("assess-001", dataDir);
      expect(after.entries).toEqual([]);
    });

    it("returns deleted=false for nonexistent assessment", () => {
      const result = deleteAssessment("nonexistent", dataDir);
      expect(result.deleted).toBe(false);
    });
  });

  describe("session resume scenario", () => {
    it("can resume from partially completed assessment", () => {
      // Simulate: 3 domain groups completed, then session dies
      storeState("assess-resume", "phase_1_scoping", { org: "Acme", frameworks: ["iso27001"] }, dataDir);
      storeState("assess-resume", "phase_2_requirements", { total: 93, groups: 6 }, dataDir);
      storeState("assess-resume", "group_access_control", { rows: 15, status: "complete" }, dataDir);
      storeState("assess-resume", "group_cryptography", { rows: 12, status: "complete" }, dataDir);
      storeState("assess-resume", "group_network", { rows: 18, status: "complete" }, dataDir);

      // New session: agent lists states to find resume point
      const states = listStates("assess-resume", dataDir);
      const completedGroups = states.entries
        .filter((e) => e.key.startsWith("group_"))
        .map((e) => e.key);

      expect(completedGroups).toHaveLength(3);
      expect(completedGroups).toContain("group_access_control");
      expect(completedGroups).toContain("group_cryptography");
      expect(completedGroups).toContain("group_network");

      // Agent loads requirements to find remaining groups
      const reqs = loadState("assess-resume", "phase_2_requirements", dataDir);
      expect(reqs).not.toBeNull();
      expect((reqs!.data as { total: number }).total).toBe(93);
    });
  });
});
