/**
 * Quality rubric evaluation.
 *
 * Checks string fields for minimum word counts and iterates
 * array items to validate per-item field quality. All rubric
 * failures are severity "warning".
 */

import type { QualityRubricEntry } from "../../types/task.js";
import type { RuleFailure } from "../../types/validation.js";

/**
 * Count the number of words in a string.
 * Splits on whitespace and filters out empty tokens.
 */
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/**
 * Interpolate template placeholders like {name}, {id}, {source_id}
 * with actual values from a data item.
 */
function interpolate(
  template: string,
  item: Record<string, unknown>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = item[key];
    if (value === undefined || value === null) return `{${key}}`;
    return String(value);
  });
}

/**
 * Evaluate quality rubric rules against a state object.
 *
 * For each field in the rubric:
 * - If the rubric entry has `min_words`, check the string field's word count.
 * - If the rubric entry has `min_count`, check the array field length.
 * - If the rubric entry has `per_item`, iterate array items and check
 *   each nested field rule (currently supports `min_words` and `min_count`).
 *
 * All failures have severity "warning".
 */
export function evaluateQualityRubric(
  state: Record<string, unknown>,
  rubric: Record<string, QualityRubricEntry>,
): RuleFailure[] {
  const failures: RuleFailure[] = [];

  for (const [field, entry] of Object.entries(rubric)) {
    const value = state[field];

    // Skip if the field is missing entirely (field-presence rules handle that)
    if (value === undefined || value === null) continue;

    // Top-level min_words check on a string field
    if (entry.min_words !== undefined && typeof value === "string") {
      const words = countWords(value);
      if (words < entry.min_words) {
        const message =
          entry.message ??
          `Field '${field}' has ${words} words, minimum is ${entry.min_words}`;
        failures.push({
          rule: "quality_rubric",
          severity: "warning",
          details: message,
          field,
        });
      }
    }

    if (entry.min_count !== undefined && Array.isArray(value)) {
      if (value.length < entry.min_count) {
        const message =
          entry.message ??
          `Field '${field}' has ${value.length} item(s), minimum is ${entry.min_count}`;
        failures.push({
          rule: "quality_rubric",
          severity: "warning",
          details: message,
          field,
        });
      }
    }

    // Per-item checks on array fields
    if (entry.per_item !== undefined && Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i] as Record<string, unknown>;
        if (typeof item !== "object" || item === null) continue;

        for (const [itemField, itemRule] of Object.entries(entry.per_item)) {
          const itemValue = item[itemField];

          if (itemRule.min_words !== undefined) {
            if (
              itemValue === undefined ||
              itemValue === null ||
              itemValue === ""
            ) {
              // Missing or empty field — warn
              const message = interpolate(itemRule.message, item);
              failures.push({
                rule: "quality_rubric",
                severity: "warning",
                details: message,
                field: `${field}[${i}].${itemField}`,
              });
            } else if (typeof itemValue === "string") {
              const words = countWords(itemValue);
              if (words < itemRule.min_words) {
                const message = interpolate(itemRule.message, item);
                failures.push({
                  rule: "quality_rubric",
                  severity: "warning",
                  details: message,
                  field: `${field}[${i}].${itemField}`,
                });
              }
            }
          }

          if (itemRule.min_count !== undefined) {
            if (!Array.isArray(itemValue) || itemValue.length < itemRule.min_count) {
              const message = interpolate(itemRule.message, item);
              failures.push({
                rule: "quality_rubric",
                severity: "warning",
                details: message,
                field: `${field}[${i}].${itemField}`,
              });
            }
          }
        }
      }
    }
  }

  return failures;
}
