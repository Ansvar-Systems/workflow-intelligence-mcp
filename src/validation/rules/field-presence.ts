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
 * For each rule with `rule: "min_count"`, the field must exist in
 * the state, be an array, and contain at least `rule.value` items.
 */
export function evaluateFieldPresence(
  state: Record<string, unknown>,
  rules: FieldRule[],
): RuleFailure[] {
  const failures: RuleFailure[] = [];

  for (const rule of rules) {
    const value = state[rule.field];

    if (value === undefined || value === null) {
      failures.push({
        rule: "field_presence",
        severity: "required",
        details: rule.message,
        field: rule.field,
      });
      continue;
    }

    if (rule.rule === "min_count") {
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
  }

  return failures;
}
