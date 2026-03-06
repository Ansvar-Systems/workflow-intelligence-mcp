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
 * TLPT provisions: DORA Art. 26(1)-(11), Art. 27(1)-(3), and the
 * entire RTS TLPT (15 substantive articles).  These advanced
 * threat-led penetration testing requirements only apply to entities
 * explicitly designated by their competent authority.
 * Non-designated entities still perform basic testing under
 * Articles 24-25.
 */
const TLPT_PROVISIONS: string[] = [
  // Level 1 DORA
  "DORA Art. 26(1)",
  "DORA Art. 26(2)",
  "DORA Art. 26(3)",
  "DORA Art. 26(4)",
  "DORA Art. 26(5)",
  "DORA Art. 26(6)",
  "DORA Art. 26(7)",
  "DORA Art. 26(8)",
  "DORA Art. 26(9)",
  "DORA Art. 26(10)",
  "DORA Art. 26(11)",
  "DORA Art. 27(1)",
  "DORA Art. 27(2)",
  "DORA Art. 27(3)",
  // RTS TLPT (all substantive articles)
  "RTS TLPT Art. 2",
  "RTS TLPT Art. 3",
  "RTS TLPT Art. 4",
  "RTS TLPT Art. 5",
  "RTS TLPT Art. 6",
  "RTS TLPT Art. 7",
  "RTS TLPT Art. 8",
  "RTS TLPT Art. 9",
  "RTS TLPT Art. 10",
  "RTS TLPT Art. 11",
  "RTS TLPT Art. 12",
  "RTS TLPT Art. 13",
  "RTS TLPT Art. 14",
  "RTS TLPT Art. 15",
  "RTS TLPT Art. 16",
];

/**
 * Detailed ICT risk management provisions that microenterprises are
 * exempt from under DORA Article 16.  Microenterprises follow the
 * simplified ICT risk management framework instead of the full
 * requirements in Articles 6-13.  At the RTS level, they use
 * Arts 28-41 (simplified framework) instead of Arts 1-27 (full).
 */
const MICRO_SIMPLIFIED_PROVISIONS: string[] = [
  // Level 1 DORA: Arts 6(5)-13(7)
  // Art 7 is a single-paragraph article (no numbered paragraphs)
  "DORA Art. 6(5)",
  "DORA Art. 6(6)",
  "DORA Art. 6(7)",
  "DORA Art. 6(8)",
  "DORA Art. 6(9)",
  "DORA Art. 6(10)",
  "DORA Art. 7",
  "DORA Art. 8(1)",
  "DORA Art. 8(2)",
  "DORA Art. 8(3)",
  "DORA Art. 8(4)",
  "DORA Art. 8(5)",
  "DORA Art. 8(6)",
  "DORA Art. 8(7)",
  "DORA Art. 9(1)",
  "DORA Art. 9(2)",
  "DORA Art. 9(3)",
  "DORA Art. 9(4)",
  "DORA Art. 10(1)",
  "DORA Art. 10(2)",
  "DORA Art. 10(3)",
  "DORA Art. 10(4)",
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
  "DORA Art. 11(11)",
  "DORA Art. 12(1)",
  "DORA Art. 12(2)",
  "DORA Art. 12(3)",
  "DORA Art. 12(4)",
  "DORA Art. 12(5)",
  "DORA Art. 12(6)",
  "DORA Art. 12(7)",
  "DORA Art. 13(1)",
  "DORA Art. 13(2)",
  "DORA Art. 13(3)",
  "DORA Art. 13(4)",
  "DORA Art. 13(5)",
  "DORA Art. 13(6)",
  "DORA Art. 13(7)",
  // RTS ICT Risk: Full framework (Arts 1-27) excluded for microenterprises.
  // They use simplified framework (Arts 28-41) instead.
  "RTS ICT Risk Art. 1",
  "RTS ICT Risk Art. 2",
  "RTS ICT Risk Art. 3",
  "RTS ICT Risk Art. 4",
  "RTS ICT Risk Art. 5",
  "RTS ICT Risk Art. 6",
  "RTS ICT Risk Art. 7",
  "RTS ICT Risk Art. 8",
  "RTS ICT Risk Art. 9",
  "RTS ICT Risk Art. 10",
  "RTS ICT Risk Art. 11",
  "RTS ICT Risk Art. 12",
  "RTS ICT Risk Art. 13",
  "RTS ICT Risk Art. 14",
  "RTS ICT Risk Art. 15",
  "RTS ICT Risk Art. 16",
  "RTS ICT Risk Art. 17",
  "RTS ICT Risk Art. 18",
  "RTS ICT Risk Art. 19",
  "RTS ICT Risk Art. 20",
  "RTS ICT Risk Art. 21",
  "RTS ICT Risk Art. 22",
  "RTS ICT Risk Art. 23",
  "RTS ICT Risk Art. 24",
  "RTS ICT Risk Art. 25",
  "RTS ICT Risk Art. 26",
  "RTS ICT Risk Art. 27",
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
