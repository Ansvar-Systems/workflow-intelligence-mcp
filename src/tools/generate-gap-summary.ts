/** Generate a structured gap summary from a completed gap analysis stage state. */

import type { ToolResult } from "./index.js";
import type {
  GapAnalysisStageState,
  SectionAssessment,
  ProvisionAssessment,
  PrioritizedGap,
  SectionSummary,
  GapSummary,
} from "../types/gap-analysis.js";

const META = {
  server: "workflow-intelligence-mcp",
  version: "1.0.0",
  disclaimer:
    "This gap summary is generated from the provided assessment data. It does not constitute legal or regulatory advice. Verify all findings with qualified professionals.",
};

const WEIGHT_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Parse the DORA article number from a provision_ref like "DORA Art. 5(1)".
 * Returns the article number or null if parsing fails.
 */
function parseDORAArticle(provisionRef: string): number | null {
  const match = provisionRef.match(/^DORA\s+Art\.\s+(\d+)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/**
 * Derive regulatory weight for a gap based on DORA structure.
 *
 * - Core DORA articles in Pillar 1 (Arts 5-16) → "critical"
 * - Core DORA articles in Pillar 2 (Arts 17-23) → "critical"
 * - Other DORA articles → "high"
 * - RTS provisions (regulation_source starts with "dora-rts") → "medium"
 * - ITS provisions (regulation_source starts with "dora-its") → "low"
 * - Anything else → "high"
 */
function deriveWeight(
  provision: ProvisionAssessment,
): { weight: PrioritizedGap["regulatory_weight"]; reasoning: string } {
  const { provision_ref, regulation_source } = provision;

  // Check RTS/ITS first (they also contain article references)
  if (regulation_source.startsWith("dora-its")) {
    return { weight: "low", reasoning: "ITS implementing provision" };
  }
  if (regulation_source.startsWith("dora-rts")) {
    return { weight: "medium", reasoning: "RTS delegated provision" };
  }

  // Check core DORA articles
  const articleNum = parseDORAArticle(provision_ref);
  if (articleNum !== null) {
    if (articleNum >= 5 && articleNum <= 16) {
      return {
        weight: "critical",
        reasoning: "Pillar 1 core article (ICT Risk Management, Arts 5-16)",
      };
    }
    if (articleNum >= 17 && articleNum <= 23) {
      return {
        weight: "critical",
        reasoning: "Pillar 2 core article (Incident Reporting, Arts 17-23)",
      };
    }
    return {
      weight: "high",
      reasoning: `DORA article outside core pillars (Art. ${articleNum})`,
    };
  }

  // Default for unknown structures
  return { weight: "high", reasoning: "Regulatory provision (unclassified)" };
}

function countStatus(
  provisions: ProvisionAssessment[],
  status: string,
): number {
  return provisions.filter((p) => p.status === status).length;
}

function buildSectionSummary(
  section: SectionAssessment,
  allGaps: PrioritizedGap[],
): SectionSummary {
  const { provisions } = section;

  const compliant = countStatus(provisions, "compliant");
  const partially = countStatus(provisions, "partially_compliant");
  const nonCompliant = countStatus(provisions, "non_compliant");
  const notApplicable = countStatus(provisions, "not_applicable");

  const totalApplicable = provisions.length - notApplicable;
  const complianceRatio =
    totalApplicable > 0
      ? `${compliant}/${totalApplicable}`
      : "N/A";

  const sectionGaps = allGaps.filter((g) =>
    provisions.some((p) => p.provision_ref === g.provision_ref),
  );

  return {
    section_id: section.section_id,
    section_name: section.section_name,
    compliant_count: compliant,
    partially_compliant_count: partially,
    non_compliant_count: nonCompliant,
    not_applicable_count: notApplicable,
    total_applicable: totalApplicable,
    compliance_ratio: complianceRatio,
    critical_gaps: sectionGaps.filter((g) => g.regulatory_weight === "critical"),
  };
}

function determineOverallStatus(
  stageState: GapAnalysisStageState,
): GapSummary["overall_status"] {
  const allProvisions = stageState.sections.flatMap((s) => s.provisions);

  if (allProvisions.some((p) => p.status === "not_assessed")) {
    return "assessment_incomplete";
  }
  if (
    allProvisions.some(
      (p) =>
        p.status === "non_compliant" || p.status === "partially_compliant",
    )
  ) {
    return "gaps_identified";
  }
  return "fully_compliant";
}

function collectAssessors(stageState: GapAnalysisStageState): string[] {
  const assessors = new Set<string>();
  for (const section of stageState.sections) {
    for (const provision of section.provisions) {
      if (provision.assessed_by) {
        assessors.add(provision.assessed_by);
      }
    }
  }
  return Array.from(assessors).sort();
}

function buildRemediationRanking(
  stageState: GapAnalysisStageState,
): PrioritizedGap[] {
  const gaps: PrioritizedGap[] = [];

  for (const section of stageState.sections) {
    for (const provision of section.provisions) {
      if (
        provision.status === "non_compliant" ||
        provision.status === "partially_compliant"
      ) {
        const { weight, reasoning } = deriveWeight(provision);
        gaps.push({
          rank: 0, // assigned after sorting
          provision_ref: provision.provision_ref,
          regulation_source: provision.regulation_source,
          gap_description: provision.gaps ?? "No gap description provided",
          regulatory_weight: weight,
          weight_reasoning: reasoning,
        });
      }
    }
  }

  // Sort by weight (critical first)
  gaps.sort((a, b) => WEIGHT_ORDER[a.regulatory_weight] - WEIGHT_ORDER[b.regulatory_weight]);

  // Assign ranks after sorting
  gaps.forEach((g, i) => {
    g.rank = i + 1;
  });

  return gaps;
}

function buildScopingSummary(scoping: Record<string, unknown>): string {
  const parts: string[] = [];
  if (scoping.entity_type) parts.push(String(scoping.entity_type));
  if (scoping.member_state) parts.push(`${scoping.member_state}`);
  if (scoping.is_microenterprise) parts.push("microenterprise");
  if (scoping.designated_for_tlpt) parts.push("TLPT-designated");
  if (scoping.competent_authority) parts.push(`supervised by ${scoping.competent_authority}`);
  return parts.join(", ") || "No scoping data";
}

export async function generateGapSummary(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const taskId = args.task_id as string | undefined;
  const stageState = args.stage_state as GapAnalysisStageState | undefined;

  if (!taskId) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "missing_parameter",
            message: "task_id is required.",
          }),
        },
      ],
      isError: true,
    };
  }

  if (!stageState) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "missing_parameter",
            message: "stage_state is required.",
          }),
        },
      ],
      isError: true,
    };
  }

  const scoping = stageState.scoping ?? {};
  const remediationRanking = buildRemediationRanking(stageState);
  const overallStatus = determineOverallStatus(stageState);
  const assessors = collectAssessors(stageState);

  const summaryBySection = stageState.sections.map((section) =>
    buildSectionSummary(section, remediationRanking),
  );

  const summary: GapSummary = {
    regulation: `DORA — Digital Operational Resilience Act (Regulation (EU) 2022/2554)`,
    entity: {
      name: (scoping.entity_name as string) ?? "Unknown",
      type: (scoping.entity_type as string) ?? "Unknown",
      scoping_summary: buildScopingSummary(scoping),
    },
    assessment_date: new Date().toISOString().split("T")[0],
    assessors,
    overall_status: overallStatus,
    summary_by_section: summaryBySection,
    remediation_ranking: remediationRanking,
    export_metadata: {
      format_hint: "structured_json",
      sections_for_export: [
        "executive_summary",
        "summary_by_section",
        "remediation_ranking",
        "assessor_details",
        "scoping",
      ],
    },
    _meta: META,
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(summary, null, 2),
      },
    ],
  };
}
