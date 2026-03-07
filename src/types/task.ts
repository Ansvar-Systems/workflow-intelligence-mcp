/** Task and workflow definition types. */

export interface McpToolRef {
  mcp: string;
  tools: string[];
  when: string;
  guidance: string;
}

export interface TaskDependency {
  task_id: string;
  relationship: "requires_output" | "requires_completion" | "enhances";
  required_fields?: string[];
  optional_fields?: string[];
  description: string;
}

export type FieldRule =
  | { field: string; rule: "min_count"; value: number; message: string }
  | { field: string; rule: "exists"; message: string }
  | { field: string; rule: "equals"; value: unknown; message: string };

export interface StructuralRule {
  id: string;
  description: string;
  severity: "required" | "warning";
  message_template: string;
}

export interface QualityRubricFieldRule {
  min_words?: number;
  severity: "warning";
  message: string;
}

export interface QualityRubricEntry {
  min_words?: number;
  must_mention_any?: string[];
  severity?: "warning";
  message?: string;
  per_item?: Record<string, QualityRubricFieldRule>;
}

export interface CompletionCriteria {
  required_fields: FieldRule[];
  rules: StructuralRule[];
  soft_warnings: FieldRule[];
}

export interface PhaseDefinition {
  id: string;
  name: string;
  description: string;
  completion_criteria: CompletionCriteria;
  quality_rubric: Record<string, QualityRubricEntry>;
}

export interface TaskDefinition {
  id: string;
  name: string;
  category: string;
  version: string;
  standalone: boolean;
  used_in_workflows: string[];
  description: string;
  estimated_duration: string;
  dependencies: TaskDependency[];
  mcp_tools: McpToolRef[];
  prompting_guidance: string;
  stage_state_schema: Record<string, unknown>;
  completion_criteria: CompletionCriteria;
  quality_rubric: Record<string, QualityRubricEntry>;
  /** Optional linear phases for multi-phase tasks (e.g., compliance assessment). */
  phases?: PhaseDefinition[];
}
