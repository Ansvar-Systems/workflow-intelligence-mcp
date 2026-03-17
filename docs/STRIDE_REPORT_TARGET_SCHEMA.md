# STRIDE Report Target Schema

## Purpose

Define the canonical client-facing STRIDE threat report contract for the workflow backbone.

This spec is intentionally focused on core threat-model output quality:

- business risk first
- CVSS as secondary technical detail
- full evidence traceability
- visible badges and taxonomies
- architecture fidelity
- explicit assumptions and gaps

Regulatory crosswalks are out of scope for this document.

## Design Principles

1. The report must be driven from a canonical retained threat list.
2. Business risk is the primary prioritization signal.
3. CVSS is shown only with full vector and rationale.
4. Every architecture fact and threat claim must carry provenance.
5. Document-grounded facts, user attestations, assumptions, and pattern mappings must remain visibly separate.
6. Rollups must be computed from the same retained threat list shown to the user.

## Required Report Sections

1. Executive summary
2. Severity distribution and priority matrix
3. Scope, evidence basis, assumptions, and limitations
4. Architecture summary
5. Trust boundaries and component inventory
6. Detailed threat register
7. Remediation priorities
8. Attack paths
9. Verification test cases
10. Traceability appendix

## Badge Model

The report should expose these badge families:

- `STRIDE`: `S`, `T`, `R`, `I`, `D`, `E`
- `Business risk`: `Critical`, `High`, `Medium`, `Low`
- `Confidence`: `High confidence`, `Medium confidence`, `Low confidence`
- `Source type`: `Document-grounded`, `User-attested`, `Assumed`, `Pattern-mapped`
- `Reference`: `ATT&CK`, `CWE`, `CAPEC`, `ATLAS`, `D3FEND`, `OWASP LLM` when applicable
- `Component`: affected component badges
- `Trust zone`: zone badge on components
- `Threat level`: highest retained threat level on a component
- `Data type`: trust-boundary data-type badges

## Canonical Threat Record

Each retained threat must normalize to this shape:

```json
{
  "id": "T-001",
  "title": "Ledger entry tampering or unauthorized balance modification",
  "description": "Short threat statement suitable for a card header.",
  "strideCategories": ["T"],
  "severity": "critical",
  "businessRiskTier": "critical",
  "businessRiskLabel": "Critical",
  "businessImpact": "Direct compromise of transaction integrity and customer balances.",
  "businessImpactSeverity": "critical",
  "likelihood": "Likely",
  "likelihoodRationale": "Rationale tied to architecture and controls.",
  "priorityScore": 90,
  "impactIndex": 4,
  "likelihoodIndex": 3,
  "cvssScore": 9.0,
  "cvssVector": "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
  "cvssRationale": "Why this vector fits the documented architecture.",
  "affectedComponents": ["Transaction Ledger", "Transaction Processor"],
  "affectedFlows": ["F8"],
  "affectedTrustBoundaries": ["TB2"],
  "mitreIds": [],
  "cweIds": ["CWE-284", "CWE-345"],
  "capecIds": ["CAPEC-13"],
  "atlasIds": [],
  "d3fendIds": [],
  "owaspLlmIds": [],
  "existingControls": ["Managed identity", "WORM logging"],
  "recommendedControls": [
    "Append-only ledger semantics",
    "Cryptographic integrity verification"
  ],
  "residualRisk": "medium",
  "residualRiskRationale": "Residual view after recommended controls.",
  "attackPathRefs": ["AP-01"],
  "verificationTestRefs": ["TC-01"],
  "documentSources": [
    {
      "documentId": "uuid",
      "documentTitle": "FinPay360_Threat_Model_Benchmark.pdf",
      "page": 1,
      "section": "Technical Architecture",
      "citationIndex": 15
    }
  ],
  "provenance": {
    "sourceType": "document_grounded",
    "confidence": "medium",
    "documentGroundedFields": ["title", "affectedComponents"],
    "userAttestedFields": ["protocol"],
    "assumedFields": ["internal segmentation"],
    "patternMappedFields": ["capecIds", "mitreIds"]
  }
}
```

## Canonical Report-Level Data

The report-level contract should include:

```json
{
  "metadata": {
    "systemName": "FinPay360",
    "framework": "STRIDE",
    "reportVersion": "1.0",
    "generatedAt": "2026-03-11T07:25:33Z",
    "classification": "Confidential"
  },
  "scope": {
    "documentsReviewed": [],
    "assumptions": [],
    "limitations": [],
    "scopeReadiness": {
      "overallStatus": "partial",
      "proceedingMode": "proceed_with_assumptions"
    }
  },
  "architecture": {
    "components": [],
    "dataFlows": [],
    "trustBoundaries": [],
    "mermaidDfd": ""
  },
  "metrics": {
    "severityBreakdown": {
      "critical": 0,
      "high": 0,
      "medium": 0,
      "low": 0
    },
    "strideCounts": {
      "S": 0,
      "T": 0,
      "R": 0,
      "I": 0,
      "D": 0,
      "E": 0
    },
    "priorityMatrix": {
      "matrix": [[0, 0, 0, 0, 0]]
    }
  },
  "redFlags": [],
  "attackPaths": [],
  "verificationTests": [],
  "threats": [],
  "traceabilityMatrix": []
}
```

