/**
 * Assessment state storage — JSON files on disk.
 *
 * Layout:
 *   {dataDir}/assessments/{assessmentId}/{key}.json
 *
 * Each file contains:
 *   { data: <arbitrary JSON>, stored_at: <ISO timestamp> }
 *
 * _meta.json is auto-maintained with created_at / last_updated.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface StoredEntry {
  data: unknown;
  stored_at: string;
}

export interface StateListEntry {
  key: string;
  stored_at: string;
  size_bytes: number;
}

export interface AssessmentMeta {
  assessment_id: string;
  created_at: string;
  last_updated: string;
  keys: string[];
}

const DEFAULT_DATA_DIR = process.env.WORKFLOW_STATE_DIR || "data";

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function assessmentDir(dataDir: string, assessmentId: string): string {
  return join(dataDir, "assessments", sanitizeId(assessmentId));
}

function keyPath(dataDir: string, assessmentId: string, key: string): string {
  // Sanitize key — allow alphanumeric, hyphens, underscores, dots
  const safe = key.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(assessmentDir(dataDir, assessmentId), `${safe}.json`);
}

function metaPath(dataDir: string, assessmentId: string): string {
  return join(assessmentDir(dataDir, assessmentId), "_meta.json");
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function updateMeta(dataDir: string, assessmentId: string): void {
  const dir = assessmentDir(dataDir, assessmentId);
  const mp = metaPath(dataDir, assessmentId);
  const now = new Date().toISOString();

  let meta: AssessmentMeta;
  if (existsSync(mp)) {
    meta = JSON.parse(readFileSync(mp, "utf-8"));
    meta.last_updated = now;
  } else {
    meta = {
      assessment_id: assessmentId,
      created_at: now,
      last_updated: now,
      keys: [],
    };
  }

  // Refresh key list from directory
  if (existsSync(dir)) {
    meta.keys = readdirSync(dir)
      .filter((f) => f.endsWith(".json") && f !== "_meta.json")
      .map((f) => f.replace(/\.json$/, ""));
  }

  writeFileSync(mp, JSON.stringify(meta, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function storeState(
  assessmentId: string,
  key: string,
  data: unknown,
  dataDir: string = DEFAULT_DATA_DIR,
): { assessment_id: string; key: string; stored_at: string } {
  const dir = assessmentDir(dataDir, assessmentId);
  ensureDir(dir);

  const now = new Date().toISOString();
  const entry: StoredEntry = { data, stored_at: now };
  writeFileSync(keyPath(dataDir, assessmentId, key), JSON.stringify(entry, null, 2), "utf-8");
  updateMeta(dataDir, assessmentId);

  return { assessment_id: assessmentId, key, stored_at: now };
}

export function loadState(
  assessmentId: string,
  key: string,
  dataDir: string = DEFAULT_DATA_DIR,
): StoredEntry | null {
  const fp = keyPath(dataDir, assessmentId, key);
  if (!existsSync(fp)) {
    return null;
  }
  return JSON.parse(readFileSync(fp, "utf-8"));
}

export function listStates(
  assessmentId: string,
  dataDir: string = DEFAULT_DATA_DIR,
): { assessment_id: string; entries: StateListEntry[]; meta: AssessmentMeta | null } {
  const dir = assessmentDir(dataDir, assessmentId);

  if (!existsSync(dir)) {
    return { assessment_id: assessmentId, entries: [], meta: null };
  }

  const files = readdirSync(dir).filter(
    (f) => f.endsWith(".json") && f !== "_meta.json",
  );

  const entries: StateListEntry[] = files.map((f) => {
    const fp = join(dir, f);
    const stat = statSync(fp);
    const content: StoredEntry = JSON.parse(readFileSync(fp, "utf-8"));
    return {
      key: f.replace(/\.json$/, ""),
      stored_at: content.stored_at,
      size_bytes: stat.size,
    };
  });

  const mp = metaPath(dataDir, assessmentId);
  const meta: AssessmentMeta | null = existsSync(mp)
    ? JSON.parse(readFileSync(mp, "utf-8"))
    : null;

  return { assessment_id: assessmentId, entries, meta };
}

export function deleteAssessment(
  assessmentId: string,
  dataDir: string = DEFAULT_DATA_DIR,
): { assessment_id: string; deleted: boolean } {
  const dir = assessmentDir(dataDir, assessmentId);

  if (!existsSync(dir)) {
    return { assessment_id: assessmentId, deleted: false };
  }

  rmSync(dir, { recursive: true, force: true });
  return { assessment_id: assessmentId, deleted: true };
}
