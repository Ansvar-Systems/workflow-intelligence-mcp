import { describe, it, expect } from "vitest";
import { generateGapSummary } from "../../src/tools/generate-gap-summary.js";
import completeFixture from "../fixtures/gap-analysis-complete.json";
import emptyFixture from "../fixtures/gap-analysis-empty.json";

describe("generateGapSummary", () => {
  it("returns structured summary for complete assessment", async () => {
    const result = await generateGapSummary({
      task_id: "dora_gap_analysis",
      stage_state: completeFixture,
    });
    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    expect(data.regulation).toContain("DORA");
    expect(data.overall_status).toBe("gaps_identified");
    expect(data.summary_by_section).toHaveLength(2);
  });

  it("counts statuses correctly per section", async () => {
    const result = await generateGapSummary({
      task_id: "dora_gap_analysis",
      stage_state: completeFixture,
    });
    const data = JSON.parse(result.content[0].text);
    const pillar1 = data.summary_by_section[0];
    // complete fixture pillar 1: 1 compliant, 1 partially, 1 non_compliant
    expect(pillar1.compliant_count).toBe(1);
    expect(pillar1.partially_compliant_count).toBe(1);
    expect(pillar1.non_compliant_count).toBe(1);
  });

  it("derives priority ranking from regulation structure", async () => {
    const result = await generateGapSummary({
      task_id: "dora_gap_analysis",
      stage_state: completeFixture,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.remediation_ranking.length).toBeGreaterThan(0);
    expect(data.remediation_ranking[0].provision_ref).toBeDefined();
    expect(data.remediation_ranking[0].regulatory_weight).toBeDefined();
  });

  it("includes export metadata", async () => {
    const result = await generateGapSummary({
      task_id: "dora_gap_analysis",
      stage_state: completeFixture,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.export_metadata.sections_for_export).toContain("executive_summary");
    expect(data.export_metadata.sections_for_export).toContain("remediation_ranking");
  });

  it("collects unique assessors", async () => {
    const result = await generateGapSummary({
      task_id: "dora_gap_analysis",
      stage_state: completeFixture,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.assessors).toContain("J. Smith");
    expect(data.assessors).toContain("A. Mueller");
  });

  it("returns assessment_incomplete for unfinished assessment", async () => {
    const result = await generateGapSummary({
      task_id: "dora_gap_analysis",
      stage_state: emptyFixture,
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.overall_status).toBe("assessment_incomplete");
  });

  it("returns error for missing task_id", async () => {
    const result = await generateGapSummary({ stage_state: completeFixture });
    expect(result.isError).toBe(true);
  });

  it("returns error for missing stage_state", async () => {
    const result = await generateGapSummary({ task_id: "dora_gap_analysis" });
    expect(result.isError).toBe(true);
  });

  it("ranks critical gaps before medium gaps", async () => {
    const result = await generateGapSummary({
      task_id: "dora_gap_analysis",
      stage_state: completeFixture,
    });
    const data = JSON.parse(result.content[0].text);
    if (data.remediation_ranking.length > 1) {
      const weights = data.remediation_ranking.map((g: any) => g.regulatory_weight);
      const weightOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      for (let i = 1; i < weights.length; i++) {
        expect(weightOrder[weights[i] as keyof typeof weightOrder]).toBeGreaterThanOrEqual(
          weightOrder[weights[i - 1] as keyof typeof weightOrder],
        );
      }
    }
  });
});
