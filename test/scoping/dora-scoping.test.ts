import { describe, it, expect } from "vitest";
import { applyDoraScoping } from "../../src/scoping/dora-scoping.js";

describe("applyDoraScoping", () => {
  it("returns all 5 pillars for a credit institution designated for TLPT", () => {
    const result = applyDoraScoping({
      entity_name: "Big Bank AG",
      entity_type: "credit_institution",
      is_microenterprise: false,
      designated_for_tlpt: true,
    });
    expect(result.applicable_sections).toHaveLength(5);
    expect(result.excluded_provisions).toHaveLength(0);
  });

  it("excludes TLPT advanced testing for non-designated entities", () => {
    const result = applyDoraScoping({
      entity_name: "Small Payment Co",
      entity_type: "payment_institution",
      is_microenterprise: false,
      designated_for_tlpt: false,
    });
    expect(result.applicable_sections).toContain("pillar_3_resilience_testing");
    expect(
      result.excluded_provisions.some(
        (e) => e.reason.includes("TLPT") || e.reason.includes("Article 26"),
      ),
    ).toBe(true);
  });

  it("applies simplified framework for microenterprises", () => {
    const result = applyDoraScoping({
      entity_name: "Tiny Fintech",
      entity_type: "e_money_institution",
      is_microenterprise: true,
      designated_for_tlpt: false,
    });
    expect(result.excluded_provisions.length).toBeGreaterThan(0);
    expect(
      result.excluded_provisions.some(
        (e) =>
          e.reason.includes("microenterprise") ||
          e.reason.includes("Article 16"),
      ),
    ).toBe(true);
  });

  it("returns scoping_summary with entity details", () => {
    const result = applyDoraScoping({
      entity_name: "Test Bank",
      entity_type: "credit_institution",
      is_microenterprise: false,
      designated_for_tlpt: true,
    });
    expect(result.scoping_summary).toContain("credit_institution");
    expect(result.scoping_summary).toContain("TLPT designated");
  });

  it("includes member_state in summary when provided", () => {
    const result = applyDoraScoping({
      entity_name: "Austrian Payments GmbH",
      entity_type: "payment_institution",
      is_microenterprise: false,
      designated_for_tlpt: false,
      member_state: "AT",
      competent_authority: "FMA",
    });
    expect(result.scoping_summary).toContain("AT");
    expect(result.scoping_summary).toContain("FMA");
  });

  it("combines microenterprise and TLPT exemptions", () => {
    const result = applyDoraScoping({
      entity_name: "Micro Crypto Ltd",
      entity_type: "crypto_asset_service_provider",
      is_microenterprise: true,
      designated_for_tlpt: false,
    });

    // TLPT exclusions include both Level 1 and RTS
    const tlptExclusions = result.excluded_provisions.filter(
      (e) =>
        e.provision_ref.startsWith("DORA Art. 26") ||
        e.provision_ref.startsWith("DORA Art. 27") ||
        e.provision_ref.startsWith("RTS TLPT"),
    );
    const microExclusions = result.excluded_provisions.filter((e) =>
      e.reason.includes("microenterprise"),
    );
    expect(tlptExclusions).toHaveLength(29);
    expect(microExclusions.length).toBeGreaterThan(0);
    // Micro exclusions include RTS ICT Risk full framework (Arts 1-27)
    const rtsIctRiskExclusions = microExclusions.filter((e) =>
      e.provision_ref.startsWith("RTS ICT Risk"),
    );
    expect(rtsIctRiskExclusions).toHaveLength(27);
  });

  it("does not exclude TLPT provisions when entity is designated", () => {
    const result = applyDoraScoping({
      entity_name: "Systemically Important Bank",
      entity_type: "credit_institution",
      is_microenterprise: false,
      designated_for_tlpt: true,
    });
    const tlptExclusions = result.excluded_provisions.filter(
      (e) =>
        e.provision_ref.startsWith("DORA Art. 26") ||
        e.provision_ref.startsWith("DORA Art. 27") ||
        e.provision_ref.startsWith("RTS TLPT"),
    );
    expect(tlptExclusions).toHaveLength(0);
  });

  it("does not exclude microenterprise provisions for non-micro entities", () => {
    const result = applyDoraScoping({
      entity_name: "Large Investment Firm",
      entity_type: "investment_firm",
      is_microenterprise: false,
      designated_for_tlpt: true,
    });
    const microExclusions = result.excluded_provisions.filter((e) =>
      e.reason.includes("microenterprise"),
    );
    expect(microExclusions).toHaveLength(0);
  });

  it("always returns exactly 5 pillar sections regardless of exemptions", () => {
    // Fully exempt case: micro + non-TLPT
    const result = applyDoraScoping({
      entity_name: "Tiny Fund",
      entity_type: "e_money_institution",
      is_microenterprise: true,
      designated_for_tlpt: false,
    });
    expect(result.applicable_sections).toHaveLength(5);

    // No exemptions case
    const result2 = applyDoraScoping({
      entity_name: "Big Fund",
      entity_type: "credit_institution",
      is_microenterprise: false,
      designated_for_tlpt: true,
    });
    expect(result2.applicable_sections).toHaveLength(5);
  });

  it("returns TLPT exclusions with correct provision references", () => {
    const result = applyDoraScoping({
      entity_name: "Test Entity",
      entity_type: "payment_institution",
      is_microenterprise: false,
      designated_for_tlpt: false,
    });
    // Level 1: DORA Arts 26(1)-26(11) and 27(1)-27(3) = 14
    const doraRefs = result.excluded_provisions
      .filter(
        (e) => e.provision_ref.startsWith("DORA Art. 26") || e.provision_ref.startsWith("DORA Art. 27"),
      )
      .map((e) => e.provision_ref);
    expect(doraRefs).toHaveLength(14);
    expect(doraRefs).toContain("DORA Art. 26(1)");
    expect(doraRefs).toContain("DORA Art. 26(11)");
    expect(doraRefs).toContain("DORA Art. 27(3)");

    // RTS TLPT: Arts 2-16 = 15 substantive articles
    const rtsRefs = result.excluded_provisions
      .filter((e) => e.provision_ref.startsWith("RTS TLPT"))
      .map((e) => e.provision_ref);
    expect(rtsRefs).toHaveLength(15);
    expect(rtsRefs).toContain("RTS TLPT Art. 2");
    expect(rtsRefs).toContain("RTS TLPT Art. 16");

    // Total TLPT exclusions = 29
    expect(doraRefs.length + rtsRefs.length).toBe(29);
  });

  it("scoping_summary reflects microenterprise status", () => {
    const result = applyDoraScoping({
      entity_name: "Micro Bank",
      entity_type: "credit_institution",
      is_microenterprise: true,
      designated_for_tlpt: false,
    });
    expect(result.scoping_summary).toContain("microenterprise");
  });
});
