import type { RuleFailure } from "../../types/validation.js";
import type { GapAnalysisStageState } from "../../types/gap-analysis.js";

export function checkGapsRequiredForNonCompliant(
  state: GapAnalysisStageState,
): RuleFailure[] {
  const failures: RuleFailure[] = [];
  const needsGaps = new Set(["partially_compliant", "non_compliant"]);

  for (const section of state.sections) {
    for (const provision of section.provisions) {
      if (needsGaps.has(provision.status) && !provision.gaps?.trim()) {
        failures.push({
          rule: "gaps_required_for_non_compliant",
          severity: "required",
          details: `Provision '${provision.provision_ref}' is ${provision.status} but has no gap description`,
        });
      }
    }
  }

  return failures;
}

export function checkEvidenceRequiredForCompliant(
  state: GapAnalysisStageState,
): RuleFailure[] {
  const failures: RuleFailure[] = [];
  const needsEvidence = new Set(["compliant", "partially_compliant"]);

  for (const section of state.sections) {
    for (const provision of section.provisions) {
      if (
        needsEvidence.has(provision.status) &&
        provision.evidence.length === 0
      ) {
        failures.push({
          rule: "evidence_required_for_compliant",
          severity: "required",
          details: `Provision '${provision.provision_ref}' is ${provision.status} but has no evidence records`,
        });
      }
    }
  }

  return failures;
}

export function checkEvidenceHasDate(
  state: GapAnalysisStageState,
): RuleFailure[] {
  const failures: RuleFailure[] = [];

  for (const section of state.sections) {
    for (const provision of section.provisions) {
      for (const evidence of provision.evidence) {
        if (!evidence.date) {
          failures.push({
            rule: "evidence_has_date",
            severity: "warning",
            details: `Evidence '${evidence.reference}' on provision '${provision.provision_ref}' has no date`,
          });
        }
      }
    }
  }

  return failures;
}

const EVIDENCE_REF_MIN_WORDS = 2;

export function checkEvidenceReferenceQuality(
  state: GapAnalysisStageState,
): RuleFailure[] {
  const failures: RuleFailure[] = [];

  for (const section of state.sections) {
    for (const provision of section.provisions) {
      for (const evidence of provision.evidence) {
        const wordCount = evidence.reference
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0).length;
        if (wordCount < EVIDENCE_REF_MIN_WORDS) {
          failures.push({
            rule: "evidence_reference_quality",
            severity: "warning",
            details: `Evidence reference '${evidence.reference}' on provision '${provision.provision_ref}' has ${wordCount} word(s) (minimum ${EVIDENCE_REF_MIN_WORDS} expected)`,
          });
        }
      }
    }
  }

  return failures;
}

const GAP_MIN_WORDS = 10;

export function checkGapDescriptionQuality(
  state: GapAnalysisStageState,
): RuleFailure[] {
  const failures: RuleFailure[] = [];

  for (const section of state.sections) {
    for (const provision of section.provisions) {
      if (provision.gaps && provision.gaps.trim()) {
        const wordCount = provision.gaps
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0).length;
        if (wordCount < GAP_MIN_WORDS) {
          failures.push({
            rule: "gap_description_quality",
            severity: "warning",
            details: `Gap description for '${provision.provision_ref}' has ${wordCount} words (minimum ${GAP_MIN_WORDS} expected for audit trail)`,
          });
        }
      }
    }
  }

  return failures;
}
