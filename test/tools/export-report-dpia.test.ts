import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { storeState, deleteAssessment } from "../../src/state/store.js";
import { wkflExportReport } from "../../src/tools/export-report.js";
import { buildDpiaReport, type DpiaReportInput } from "../../src/tools/export-report-dpia.js";

const ASSESSMENT_ID = "test-dpia-export";

function minimalDpiaInput(): DpiaReportInput {
  return {
    assessmentId: ASSESSMENT_ID,
    orgProfile: { name: "Test Corp", sector: "Healthcare", jurisdiction: "NL" },
    screening: { outcome: "required", rationale: "Art. 35(3)(a) triggered" },
    dpoConsultation: { designated: true, advice_sought: true, advice_summary: "Proceed with caution", recommendation: "Complete full DPIA", followed: true },
    processingDescription: {
      data_types: [{ category: "health", sensitivity_flag: "special_category_art9", source: "direct_collection", art9_type: "health" }],
      data_subjects: [{ type: "patients", vulnerable: true, volume_estimate: "10000" }],
      purposes: ["medical treatment"],
      legal_basis: { article_6_basis: { basis: "legal_obligation", article: "Art. 6(1)(c)", verified: true } },
      high_risk_indicators: [{ id: 4, name: "Sensitive data", present: true, rationale: "Health data" }],
      hri_count: 3,
      recommended_scope: "comprehensive",
    },
    necessityAssessment: {
      assessment_narrative: "Processing is necessary for medical treatment obligations",
      proportionality_assessment: "Only data required for treatment is collected",
    },
    risks: [
      { id: "R1", description: "Unauthorised access to health data", category: "material_damage", affected_rights: [{ right: "Right to privacy", article: "Art. 7 CFR" }], harm_description: "Discrimination in insurance. Identity fraud." },
      { id: "R2", description: "Loss of data subject control", category: "loss_of_control", affected_rights: [{ right: "Right of access", article: "Art. 15" }], harm_description: "Inability to exercise data rights." },
    ],
    riskAnalysis: [
      { id: "R1", likelihood: "Likely", likelihood_score: 4, severity: "Severe", severity_score: 4, score: 16 },
      { id: "R2", likelihood: "Possible", likelihood_score: 3, severity: "Limited", severity_score: 2, score: 6 },
    ],
    riskMatrixSummary: { critical: 0, high: 1, medium: 1, low: 0 },
    dataSubjectViews: { sought: true, method: "consultation", summary: "Patients supportive" },
    safeguards: [
      { risk_id: "R1", measure: "AES-256 encryption at rest", type: "technical", gdpr_article: "Art. 32(1)(a)", score_before: 16, score_after: 8, justification: "Encryption limits severity" },
      { risk_id: "R2", measure: "Self-service access portal", type: "technical", gdpr_article: "Art. 15", score_before: 6, score_after: 3, justification: "Direct access restores control" },
    ],
    consultationAssessment: {
      consultation_required: false,
      consultation_basis: "All residual risks are Medium or below after safeguards. Art 36(1) threshold not met. No Member State triggers apply.",
      member_state_triggers_checked: true,
      residual_high_risks: [],
    },
    jurisdictionFindings: [],
    scopeAndMethodology: { assessment_date: "2026-03-16", frameworks_assessed: ["GDPR"], documents_analyzed: ["privacy-policy.pdf"], methodology: "Structured DPIA per EDPB guidance" },
    assumptions: [],
    clientQuestions: [],
    qualityWarnings: [],
  };
}

describe("DPIA report builder", () => {
  it("produces markdown with all 12 sections", () => {
    const report = buildDpiaReport(minimalDpiaInput());

    expect(report).toContain("# Data Protection Impact Assessment");
    expect(report).toContain("## 1. Executive Summary");
    expect(report).toContain("## 2. Art. 35(7) Compliance Mapping");
    expect(report).toContain("## 3. Processing Description");
    expect(report).toContain("## 4. DPO Consultation Record");
    expect(report).toContain("## 5. Necessity & Proportionality");
    expect(report).toContain("## 6. Data Subject Views");
    expect(report).toContain("## 7. Risk Register");
    expect(report).toContain("## 8. Safeguards & Risk Reduction");
    expect(report).toContain("## 9. DPA Consultation Assessment");
    expect(report).toContain("## 11. Gaps, Assumptions & Limitations");
    expect(report).toContain("## 12. Recommendations");
  });

  it("includes jurisdiction section when findings exist", () => {
    const input = minimalDpiaInput();
    input.jurisdictionFindings = [
      {
        jurisdiction_id: "NL",
        expert_agent: "netherlands-law",
        phase_id: "phase_3_risks",
        additional_requirements: [{ requirement: "DPIA publication obligation", legal_reference: "UAVG Art. 35a", impact: "Must publish summary" }],
        source_kind: "mcp_grounded",
      },
    ];
    const report = buildDpiaReport(input);
    expect(report).toContain("## 10. Jurisdiction-Specific Requirements");
    expect(report).toContain("UAVG Art. 35a");
  });

  it("sorts risks by score descending in register", () => {
    const report = buildDpiaReport(minimalDpiaInput());
    const r1Pos = report.indexOf("R1");
    const r2Pos = report.indexOf("R2");
    // R1 (score 16) should appear before R2 (score 6)
    expect(r1Pos).toBeLessThan(r2Pos);
  });

  it("includes LIA three-part test when present", () => {
    const input = minimalDpiaInput();
    input.necessityAssessment.lia_assessment = {
      purpose_test: "Interest is legitimate",
      necessity_test: "Processing is necessary",
      balancing_test: "Rights do not override",
      outcome: "controller_prevails",
    };
    const report = buildDpiaReport(input);
    expect(report).toContain("Legitimate Interests Assessment");
    expect(report).toContain("controller_prevails");
  });

  it("handles empty state gracefully", () => {
    const input: DpiaReportInput = {
      assessmentId: "empty",
      orgProfile: {},
      screening: {},
      dpoConsultation: {},
      processingDescription: {},
      necessityAssessment: {},
      risks: [],
      riskAnalysis: [],
      riskMatrixSummary: {},
      dataSubjectViews: {},
      safeguards: [],
      consultationAssessment: {},
      jurisdictionFindings: [],
      scopeAndMethodology: {},
      assumptions: [],
      clientQuestions: [],
      qualityWarnings: [],
    };
    // Should not throw
    const report = buildDpiaReport(input);
    expect(report).toContain("# Data Protection Impact Assessment");
  });
});

