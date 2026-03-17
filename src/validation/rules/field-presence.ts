/**
 * Field presence validation rules.
 *
 * Checks that required fields exist in the stage state and meet
 * minimum count constraints (for array fields).
 */

import type { FieldRule } from "../../types/task.js";
import type { RuleFailure } from "../../types/validation.js";

/**
 * Evaluate field presence rules against a state object.
 *
 * Supported rule types:
 * - "min_count": field must be an array with at least `value` items
 * - "exists": field must be present and non-null
 * - "equals": field must be present and strictly equal to `value`
 */
export function evaluateFieldPresence(
  state: Record<string, unknown>,
  rules: FieldRule[],
): RuleFailure[] {
  const failures: RuleFailure[] = [];

  for (const rule of rules) {
    const value = state[rule.field];

    if (rule.rule === "exists") {
      if (value === undefined || value === null) {
        failures.push({
          rule: "field_presence",
          severity: "required",
          details: rule.message,
          field: rule.field,
        });
      }
      continue;
    }

    if (rule.rule === "equals") {
      if (value !== rule.value) {
        failures.push({
          rule: "field_presence",
          severity: "required",
          details: rule.message,
          field: rule.field,
        });
      }
      continue;
    }

    // min_count
    if (value === undefined || value === null) {
      failures.push({
        rule: "field_presence",
        severity: "required",
        details: rule.message,
        field: rule.field,
      });
      continue;
    }

    if (!Array.isArray(value)) {
      failures.push({
        rule: "field_presence",
        severity: "required",
        details: rule.message,
        field: rule.field,
      });
      continue;
    }

    if (value.length < rule.value) {
      failures.push({
        rule: "field_presence",
        severity: "required",
        details: rule.message,
        field: rule.field,
      });
    }
  }

  return failures;
}
