import type { RuleFailure } from "../../types/validation.js";
import type { GapAnalysisStageState } from "../../types/gap-analysis.js";

export function checkExemptionBasisRequired(
  state: GapAnalysisStageState,
): RuleFailure[] {
  const failures: RuleFailure[] = [];

  for (const section of state.sections) {
    for (const provision of section.provisions) {
      if (
        provision.status === "not_applicable" &&
        !provision.exemption_basis?.trim()
      ) {
        failures.push({
          rule: "exemption_basis_required",
          severity: "required",
          details: `Provision '${provision.provision_ref}' is marked not_applicable but has no exemption basis`,
        });
      }
    }
  }

  return failures;
}

export function checkAssessorMetadataPresent(
  state: GapAnalysisStageState,
): RuleFailure[] {
  const failures: RuleFailure[] = [];

  for (const section of state.sections) {
    for (const provision of section.provisions) {
      if (provision.status === "not_assessed") continue;

      if (!provision.assessed_by?.trim()) {
        failures.push({
          rule: "assessor_metadata_present",
          severity: "required",
          details: `Provision '${provision.provision_ref}' has been assessed but assessed_by is empty`,
        });
      }
      if (!provision.assessed_at?.trim()) {
        failures.push({
          rule: "assessor_metadata_present",
          severity: "required",
          details: `Provision '${provision.provision_ref}' has been assessed but assessed_at is empty`,
        });
      }
    }
  }

  return failures;
}