describe("wkflExportReport DPIA routing", () => {
  const ORIGINAL_CWD = process.cwd();
  const TEST_ROOT = `/tmp/workflow-intelligence-mcp-dpia-export-${process.pid}`;
  const DATA_DIR = "data";
  const AID = "test-dpia-routing";

  function store(key: string, data: unknown) {
    storeState(AID, key, data, DATA_DIR);
  }

  beforeEach(() => {
    mkdirSync(TEST_ROOT, { recursive: true });
    process.chdir(TEST_ROOT);
    mkdirSync(DATA_DIR, { recursive: true });
  });

  afterEach(() => {
    deleteAssessment(AID, DATA_DIR);
    process.chdir(ORIGINAL_CWD);
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("routes to DPIA when task_id is dpia_assessment", async () => {
    // Store minimal DPIA state
    store("screening", { outcome: "required", rationale: "User-initiated" });
    store("processing_description", {
      data_types: [{ category: "email" }],
      data_subjects: [{ type: "customers" }],
      purposes: ["marketing"],
      legal_basis: { article_6_basis: { basis: "consent", article: "Art. 6(1)(a)" } },
    });
    store("necessity_assessment", {
      assessment_narrative: "Consent-based processing is necessary for opted-in marketing",
      proportionality_assessment: "Only email addresses collected for the stated purpose",
    });
    store("risks", [
      { id: "R1", category: "loss_of_control", affected_rights: [{ right: "Art. 21" }], harm_description: "Unwanted marketing messages cause annoyance and loss of control over personal data" },
    ]);
    store("risk_analysis", [
      { id: "R1", likelihood_score: 2, severity_score: 2, score: 4 },
    ]);
    store("risk_matrix_summary", { critical: 0, high: 0, medium: 0, low: 1 });
    store("safeguards", [
      { risk_id: "R1", measure: "One-click unsubscribe", type: "technical", gdpr_article: "Art. 21", score_before: 4, score_after: 2 },
    ]);
    store("consultation_assessment", {
      consultation_required: false,
      consultation_basis: "All residual risks are Low after safeguards applied. Art 36 threshold not met. No Member State triggers identified.",
      member_state_triggers_checked: true,
    });
    store("scope_and_methodology", { assessment_date: "2026-03-16" });
    store("report_ready", true);

    const result = await wkflExportReport({ assessment_id: AID, task_id: "dpia_assessment" });

    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain("Data Protection Impact Assessment");
    expect(text).toContain("Art. 35(7) Compliance Mapping");
  });

  it("routes to DPIA when report_format is dpia", async () => {
    store("screening", { outcome: "required", rationale: "test" });
    store("processing_description", { data_types: [{ category: "x" }], data_subjects: [{ type: "y" }], purposes: ["z"], legal_basis: { article_6_basis: { basis: "consent" } } });
    store("necessity_assessment", { assessment_narrative: "necessary for the stated purpose which is clearly defined", proportionality_assessment: "proportionate to the stated purpose" });
    store("risks", [{ id: "R1", category: "loss_of_control", affected_rights: [{ right: "Art. 21" }] }]);
    store("risk_analysis", [{ id: "R1", score: 4 }]);
    store("safeguards", [{ risk_id: "R1", measure: "x", score_before: 4, score_after: 2 }]);
    store("consultation_assessment", { consultation_required: false, consultation_basis: "All risks low after safeguards. Art 36 not triggered. Member state checks done.", member_state_triggers_checked: true });
    store("scope_and_methodology", {});
    store("report_ready", true);

    const result = await wkflExportReport({ assessment_id: AID, report_format: "dpia" });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Data Protection Impact Assessment");
  });

  it("blocks export when DPIA state is incomplete", async () => {
    // Store only screening — missing all other required fields
    store("screening", { outcome: "required", rationale: "test" });

    const result = await wkflExportReport({ assessment_id: AID, task_id: "dpia_assessment" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("incomplete");
  });
});