## Traceability Rules

1. Every architecture claim must have at least one source entry.
2. Every threat must show:
   - affected components
   - at least one evidence/provenance entry
   - source type
   - confidence
3. `document_grounded` means the report can point to a document citation.
4. `user_attested` means the user answered a clarification question.
5. `assumed` means the workflow proceeded without direct evidence.
6. `pattern_mapped` means the taxonomy link came from enrichment rather than source documents.
7. No rollup may count threats excluded from the retained threat list.

## Scoring Rules

1. `businessRiskTier` is the main severity shown in cards and summaries.
2. `severityBreakdown` must be computed from retained threats only.
3. `CVSS` is required only when:
   - `cvssScore`
   - `cvssVector`
   - `cvssRationale`
   are all present.
4. Flat distributions should be flagged when more than 80% of retained threats fall in one band.
5. If CVSS and business risk differ materially, both may be shown, but business risk governs ranking.

## FinPay360 Gap Analysis

This compares the March 11, 2026 FinPay360 example run against the target schema above.

### Already Good

- Scope extraction used the authorized FinPay360 document only.
- Blocking clarification questions were asked before STRIDE fan-out.
- Architecture extraction was materially correct for:
  - Azure SQL
  - Redis
  - Azure Key Vault
  - Fraud Detection Service
  - on-prem HSM enclave
  - transaction ledger
  - audit logging path
- Threats were retained only after filtering low-fit specialist output.
- The report includes inline evidence references and explicit assumptions.
- Trust boundaries, component inventory, and a Mermaid DFD are present.

### Present But Too Thin

- `Business risk`: severity exists, but there is no separate client-facing business-risk badge or business-risk label.
- `Likelihood`: the report implies likelihood through severity, but does not expose likelihood and rationale per threat.
- `Component badges`: components are listed as text, not as reusable badges in the threat register.
- `Confidence`: the report has overall narrative confidence, but no per-threat confidence badge.
- `Source type`: document-grounded vs user-attested vs assumed is explained in prose, but not normalized as explicit per-threat provenance badges.
- `Traceability`: evidence is listed in text blocks, but there is no structured traceability appendix or per-threat source matrix.
- `Trust boundary risk view`: boundaries are listed, but there is no boundary-pressure table with data-type badges and crossing risk.

### Missing

- Full `CVSS vector` for each threat
- `CVSS rationale`
- `Business impact` field separated from description
- `Likelihood rationale`
- `Existing controls`
- `Residual risk`
- `Residual risk rationale`
- `ATT&CK` badges in the report output
- `ATLAS` badges when the system contains an ML fraud component
- `D3FEND` defensive technique badges
- `Attack paths`
- `Verification test cases`
- `Red flags`
- `Traceability appendix`
- `Priority matrix`
- `STRIDE count chart`
- `Confidence badge` per threat
- `Source type badge` per threat

### Incorrect Or Unstable In Current Output

- Severity rollup drift occurred in the long-form report. The retained threat tables showed `1 Critical`, `29 High`, `1 Medium`, `0 Low`, but the report summary initially stated `1 Critical`, `23 High`, `1 Medium`, `0 Low`.
- The final corrected executive-summary turn fixed the counts, but this proves rollups are not yet computed from one canonical retained threat list.
- The current chat output still needs a correction pass for a clean client-facing summary, which is not acceptable as the default self-service behavior.

## Minimum Acceptable Client-Ready Output

Before calling the new report client-ready, it should at minimum include:

1. Business-risk badge on every threat
2. STRIDE badges on every threat
3. CVSS score and vector on every threat that shows CVSS
4. Business impact and likelihood blocks on every threat
5. ATT&CK and CWE badges when present
6. CAPEC and ATLAS badges when present
7. Affected-component badges
8. Structured provenance per threat
9. Trust-boundary table with risk and data types
10. Component inventory with threat-level badge
11. Priority matrix computed from retained threats
12. Traceability appendix

## Recommended Implementation Order

### Phase 1

- canonical retained threat schema in workflow state
- business-risk, confidence, and source-type fields
- rollups derived only from retained threats
- CVSS vector and rationale support
- badge-ready taxonomy fields in export output

### Phase 2

- component inventory threat-level badges
- trust-boundary pressure table
- per-threat provenance rendering
- traceability appendix
- priority matrix and STRIDE distribution

### Phase 3

- attack paths
- verification tests
- red flags
- residual risk and existing-controls presentation
- D3FEND and ATLAS enrichment in final report

## Acceptance Criteria

The report contract is ready when:

1. No summary count can diverge from the retained threat list.
2. Every retained threat shows provenance, badges, and business risk.
3. Every CVSS value shown has a full vector.
4. Every architecture claim can be traced to document evidence, user attestation, or explicit assumption.
5. The final report can stand on its own without requiring a corrective follow-up chat turn.
