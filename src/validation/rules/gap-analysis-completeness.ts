import type { RuleFailure } from "../../types/validation.js";
import type { GapAnalysisStageState } from "../../types/gap-analysis.js";

export function checkAllProvisionsAssessed(
  state: GapAnalysisStageState,
): RuleFailure[] {
  const failures: RuleFailure[] = [];

  for (const section of state.sections) {
    for (const provision of section.provisions) {
      if (provision.status === "not_assessed") {
        failures.push({
          rule: "all_provisions_assessed",
          severity: "required",
          details: `Provision '${provision.provision_ref}' in ${section.section_id} has not been assessed`,
        });
      }
    }
  }

  return failures;
}
