import { describe, it, expect } from "vitest";
import { suggestTrustBoundaries } from "../../src/tools/suggest-trust-boundaries.js";

describe("suggest_trust_boundaries", () => {
  it("suggests network boundary for system with external entities", async () => {
    const result = await suggestTrustBoundaries({
      processes: [
        { id: "proc-001", name: "API Gateway" },
        { id: "proc-002", name: "Auth Service" },
      ],
      data_stores: [{ id: "ds-001", name: "User DB" }],
      external_entities: [
        { id: "ext-001", name: "Web Browser", trust_level: "untrusted" },
      ],
      data_flows: [
        { id: "df-001", source_id: "ext-001", destination_id: "proc-001" },
        { id: "df-002", source_id: "proc-001", destination_id: "proc-002" },
        { id: "df-003", source_id: "proc-002", destination_id: "ds-001" },
      ],
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.suggestions.length).toBeGreaterThanOrEqual(1);
    const networkBoundary = data.suggestions.find(
      (s: { name: string }) =>
        s.name.toLowerCase().includes("network") ||
        s.name.toLowerCase().includes("boundary"),
    );
    expect(networkBoundary).toBeDefined();
    expect(networkBoundary.confidence).toBe("high");
  });

  it("suggests data tier boundary for classified data stores", async () => {
    const result = await suggestTrustBoundaries({
      processes: [{ id: "proc-001", name: "API" }],
      data_stores: [
        { id: "ds-001", name: "User DB", data_classification: "confidential" },
        { id: "ds-002", name: "Audit Log", data_classification: "restricted" },
      ],
      external_entities: [{ id: "ext-001", name: "Client" }],
      data_flows: [
        { id: "df-001", source_id: "ext-001", destination_id: "proc-001" },
        { id: "df-002", source_id: "proc-001", destination_id: "ds-001" },
      ],
    });
    const data = JSON.parse(result.content[0].text);
    const dataTier = data.suggestions.find(
      (s: { name: string }) =>
        s.name.toLowerCase().includes("data") ||
        s.name.toLowerCase().includes("tier"),
    );
    expect(dataTier).toBeDefined();
  });

  it("excludes elements already in existing boundaries", async () => {
    const result = await suggestTrustBoundaries({
      processes: [
        { id: "proc-001", name: "API" },
        { id: "proc-002", name: "Worker" },
      ],
      data_stores: [{ id: "ds-001", name: "DB", data_classification: "confidential" }],
      external_entities: [{ id: "ext-001", name: "Client" }],
      data_flows: [
        { id: "df-001", source_id: "ext-001", destination_id: "proc-001" },
        { id: "df-002", source_id: "proc-001", destination_id: "ds-001" },
      ],
      existing_boundaries: [
        { id: "tb-001", name: "Existing", enclosed_ids: ["proc-001", "proc-002", "ds-001"] },
      ],
    });
    const data = JSON.parse(result.content[0].text);
    // Most elements are already enclosed, so fewer/no suggestions
    for (const suggestion of data.suggestions) {
      for (const id of suggestion.enclosed_ids) {
        expect(["proc-001", "proc-002", "ds-001"]).not.toContain(id);
      }
    }
  });

  it("returns no suggestions when no external entities", async () => {
    const result = await suggestTrustBoundaries({
      processes: [{ id: "proc-001", name: "Service" }],
      data_stores: [{ id: "ds-001", name: "DB" }],
      external_entities: [],
      data_flows: [
        { id: "df-001", source_id: "proc-001", destination_id: "ds-001" },
      ],
    });
    const data = JSON.parse(result.content[0].text);
    // No external entities = no network boundary suggestion
    const networkBoundary = data.suggestions.find(
      (s: { name: string }) => s.name.toLowerCase().includes("network"),
    );
    expect(networkBoundary).toBeUndefined();
  });

  it("includes _meta with disclaimer", async () => {
    const result = await suggestTrustBoundaries({
      processes: [{ id: "proc-001", name: "A" }],
      data_stores: [],
      external_entities: [{ id: "ext-001", name: "B" }],
      data_flows: [
        { id: "df-001", source_id: "ext-001", destination_id: "proc-001" },
      ],
    });
    const data = JSON.parse(result.content[0].text);
    expect(data._meta).toBeDefined();
    expect(data._meta.disclaimer).toBeDefined();
  });
});
