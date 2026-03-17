import { describe, it, expect } from "vitest";
import { loadManifest, listAvailableManifests } from "../../src/definitions/manifests/loader.js";

describe("manifest loader", () => {
  it("loads DORA manifest by framework_id", () => {
    const manifest = loadManifest("DORA");
    expect(manifest).not.toBeNull();
    expect(manifest!.framework_id).toBe("DORA");
    expect(manifest!.article_groups.length).toBeGreaterThan(0);
  });

  it("returns null for unknown framework", () => {
    const manifest = loadManifest("UNKNOWN_FRAMEWORK");
    expect(manifest).toBeNull();
  });

  it("is case-sensitive", () => {
    expect(loadManifest("dora")).toBeNull();
    expect(loadManifest("Dora")).toBeNull();
  });

  it("lists available manifests", () => {
    const available = listAvailableManifests();
    expect(available).toContain("DORA");
    expect(available.length).toBeGreaterThan(0);
  });
});
