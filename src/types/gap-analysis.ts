/** Gap analysis types for regulation compliance assessments. */

export type EvidenceType =
  | "policy"
  | "procedure"
  | "test_report"
  | "config"
  | "contract"
  | "training_record"
  | "other";

export interface EvidenceRecord {
  type: EvidenceType;
  reference: string;
  date?: string;
  note?: string;
}

export type AssessmentStatus =
  | "compliant"
  | "partially_compliant"
  | "non_compliant"
  | "not_applicable"
  | "not_assessed";

export interface ProvisionAssessment {
  provision_ref: string;
  regulation_source: string;
  status: AssessmentStatus;
  evidence: EvidenceRecord[];
  gaps: string | null;
  exemption_basis: string | null;
  assessed_by: string;
  assessed_at: string;
}

export interface SectionAssessment {
  section_id: string;
  section_name: string;
  provisions: ProvisionAssessment[];
}

export interface GapAnalysisStageState {
  scoping: Record<string, unknown>;
  sections: SectionAssessment[];
}

export interface SectionSummary {
  section_id: string;
  section_name: string;
  compliant_count: number;
  partially_compliant_count: number;
  non_compliant_count: number;
  not_applicable_count: number;
  total_applicable: number;
  compliance_ratio: string;
  critical_gaps: PrioritizedGap[];
}

export interface PrioritizedGap {
  rank: number;
  provision_ref: string;
  regulation_source: string;
  gap_description: string;
  regulatory_weight: "critical" | "high" | "medium" | "low";
  weight_reasoning: string;
}

export interface GapSummary {
  regulation: string;
  entity: {
    name: string;
    type: string;
    scoping_summary: string;
  };
  assessment_date: string;
  assessors: string[];
  overall_status: "fully_compliant" | "gaps_identified" | "assessment_incomplete";
  summary_by_section: SectionSummary[];
  remediation_ranking: PrioritizedGap[];
  export_metadata: {
    format_hint: "structured_json";
    sections_for_export: string[];
  };
  _meta: {
    server: string;
    version: string;
    disclaimer: string;
  };
}
