/**
 * DORA entity scoping logic.
 *
 * Determines which DORA (Regulation (EU) 2022/2554) provisions apply
 * to a given financial entity based on type, size, and regulatory
 * designations.  The output tells an agent which provisions can be
 * pre-marked "not_applicable" with the corresponding exemption reason.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DoraScopingInput {
  entity_name: string;
  entity_type: string;
  is_microenterprise: boolean;
  designated_for_tlpt: boolean;
  member_state?: string;
  competent_authority?: string;
}

export interface ExcludedProvision {
  provision_ref: string;
  reason: string;
}

export interface DoraScopingResult {
  applicable_sections: string[];
  excluded_provisions: ExcludedProvision[];
  scoping_summary: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The five pillars of DORA that always apply regardless of entity
 * characteristics — individual provisions within a pillar may be
 * excluded, but the section itself remains applicable.
 */
const DORA_PILLARS: string[] = [
  "pillar_1_ict_risk_management",
  "pillar_2_incident_reporting",
  "pillar_3_resilience_testing",
  "pillar_4_third_party_risk",
  "pillar_5_information_sharing",
];

/**
 * TLPT provisions: DORA Art. 26(1)-(8) and Art. 27(1)-(3).
 * These advanced threat-led penetration testing requirements only
 * apply to entities explicitly designated by their competent
 * authority.  Non-designated entities still perform basic testing
 * under Articles 24-25.
 */
const TLPT_PROVISIONS: string[] = [
  "DORA Art. 26(1)",
  "DORA Art. 26(2)",
  "DORA Art. 26(3)",
  "DORA Art. 26(4)",
  "DORA Art. 26(5)",
  "DORA Art. 26(6)",
  "DORA Art. 26(7)",
  "DORA Art. 26(8)",
  "DORA Art. 27(1)",
  "DORA Art. 27(2)",
  "DORA Art. 27(3)",
];

/**
 * Detailed ICT risk management provisions that microenterprises are
 * exempt from under DORA Article 16.  Microenterprises follow the
 * simplified ICT risk management framework instead of the full
 * requirements in Articles 6-13.
 */
const MICRO_SIMPLIFIED_PROVISIONS: string[] = [
  // Art. 6(5)-(8): detailed ICT risk management framework elements
  "DORA Art. 6(5)",
  "DORA Art. 6(6)",
  "DORA Art. 6(7)",
  "DORA Art. 6(8)",
  // Art. 7: ICT systems, protocols and tools
  "DORA Art. 7(1)",
  "DORA Art. 7(2)",
  "DORA Art. 7(3)",
  "DORA Art. 7(4)",
  // Art. 8: identification of ICT assets and risks
  "DORA Art. 8(1)",
  "DORA Art. 8(2)",
  "DORA Art. 8(3)",
  "DORA Art. 8(4)",
  "DORA Art. 8(5)",
  "DORA Art. 8(6)",
  // Art. 9: protection and prevention
  "DORA Art. 9(1)",
  "DORA Art. 9(2)",
  "DORA Art. 9(3)",
  "DORA Art. 9(4)",
  // Art. 10: detection
  "DORA Art. 10(1)",
  "DORA Art. 10(2)",
  "DORA Art. 10(3)",
  "DORA Art. 10(4)",
  "DORA Art. 10(5)",
  // Art. 11: response and recovery
  "DORA Art. 11(1)",
  "DORA Art. 11(2)",
  "DORA Art. 11(3)",
  "DORA Art. 11(4)",
  "DORA Art. 11(5)",
  "DORA Art. 11(6)",
  "DORA Art. 11(7)",
  "DORA Art. 11(8)",
  "DORA Art. 11(9)",
  "DORA Art. 11(10)",
  // Art. 12: backup policies and recovery methods
  "DORA Art. 12(1)",
  "DORA Art. 12(2)",
  "DORA Art. 12(3)",
  "DORA Art. 12(4)",
  "DORA Art. 12(5)",
  // Art. 13: learning and evolving
  "DORA Art. 13(1)",
  "DORA Art. 13(2)",
  "DORA Art. 13(3)",
  "DORA Art. 13(4)",
  "DORA Art. 13(5)",
  "DORA Art. 13(6)",
];

// ---------------------------------------------------------------------------
// Scoping function
// ---------------------------------------------------------------------------

/**
 * Apply DORA proportionality rules to determine which provisions
 * are applicable (and which are excluded) for a specific financial
 * entity.
 */
export function applyDoraScoping(input: DoraScopingInput): DoraScopingResult {
  const excluded: ExcludedProvision[] = [];

  // Rule 1: TLPT exemption — Article 26(8)
  if (!input.designated_for_tlpt) {
    for (const ref of TLPT_PROVISIONS) {
      excluded.push({
        provision_ref: ref,
        reason:
          "Entity not designated for TLPT by competent authority. " +
          "Advanced threat-led penetration testing under DORA Articles 26-27 " +
          "does not apply. Basic resilience testing under Articles 24-25 still required.",
      });
    }
  }

  // Rule 2: Microenterprise simplified framework — Article 16
  if (input.is_microenterprise) {
    for (const ref of MICRO_SIMPLIFIED_PROVISIONS) {
      excluded.push({
        provision_ref: ref,
        reason:
          "Entity classified as microenterprise — simplified ICT risk management " +
          "framework applies under DORA Article 16 instead of the detailed " +
          "provisions in Articles 6-13.",
      });
    }
  }

  // Rule 3: All 5 pillars always apply regardless of exemptions
  const applicable_sections = [...DORA_PILLARS];

  // Build human-readable summary
  const scoping_summary = buildScopingSummary(input);

  return {
    applicable_sections,
    excluded_provisions: excluded,
    scoping_summary,
  };
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildScopingSummary(input: DoraScopingInput): string {
  const parts: string[] = [];

  parts.push(
    `DORA scoping for ${input.entity_name} (${input.entity_type}).`,
  );

  if (input.is_microenterprise) {
    parts.push(
      "Classified as microenterprise: simplified ICT risk management framework applies (Article 16).",
    );
  }

  if (input.designated_for_tlpt) {
    parts.push(
      "TLPT designated: advanced threat-led penetration testing required (Articles 26-27).",
    );
  } else {
    parts.push(
      "Not TLPT designated: basic resilience testing applies (Articles 24-25), advanced TLPT provisions excluded.",
    );
  }

  if (input.member_state) {
    const authorityNote = input.competent_authority
      ? ` (competent authority: ${input.competent_authority})`
      : "";
    parts.push(`Member state: ${input.member_state}${authorityNote}.`);
  }

  parts.push("All 5 DORA pillars remain applicable.");

  return parts.join(" ");
}
