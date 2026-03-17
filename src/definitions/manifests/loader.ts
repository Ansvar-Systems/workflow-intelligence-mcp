/**
 * Loads article manifests from the definitions/manifests/ directory.
 * Manifests are JSON files named by lowercase framework_id (e.g., dora.json).
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { FrameworkManifest } from "../../validation/rules/manifest-coverage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFESTS_DIR = __dirname;

const cache = new Map<string, FrameworkManifest>();

export function loadManifest(frameworkId: string): FrameworkManifest | null {
  if (cache.has(frameworkId)) {
    return cache.get(frameworkId)!;
  }

  const filename = `${frameworkId.toLowerCase()}.json`;
  const filepath = join(MANIFESTS_DIR, filename);

  try {
    const raw = readFileSync(filepath, "utf8");
    const manifest = JSON.parse(raw) as FrameworkManifest;

    if (manifest.framework_id !== frameworkId) {
      return null;
    }

    cache.set(frameworkId, manifest);
    return manifest;
  } catch {
    return null;
  }
}

export function listAvailableManifests(): string[] {
  try {
    const files = readdirSync(MANIFESTS_DIR);
    const manifests: string[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = readFileSync(join(MANIFESTS_DIR, file), "utf8");
        const parsed = JSON.parse(raw);
        if (parsed.framework_id && parsed.article_groups) {
          manifests.push(parsed.framework_id);
        }
      } catch {
        // Skip invalid files
      }
    }
    return manifests;
  } catch {
    return [];
  }
}
