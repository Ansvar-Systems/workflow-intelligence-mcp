import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { wkflExportReport } from "../../src/tools/export-report.js";
import { storeState, deleteAssessment } from "../../src/state/store.js";
import { mkdirSync, rmSync } from "node:fs";

const DATA_DIR = "data";
const ASSESSMENT_ID = "export-test-001";

function store(key: string, data: unknown) {
  storeState(ASSESSMENT_ID, key, data, DATA_DIR);
}

beforeEach(() => {
  mkdirSync(DATA_DIR, { recursive: true });
});

afterEach(() => {
  deleteAssessment(ASSESSMENT_ID, DATA_DIR);
});

describe("wkfl_export_report", () => {
  it("returns error when assessment has no state", async () => {
    const result = await wkflExportReport({ assessment_id: "nonexistent" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("no_state");
  });

  it("returns error when assessment_id is missing", async () => {
    const result = await wkflExportReport({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("missing_parameter");
  });

  it("assembles a report from stored state", async () => {
    // Store Phase 1 data
    store("org_profile", { name: "Acme Corp", sector: "Technology" });
    store("documents", [
      { filename: "isms-policy.pdf", doc_id: "doc-1" },
    ]);
    store("applicable_frameworks", ["ISO 27001:2022"]);

    // Store a domain group (Phase 3 output)
    store("group_access_control", [
      {
        req_id: "A.5.1",
        framework: "ISO 27001:2022",
        requirement_text: "Information security policy",
        verdict: "compliant",
        confidence: "high",
        evidence_refs: [
          { doc_id: "doc-1", section_ref: "Section 3.1", page_start: 5, page_end: 7, filename: "isms-policy.pdf" },
        ],
        verbatim_quote: "The organization shall establish an information security policy...",
        evidence_summary: "ISMS policy document explicitly defines the information security policy.",
      },
      {
        req_id: "A.5.2",
        framework: "ISO 27001:2022",
        requirement_text: "Review of policies",
        verdict: "partial",
        confidence: "medium",
        evidence_refs: [
          { doc_id: "doc-1", section_ref: "Section 3.2", page_start: 8 },
        ],
        evidence_summary: "Policy mentions annual review but no schedule defined.",
        gap_description: "No defined review schedule or review records.",
      },
      {
        req_id: "A.5.3",
        framework: "ISO 27001:2022",
        requirement_text: "Segregation of duties",
        verdict: "not_found",
        confidence: "high",
        evidence_summary: "",
      },
    ]);

    // Store Phase 4 data
    store("coverage_stats", {
      total_requirements: 3,
      compliant: 1,
      partial: 1,
      not_found: 1,
      contradicted: 0,
      not_applicable: 0,
      requires_human_review: 0,
      coverage_percentage: 33.3,
    });
    store("scope_and_methodology", {
      assessment_date: "2026-03-07",
      frameworks_assessed: [
        { name: "ISO 27001:2022", version: "2022", source_mcp: "security-controls" },
      ],
      documents_analyzed: [
        { filename: "isms-policy.pdf", doc_id: "doc-1", sections_count: 15, quality_signal: "high" },
      ],
      methodology: "Automated compliance assessment using document evidence analysis.",
      limitations: ["Only indexed documents were analyzed.", "No interviews conducted."],
      client_attestations: [
        { question: "Do you develop software in-house?", response: "No", impact: "A.8.25-A.8.33 marked not_applicable" },
      ],
    });

    const result = await wkflExportReport({ assessment_id: ASSESSMENT_ID });
    expect(result.isError).toBeUndefined();

    const report = result.content[0].text;

    // Title and metadata
    expect(report).toContain("# Compliance Assessment Report");
    expect(report).toContain("Acme Corp");
    expect(report).toContain("ISO 27001:2022");

    // Executive Summary
    expect(report).toContain("## 1. Executive Summary");
    expect(report).toContain("33.3%");

    // Scope
    expect(report).toContain("## 2. Scope & Methodology");
    expect(report).toContain("isms-policy.pdf");
    expect(report).toContain("No interviews conducted");

    // Compliance Matrix
    expect(report).toContain("## 3. Compliance Matrix");
    expect(report).toContain("A.5.1");
    expect(report).toContain("**compliant**");
    expect(report).toContain("**partial**");
    expect(report).toContain("**not_found**");

    // Gap Analysis
    expect(report).toContain("## 4. Gap Analysis");
    expect(report).toContain("Not Found (1)");
    expect(report).toContain("Partial Compliance (1)");
    expect(report).toContain("No defined review schedule");

    // Evidence Register
    expect(report).toContain("## 5. Evidence Register");
    expect(report).toContain("Section 3.1");
    expect(report).toContain("5–7");

    // Client Attestations
    expect(report).toContain("## 6. Client Attestations");
    expect(report).toContain("Do you develop software in-house?");
  });

  it("handles pre-assembled compliance_matrix key", async () => {
    store("org_profile", { name: "Beta Inc" });
    store("compliance_matrix", [
      { req_id: "R-1", verdict: "compliant", framework: "SOC 2" },
    ]);
    store("coverage_stats", { total_requirements: 1, compliant: 1, coverage_percentage: 100 });

    const result = await wkflExportReport({ assessment_id: ASSESSMENT_ID });
    const report = result.content[0].text;

    expect(report).toContain("Beta Inc");
    expect(report).toContain("R-1");
    expect(report).toContain("**compliant**");
  });

  it("handles domain groups with nested matrix property", async () => {
    store("org_profile", { name: "Gamma LLC" });
    store("group_network", {
      group_id: "network",
      matrix: [
        { req_id: "N-1", verdict: "not_found", framework: "NIST CSF" },
      ],
    });
    store("coverage_stats", { total_requirements: 1, not_found: 1 });

    const result = await wkflExportReport({ assessment_id: ASSESSMENT_ID });
    const report = result.content[0].text;

    expect(report).toContain("N-1");
    expect(report).toContain("Not Found (1)");
  });
});
