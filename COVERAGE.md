# Coverage — Workflow Intelligence MCP

## What's Included

### Tasks

| Task ID | Category | Version | Status |
|---------|----------|---------|--------|
| `dfd_construction` | threat_modeling | 1.0 | Complete |

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

## What's NOT Included (Yet)

- STRIDE threat enumeration task
- Gap analysis workflows
- Risk assessment tasks
- Compliance mapping workflows
- `assess_content_quality` (LLM-backed qualitative assessment — Phase 2)
- `get_prompting_guidance` (agent-specific prompt fragments — Phase 2)

## Limitations

- Quality rubrics are word-count based, not semantic. A 5-word description that says nothing useful will pass.
- Trust boundary suggestions use structural heuristics only. Application-specific boundaries (tenant isolation, microservice boundaries) require user input.
- No workflow composition yet — tasks are standalone. The STRIDE workflow (composing DFD + threat enumeration + mitigation) is Phase 2.
