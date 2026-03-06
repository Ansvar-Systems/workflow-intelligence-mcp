# Coverage — Workflow Intelligence MCP

## What's Included

### Tasks

| Task ID | Category | Version | Status |
|---------|----------|---------|--------|
| `dfd_construction` | threat_modeling | 1.0 | Complete |
| `dora_gap_analysis` | compliance_gap_analysis | 1.0 | Complete |

### Validation Rules (DFD Construction)

| Rule | Severity | Description |
|------|----------|-------------|
| `schema_validation` | required | JSON Schema conformance |
| `every_process_has_at_least_one_flow` | required | No disconnected processes |
| `no_orphan_data_stores` | required | Every store connected to a process |
| `flow_references_valid` | required | All source/destination IDs exist |
| `boundary_references_valid` | required | All enclosed_ids in boundaries exist |
| `no_direct_external_to_datastore` | warning | External entities route through processes |
| `every_external_entity_crosses_boundary` | warning | Externals separated by trust boundaries |

### Validation Rules (DORA Gap Analysis)

| Rule | Severity | Description |
|------|----------|-------------|
| `all_provisions_assessed` | required | Every provision in every section must be assessed |
| `gaps_required_for_non_compliant` | required | Non-compliant and partially-compliant provisions must have gap descriptions |
| `evidence_required_for_compliant` | required | Compliant and partially-compliant provisions must have at least one evidence record |
| `exemption_basis_required` | required | Not-applicable provisions must cite a specific exemption basis |
| `assessor_metadata_present` | required | Assessed provisions must have assessor name and timestamp |
| `evidence_has_date` | warning | Evidence records should include review/approval dates |
| `gap_description_quality` | warning | Gap descriptions must be at least 10 words |
| `exemption_basis_quality` | warning | Exemption basis must be at least 5 words |
| `evidence_reference_quality` | warning | Evidence references must be at least 2 words |

### Quality Rubrics

| Element | Check | Threshold |
|---------|-------|-----------|
| Process description | min_words | 5 |
| Data store description | min_words | 3 |
| Data flow data_description | min_words | 2 |

### Domain Intelligence

| Tool | Heuristics |
|------|------------|
| `suggest_trust_boundaries` | network_boundary, data_tier_boundary, dmz_boundary |
| `generate_gap_summary` | regulatory_weight derivation, per-section compliance counts, remediation ranking |

### DORA Coverage

231 provisions across 5 pillars of Regulation (EU) 2022/2554 and all 10 implementing technical standards (8 RTS + 2 ITS):

| Pillar | Level 1 Sources | RTS/ITS Sources | Provisions |
|--------|----------------|-----------------|------------|
| Pillar 1: ICT Risk Management | DORA Arts 5-16 | RTS ICT Risk (41 arts) | 98 |
| Pillar 2: ICT Incident Reporting | DORA Arts 17-23 | RTS Incident Class (12), RTS Incident Reporting (6), ITS Incident Forms (8) | 39 |
| Pillar 3: Resilience Testing | DORA Arts 24-27 | RTS TLPT (15) | 35 |
| Pillar 4: Third-Party Risk | DORA Arts 28-44 | RTS ICT Services (10), RTS Critical Provider (6), RTS Oversight (6), RTS Oversight Fees (6), ITS Register (5) | 56 |
| Pillar 5: Information Sharing | DORA Art 45 | (none) | 3 |

Entity scoping applies proportionality rules: microenterprise exemptions (Article 16) exclude detailed provisions in Articles 6-13 and RTS ICT Risk Arts 1-27 (full framework), and TLPT provisions (DORA Articles 26-27 plus entire RTS TLPT) only apply to entities designated by their competent authority.

## What's NOT Included (Yet)

- STRIDE threat enumeration task
- Risk assessment tasks
- Compliance mapping workflows (non-DORA regulations)
- `assess_content_quality` (LLM-backed qualitative assessment — Phase 2)
- `get_prompting_guidance` (agent-specific prompt fragments — Phase 2)

## Limitations

- Quality rubrics are word-count based, not semantic. A 5-word description that says nothing useful will pass.
- Trust boundary suggestions use structural heuristics only. Application-specific boundaries (tenant isolation, microservice boundaries) require user input.
- No workflow composition yet — tasks are standalone. The STRIDE workflow (composing DFD + threat enumeration + mitigation) is Phase 2.
