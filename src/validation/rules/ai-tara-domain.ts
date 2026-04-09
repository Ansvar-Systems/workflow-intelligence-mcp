import type { RuleFailure } from "../../types/validation.js";

export function checkDomainFindingsMerged(
  state: Record<string, unknown>,
): RuleFailure[] {
  const findings = (state as { domain_findings?: unknown[] }).domain_findings;
  if (!Array.isArray(findings) || findings.length === 0) return [];

  const failures: RuleFailure[] = [];
  for (const f of findings) {
    const finding = f as Record<string, unknown>;
    const status = finding.status as string | undefined;
    if (status !== "merged" && status !== "rejected") {
      failures.push({
        rule: "domain_findings_merged",
        severity: "required",
        details: `Domain finding '${finding.id}' has status '${status}' — must be merged or rejected`,
      });
    }
  }
  return failures;
}
