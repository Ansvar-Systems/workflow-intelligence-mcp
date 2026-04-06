import { describe, it, expect, beforeEach } from "vitest";
import {
  loadOverlay,
  listAvailableOverlays,
  mergeOverlays,
  type DomainOverlay,
} from "../../src/definitions/overlays/loader.js";

// ── Required fields every overlay must have ─────────────────────────────────

const REQUIRED_FIELDS: (keyof DomainOverlay)[] = [
  "id",
  "name",
  "version",
  "applies_to",
  "detection_signals",
  "asset_categories",
  "threat_sources",
  "impact_calibration",
  "feasibility_calibration",
  "compliance_frameworks",
  "report_addenda",
];

const KNOWN_IDS = ["automotive", "medical-devices", "robotics"] as const;

// ── loadOverlay ─────────────────────────────────────────────────────────────

describe("loadOverlay", () => {
  it("loads the automotive overlay by ID", () => {
    const overlay = loadOverlay("automotive");
    expect(overlay).not.toBeNull();
    expect(overlay!.id).toBe("automotive");
    expect(overlay!.name).toBe("Automotive Cybersecurity");
    expect(overlay!.version).toBe("1.0");
  });

  it("loads the medical-devices overlay by ID", () => {
    const overlay = loadOverlay("medical-devices");
    expect(overlay).not.toBeNull();
    expect(overlay!.id).toBe("medical-devices");
    expect(overlay!.name).toBe("Medical Devices");
    expect(overlay!.version).toBe("1.0");
  });

  it("loads the robotics overlay by ID", () => {
    const overlay = loadOverlay("robotics");
    expect(overlay).not.toBeNull();
    expect(overlay!.id).toBe("robotics");
    expect(overlay!.name).toBe("Robotics & Industrial Automation");
    expect(overlay!.version).toBe("1.0");
  });

  it("returns null for an unknown domain ID", () => {
    expect(loadOverlay("nonexistent-domain")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(loadOverlay("")).toBeNull();
  });
});

// ── listAvailableOverlays ───────────────────────────────────────────────────

describe("listAvailableOverlays", () => {
  it("returns all 3 overlays", () => {
    const list = listAvailableOverlays();
    expect(list.length).toBe(3);
  });

  it("contains correct metadata for each overlay", () => {
    const list = listAvailableOverlays();
    const byId = new Map(list.map((o) => [o.id, o]));

    expect(byId.get("automotive")).toEqual({
      id: "automotive",
      name: "Automotive Cybersecurity",
      applies_to: ["ai_tara", "stride_threat_model"],
    });

    expect(byId.get("medical-devices")).toEqual({
      id: "medical-devices",
      name: "Medical Devices",
      applies_to: ["ai_tara", "stride_threat_model"],
    });

    expect(byId.get("robotics")).toEqual({
      id: "robotics",
      name: "Robotics & Industrial Automation",
      applies_to: ["ai_tara", "stride_threat_model"],
    });
  });

  it("each entry has only id, name, applies_to fields", () => {
    const list = listAvailableOverlays();
    for (const entry of list) {
      expect(Object.keys(entry).sort()).toEqual(["applies_to", "id", "name"]);
    }
  });
});

// ── Overlay structural completeness ─────────────────────────────────────────

describe("overlay structural completeness", () => {
  for (const id of KNOWN_IDS) {
    describe(id, () => {
      let overlay: DomainOverlay;

      beforeEach(() => {
        overlay = loadOverlay(id)!;
      });

      it("loads successfully", () => {
        expect(overlay).not.toBeNull();
      });

      for (const field of REQUIRED_FIELDS) {
        it(`has required field: ${field}`, () => {
          expect(overlay).toHaveProperty(field);
          const value = overlay[field];
          // Arrays should not be empty, strings should be non-empty
          if (Array.isArray(value)) {
            expect(value.length).toBeGreaterThan(0);
          } else if (typeof value === "string") {
            expect(value.length).toBeGreaterThan(0);
          } else if (typeof value === "object" && value !== null) {
            expect(Object.keys(value).length).toBeGreaterThan(0);
          }
        });
      }

      it("includes ai_tara in applies_to", () => {
        expect(overlay.applies_to).toContain("ai_tara");
      });
    });
  }
});

// ── mergeOverlays ───────────────────────────────────────────────────────────

describe("mergeOverlays", () => {
  it("throws on empty array", () => {
    expect(() => mergeOverlays([])).toThrow("Cannot merge zero overlays");
  });

  it("returns single overlay as-is", () => {
    const automotive = loadOverlay("automotive")!;
    const result = mergeOverlays([automotive]);
    expect(result).toBe(automotive); // same reference
  });

  describe("two-overlay merge (automotive + medical-devices)", () => {
    let automotive: DomainOverlay;
    let medical: DomainOverlay;
    let merged: DomainOverlay;

    beforeEach(() => {
      automotive = loadOverlay("automotive")!;
      medical = loadOverlay("medical-devices")!;
      merged = mergeOverlays([automotive, medical]);
    });

    it("creates composite id from joined IDs", () => {
      expect(merged.id).toBe("automotive+medical-devices");
    });

    it("creates composite name from joined names", () => {
      expect(merged.name).toBe("Automotive Cybersecurity + Medical Devices");
    });

    it("sets version to 'merged'", () => {
      expect(merged.version).toBe("merged");
    });

    // applies_to: intersection
    it("applies_to is the intersection of both overlays", () => {
      const expected = automotive.applies_to.filter((t) =>
        medical.applies_to.includes(t),
      );
      expect(merged.applies_to).toEqual(expected);
      // Both include ai_tara and stride_threat_model
      expect(merged.applies_to).toContain("ai_tara");
      expect(merged.applies_to).toContain("stride_threat_model");
    });

    // detection_signals: union
    it("unions detection_signals without duplicates", () => {
      const allSignals = new Set([
        ...automotive.detection_signals,
        ...medical.detection_signals,
      ]);
      expect(merged.detection_signals.length).toBe(allSignals.size);
      for (const sig of allSignals) {
        expect(merged.detection_signals).toContain(sig);
      }
    });

    // asset_categories: union by id
    it("unions asset_categories by id", () => {
      const allIds = new Set([
        ...automotive.asset_categories.map((c) => c.id),
        ...medical.asset_categories.map((c) => c.id),
      ]);
      expect(merged.asset_categories.length).toBe(allIds.size);
      for (const id of allIds) {
        expect(merged.asset_categories.find((c) => c.id === id)).toBeTruthy();
      }
    });

    // compliance_frameworks: union by id
    it("unions compliance_frameworks by id", () => {
      const allIds = new Set([
        ...automotive.compliance_frameworks.map((f) => f.id),
        ...medical.compliance_frameworks.map((f) => f.id),
      ]);
      expect(merged.compliance_frameworks.length).toBe(allIds.size);
      for (const id of allIds) {
        expect(
          merged.compliance_frameworks.find((f) => f.id === id),
        ).toBeTruthy();
      }
    });

    // report_addenda: union by id
    it("unions report_addenda by id", () => {
      const allIds = new Set([
        ...automotive.report_addenda.map((a) => a.id),
        ...medical.report_addenda.map((a) => a.id),
      ]);
      expect(merged.report_addenda.length).toBe(allIds.size);
      for (const id of allIds) {
        expect(merged.report_addenda.find((a) => a.id === id)).toBeTruthy();
      }
    });

    // impact_calibration: concatenate per dimension with domain label
    it("concatenates impact_calibration per dimension with domain labels", () => {
      // Both overlays have "safety", "financial", "regulatory"
      for (const dim of ["safety", "financial", "regulatory"]) {
        expect(merged.impact_calibration[dim]).toBeDefined();
        expect(merged.impact_calibration[dim]).toContain(
          `[${automotive.name}]`,
        );
        expect(merged.impact_calibration[dim]).toContain(`[${medical.name}]`);
      }
    });

    it("includes dimensions unique to one overlay", () => {
      // medical-devices has "privacy" and "ethical" that automotive does not
      expect(merged.impact_calibration["privacy"]).toBeDefined();
      expect(merged.impact_calibration["privacy"]).toContain(
        `[${medical.name}]`,
      );
      expect(merged.impact_calibration["ethical"]).toBeDefined();
      expect(merged.impact_calibration["ethical"]).toContain(
        `[${medical.name}]`,
      );
    });

    // feasibility_calibration: concatenate
    it("concatenates feasibility_calibration with domain labels", () => {
      expect(merged.feasibility_calibration).toContain(
        `[${automotive.name}]`,
      );
      expect(merged.feasibility_calibration).toContain(`[${medical.name}]`);
    });

    // threat_sources: union by mcp, same-MCP concatenates guidance
    it("unions threat_sources by mcp name", () => {
      // Both use eu-regulations-mcp, only automotive has automotive-cybersecurity-mcp
      const mcpNames = merged.threat_sources.map((s) => s.mcp);
      expect(mcpNames).toContain("automotive-cybersecurity-mcp");
      expect(mcpNames).toContain("eu-regulations-mcp");
    });

    it("concatenates guidance for same-MCP threat source", () => {
      // eu-regulations-mcp appears in both overlays
      const euSource = merged.threat_sources.find(
        (s) => s.mcp === "eu-regulations-mcp",
      )!;
      expect(euSource).toBeTruthy();
      // Should contain the medical-devices label appended
      expect(euSource.guidance).toContain(`[${medical.name}]`);
    });

    it("unions tools for same-MCP threat source", () => {
      const euSource = merged.threat_sources.find(
        (s) => s.mcp === "eu-regulations-mcp",
      )!;
      // Both overlays reference search_regulations and get_article
      expect(euSource.tools).toContain("search_regulations");
      expect(euSource.tools).toContain("get_article");
      // No duplicates
      const unique = new Set(euSource.tools);
      expect(euSource.tools.length).toBe(unique.size);
    });
  });

  describe("three-overlay merge (all domains)", () => {
    let all: DomainOverlay[];
    let merged: DomainOverlay;

    beforeEach(() => {
      all = KNOWN_IDS.map((id) => loadOverlay(id)!);
      merged = mergeOverlays(all);
    });

    it("creates composite id from all three", () => {
      expect(merged.id).toBe("automotive+medical-devices+robotics");
    });

    it("applies_to intersection includes ai_tara", () => {
      expect(merged.applies_to).toContain("ai_tara");
    });

    it("has all asset_categories from all three overlays", () => {
      const allIds = new Set(
        all.flatMap((o) => o.asset_categories.map((c) => c.id)),
      );
      expect(merged.asset_categories.length).toBe(allIds.size);
    });

    it("has all compliance_frameworks from all three overlays", () => {
      const allIds = new Set(
        all.flatMap((o) => o.compliance_frameworks.map((f) => f.id)),
      );
      expect(merged.compliance_frameworks.length).toBe(allIds.size);
    });

    it("has all report_addenda from all three overlays", () => {
      const allIds = new Set(
        all.flatMap((o) => o.report_addenda.map((a) => a.id)),
      );
      expect(merged.report_addenda.length).toBe(allIds.size);
    });

    it("eu-regulations-mcp guidance includes labels from all overlays that use it", () => {
      const euSource = merged.threat_sources.find(
        (s) => s.mcp === "eu-regulations-mcp",
      )!;
      expect(euSource).toBeTruthy();
      // automotive is the first overlay so its guidance is the base (no label prefix)
      // medical-devices and robotics get labels appended
      expect(euSource.guidance).toContain("[Medical Devices]");
      expect(euSource.guidance).toContain(
        "[Robotics & Industrial Automation]",
      );
    });

    it("includes all unique threat source MCPs", () => {
      const allMcps = new Set(
        all.flatMap((o) => o.threat_sources.map((s) => s.mcp)),
      );
      expect(merged.threat_sources.length).toBe(allMcps.size);
      for (const mcp of allMcps) {
        expect(merged.threat_sources.find((s) => s.mcp === mcp)).toBeTruthy();
      }
    });
  });
});
