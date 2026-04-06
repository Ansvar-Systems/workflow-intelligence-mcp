/**
 * Loads and merges domain overlays from the definitions/overlays/ directory.
 *
 * Each overlay is a JSON file named by lowercase domain ID (e.g., medical-devices.json).
 * Multiple overlays can be merged for systems spanning domains — asset categories,
 * threat sources, compliance frameworks, and report addenda are unioned; calibration
 * guidance is concatenated.
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OVERLAYS_DIR = __dirname;

// ── Types ───────────────────────────────────────────────────────────────────────

export interface OverlayAssetCategory {
  id: string;
  description: string;
}

export interface OverlayThreatSource {
  mcp: string;
  tools: string[];
  guidance: string;
}

export interface OverlayComplianceFramework {
  id: string;
  name: string;
  key_requirements: string[];
}

export interface OverlayReportAddendum {
  id: string;
  title: string;
  guidance: string;
}

export interface DomainOverlay {
  id: string;
  name: string;
  version: string;
  applies_to: string[];
  detection_signals: string[];
  asset_categories: OverlayAssetCategory[];
  threat_sources: OverlayThreatSource[];
  impact_calibration: Record<string, string>;
  feasibility_calibration: string;
  compliance_frameworks: OverlayComplianceFramework[];
  report_addenda: OverlayReportAddendum[];
}

// ── Cache ───────────────────────────────────────────────────────────────────────

const cache = new Map<string, DomainOverlay>();

// ── Loader ──────────────────────────────────────────────────────────────────────

export function loadOverlay(domainId: string): DomainOverlay | null {
  if (cache.has(domainId)) {
    return cache.get(domainId)!;
  }

  const filename = `${domainId.toLowerCase()}.json`;
  const filepath = join(OVERLAYS_DIR, filename);

  try {
    const raw = readFileSync(filepath, "utf8");
    const overlay = JSON.parse(raw) as DomainOverlay;

    if (overlay.id !== domainId) {
      return null;
    }

    cache.set(domainId, overlay);
    return overlay;
  } catch {
    return null;
  }
}

export function listAvailableOverlays(): Array<{ id: string; name: string; applies_to: string[] }> {
  try {
    const files = readdirSync(OVERLAYS_DIR);
    const result: Array<{ id: string; name: string; applies_to: string[] }> = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = readFileSync(join(OVERLAYS_DIR, file), "utf8");
        const parsed = JSON.parse(raw);
        if (parsed.id && parsed.name && parsed.applies_to) {
          result.push({ id: parsed.id, name: parsed.name, applies_to: parsed.applies_to });
        }
      } catch {
        // Skip invalid files
      }
    }
    return result;
  } catch {
    return [];
  }
}

// ── Merger ──────────────────────────────────────────────────────────────────────

/**
 * Merge multiple overlays into a single composite overlay.
 *
 * - asset_categories, threat_sources, compliance_frameworks, report_addenda: union by id
 * - impact_calibration: concatenate per dimension with domain label
 * - feasibility_calibration: concatenate with domain label
 * - detection_signals: union
 * - applies_to: intersection (only tasks supported by ALL overlays)
 */
export function mergeOverlays(overlays: DomainOverlay[]): DomainOverlay {
  if (overlays.length === 0) {
    throw new Error("Cannot merge zero overlays");
  }
  if (overlays.length === 1) {
    return overlays[0];
  }

  const seenAssets = new Set<string>();
  const seenThreats = new Set<string>();
  const seenFrameworks = new Set<string>();
  const seenAddenda = new Set<string>();

  const merged: DomainOverlay = {
    id: overlays.map((o) => o.id).join("+"),
    name: overlays.map((o) => o.name).join(" + "),
    version: "merged",
    applies_to: overlays[0].applies_to.filter((t) =>
      overlays.every((o) => o.applies_to.includes(t)),
    ),
    detection_signals: [],
    asset_categories: [],
    threat_sources: [],
    impact_calibration: {},
    feasibility_calibration: "",
    compliance_frameworks: [],
    report_addenda: [],
  };

  for (const overlay of overlays) {
    // Detection signals — union
    for (const sig of overlay.detection_signals) {
      if (!merged.detection_signals.includes(sig)) {
        merged.detection_signals.push(sig);
      }
    }

    // Asset categories — union by id
    for (const cat of overlay.asset_categories) {
      if (!seenAssets.has(cat.id)) {
        seenAssets.add(cat.id);
        merged.asset_categories.push(cat);
      }
    }

    // Threat sources — union by mcp name, concatenate guidance if same MCP
    for (const src of overlay.threat_sources) {
      if (seenThreats.has(src.mcp)) {
        const existing = merged.threat_sources.find((s) => s.mcp === src.mcp);
        if (existing) {
          existing.guidance += `\n[${overlay.name}] ${src.guidance}`;
          for (const tool of src.tools) {
            if (!existing.tools.includes(tool)) {
              existing.tools.push(tool);
            }
          }
        }
      } else {
        seenThreats.add(src.mcp);
        merged.threat_sources.push({ ...src });
      }
    }

    // Impact calibration — concatenate per dimension with domain label
    for (const [dim, guidance] of Object.entries(overlay.impact_calibration)) {
      const label = `[${overlay.name}] ${guidance}`;
      merged.impact_calibration[dim] = merged.impact_calibration[dim]
        ? `${merged.impact_calibration[dim]}\n${label}`
        : label;
    }

    // Feasibility calibration — concatenate
    if (overlay.feasibility_calibration) {
      const label = `[${overlay.name}] ${overlay.feasibility_calibration}`;
      merged.feasibility_calibration = merged.feasibility_calibration
        ? `${merged.feasibility_calibration}\n${label}`
        : label;
    }

    // Compliance frameworks — union by id
    for (const fw of overlay.compliance_frameworks) {
      if (!seenFrameworks.has(fw.id)) {
        seenFrameworks.add(fw.id);
        merged.compliance_frameworks.push(fw);
      }
    }

    // Report addenda — union by id
    for (const addendum of overlay.report_addenda) {
      if (!seenAddenda.has(addendum.id)) {
        seenAddenda.add(addendum.id);
        merged.report_addenda.push(addendum);
      }
    }
  }

  return merged;
}
