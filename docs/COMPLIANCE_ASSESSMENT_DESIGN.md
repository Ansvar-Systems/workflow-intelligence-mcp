# Compliance Assessment Workflow — Design Document

## Overview

Universal compliance assessment engine implemented as task definitions in workflow-intelligence-mcp.
No platform changes. The chat agent drives the entire assessment through conversation, using
workflow-intelligence MCP for structure/validation and document-index + regulatory MCPs for content.

## Execution Model

This is a **chat workflow**, not a platform pipeline.

```
┌─────────────────────────────────────────────────────────────────┐
│  Chat Conversation (single agent, single session)              │
│                                                                 │
│  Agent: workflow-agent (or dedicated compliance-assessment)      │
│  MCP tools available:                                           │
│    - workflow-intelligence  (task definitions, stage gates)      │
│    - document-index         (uploaded evidence documents)        │
│    - security-controls      (ISO 27001, NIST, SOC 2)           │
│    - eu-regulations         (DORA, NIS2, GDPR, AI Act)         │
│    - automotive-cybersecurity (ISO 21434, UNECE R155)           │
│    - law MCPs via proxy     (jurisdiction-specific)             │
│                                                                 │
│  Flow:                                                          │
│    1. Agent calls wkfl_get_task_definition("compliance_assess") │
│    2. Agent drives through stages, accumulating state           │
│    3. Agent calls wkfl_check_stage_completeness at gates        │
│    4. Agent asks user questions when intake is needed            │
│    5. Agent calls regulatory MCPs to enumerate requirements     │
│    6. Agent calls document-index to find evidence               │
│    7. Matrix builds up in stage state across the conversation   │
│    8. Final state = complete compliance matrix                  │
└─────────────────────────────────────────────────────────────────┘
```

**What this is NOT:**
- NOT a platform workflow (no workflow_service steps, no step_runs, no Celery tasks)
- NOT multiple agents (no agent hand-offs, no from_step dependencies)
- NOT a batch job (interactive — user participates in scoping)

**What this IS:**
- A task definition JSON consumed by workflow-intelligence MCP
- A single agent conversation with structured gates
- Interactive where it matters, autonomous where it doesn't

## Why No Platform Changes

The platform workflow service is designed for headless multi-agent pipelines (STRIDE, TPRM).
That's heavy: database records, step_runs, Celery workers, agent hand-offs, report generators.

The compliance assessment doesn't need any of that. It needs:
- Structured conversation flow → workflow-intelligence task definition
- Quality gates → check_stage_completeness
- Regulatory data → existing MCP ecosystem
- Document evidence → document-index MCP
- User interaction → chat conversation (already works)
- Deliverable output → structured JSON in the final stage state (renderable by portal)

Everything already exists. We're adding a JSON file and validation rules.

## Architecture: Framework-Agnostic

The workflow is completely framework-agnostic. Nothing is hardcoded to any regulation
or requirement source.

### Requirement Sources (three input paths)

The Requirement Enumerator doesn't care WHERE requirements come from. It produces a
universal `requirement_register` regardless of source.

**1. MCP-sourced (public frameworks)**
- security-controls → ISO 27001, SOC 2, NIST CSF
- eu-regulations → DORA, NIS2, GDPR, AI Act
- automotive-cybersecurity → ISO 21434, UNECE R155
- law MCPs → jurisdiction-specific requirements
- Every new MCP = new assessment capability without touching workflow code

**2. Document-sourced (custom requirements)**
- Client uploads a requirements document (XLSX, CSV, DOCX) alongside evidence docs
- Scoper detects it's a requirements list (structured table with control IDs/descriptions)
- Agent indexes it via document-index, parses sections into requirement_register entries
- Use case: "Does our vendor's security docs meet our internal security policy?"

**3. Direct input (ad-hoc requirements)**
- Client provides requirements through chat or structured JSON
- Use case: quick checks, RFP response validation, custom checklists

### Why This Matters
The domain checkers don't know or care about the source. They get a slice of requirements
and a document bundle. Same logic regardless. This means the product surface includes:

- Public framework compliance (ISO 27001, DORA, NIS2, etc.)
- Internal policy compliance (company's own security requirements)
- Vendor assessment (does vendor documentation meet our requirements?)
- Contract compliance (do deliverables meet contractual obligations?)
- RFP validation (does a proposal address all stated requirements?)

This is not a compliance tool. It's a universal requirements-vs-evidence matching engine.

### Intake questions
Generated dynamically from framework applicability criteria for MCP-sourced requirements.
For document-sourced requirements, the Scoper asks about the requirements document structure
and any applicability filters the client wants to apply.

## Task Definition Structure

One task definition with a single evolving state that grows through phases.
The stage_state_schema contains all fields; completion_criteria gates progression.

### Phases (within single task)

The agent drives through these sequentially. The prompting_guidance tells it the order.
check_stage_completeness knows which phase the state is in based on which fields are populated.

#### Phase 1: Scoping & Document Intake

Agent actions:
- Index uploaded documents via document-index MCP (index_document)
- Get document overview, assess quality (boilerplate vs operational language)
- Build org_profile from document content + user input
- Identify applicable frameworks from document content
- Generate batched intake questions (load-bearing only)
- Present questions to user in single round
- Record user responses as intake_responses (evidence trail)

State fields populated:
```
org_profile: { type, sector, jurisdiction, deployment_model, ... }
documents: [{ doc_id, filename, sections_count, quality_signal }]
applicable_frameworks: ["iso27001", "nis2", ...]
excluded_frameworks: ["unece_r155"]  // with reason
intake_questions: [{ id, question, reason, ... }]
intake_responses: [{ question_id, response, timestamp }]
document_quality: { overall_signal, boilerplate_detected, specificity_score }
```

Completion gate: org_profile present, at least 1 document indexed, at least 1 framework selected,
all intake questions answered.

#### Phase 2: Requirement Enumeration

Agent actions:
- For each applicable framework, call the relevant regulatory MCP
  - security-controls: get_framework_controls (returns full control list)
  - eu-regulations: get_article (iterate through articles)
  - etc.
- Apply N/A exclusions from intake responses
- Build complete requirement register with stable IDs
- Group requirements into domain slices (~15-20 each) for systematic processing

State fields populated:
```
requirement_register: [{
  req_id: "ISO27001-A.9.2.3",
  framework: "iso27001",
  framework_version: "2022",
  text: "Management of privileged access rights",
  source_mcp: "security-controls",
  domain_group: "access_control",
  applicable: true | false,
  applicability_reason: "N/A per client attestation: no physical DCs"
}]
domain_groups: [{ group_id, name, requirement_ids, count }]
enumeration_metadata: {
  frameworks_queried: [...],
  total_requirements: 93,
  applicable_requirements: 87,
  excluded_count: 6,
  framework_versions: { "iso27001": "2022", "nis2": "2022/2555" }
}
```

Completion gate: at least 1 framework enumerated, all applicable requirements have req_id and text,
domain groups formed.

#### Phase 3: Evidence Assessment

Agent actions:
- Work through domain_groups sequentially
- For each requirement in a group:
  - Search document-index with multiple query variations (synonyms, abbreviations)
  - If match found: retrieve full section + surrounding sections for context
  - Extract verbatim quote from matching section
  - Determine verdict: compliant / partial / not_found / contradicted / not_applicable
  - Assign confidence: high / medium / low
  - If low confidence: flag as requires_human_review
- Build matrix rows progressively

State fields populated:
```
compliance_matrix: [{
  req_id: "ISO27001-A.9.2.3",
  requirement_text: "Management of privileged access rights",
  framework: "iso27001",
  verdict: "partial",
  confidence: "high",
  evidence_refs: [{ doc_id, section_ref, page_start, page_end, filename }],
  verbatim_quote: "Privileged access is granted by the IT Security Manager...",
  evidence_summary: "Section 4.3 defines privileged access policy but lacks periodic review cycle",
  gap_description: "No evidence of periodic review of privileged access rights",
  requires_human_review: false,
  search_queries_used: ["privileged access", "admin rights review", "elevated permissions"]
}]
assessment_progress: {
  groups_completed: 4,
  groups_total: 6,
  requirements_assessed: 62,
  requirements_total: 87
}
```

Completion gate: every applicable requirement has a matrix row with verdict.
Structural rule: no requirement in requirement_register (where applicable=true) without
a corresponding compliance_matrix entry.

#### Phase 4: Coverage Validation & Report

Agent actions:
- Verify every applicable requirement has a matrix row (structural check)
- Calculate coverage statistics
- Identify requirements marked requires_human_review
- Optionally surface ambiguous findings to user for final clarification
- Generate scope_and_methodology section (standardized)
- Produce final structured output

State fields populated:
```
coverage_stats: {
  total_requirements: 87,
  compliant: 64,
  partial: 11,
  not_found: 8,
  contradicted: 1,
  not_applicable: 6,
  requires_human_review: 3,
  coverage_percentage: 100.0  // every req has a row
}
scope_and_methodology: {
  assessment_date: "2026-03-07",
  frameworks_assessed: [{ name, version, source_mcp }],
  documents_analyzed: [{ filename, doc_id, sections_count, quality_signal }],
  methodology: "Exhaustive requirement enumeration with systematic evidence correlation",
  limitations: [
    "This assessment evaluates documented controls only. Operational effectiveness requires audit.",
    "Evidence matching is keyword-based; semantically equivalent but differently-worded controls may be missed."
  ],
  client_attestations: [
    { question: "Confirm no physical data centers?", response: "Confirmed, fully cloud-hosted", impact: "A.11.1 physical controls marked N/A" }
  ]
}
report_ready: true
```

Completion gate: coverage_stats present, scope_and_methodology present, report_ready = true.

## State Storage (wkfl_store_state / wkfl_load_state)

### Why This is in v1

State storage is foundational, not optional. Three scenarios require it:
1. **Multi-framework assessments** (200+ requirements) exceed context window
2. **Custom requirements** (document-sourced) can be arbitrarily large
3. **Session resume** after timeout/disconnect — falls out of the architecture naturally

Without state storage, the assessment is limited to what fits in a single context window.
With it, there's no upper bound on assessment size.

### Design: JSON Files on Disk (zero new dependencies)

The MCP already reads JSON from disk for task definitions. State storage is the same pattern.

```
data/assessments/
  {assessment_id}/
    _meta.json                    ← created_at, status, framework(s), last_updated
    phase_1_scoping.json          ← org profile, document inventory, intake responses
    phase_2_requirements.json     ← full requirement register + domain groups
    group_access_control.json     ← completed matrix rows for this domain group
    group_cryptography.json       ← completed matrix rows for this domain group
    group_incident_mgmt.json      ← ...
    phase_4_coverage.json         ← coverage stats, scope & methodology
```

### Tools (4 new)

```
wkfl_store_state(assessment_id, key, data)
  → writes data/assessments/{assessment_id}/{key}.json
  → creates assessment directory if needed
  → updates _meta.json last_updated timestamp

wkfl_load_state(assessment_id, key)
  → reads data/assessments/{assessment_id}/{key}.json
  → returns { data, stored_at }

wkfl_list_states(assessment_id)
  → lists all keys for an assessment
  → returns [{ key, stored_at, size_bytes }]
  → enables resume: agent sees which groups are done, picks up where it left off

wkfl_delete_assessment(assessment_id)
  → deletes entire assessment directory
  → cleanup after delivery or TTL expiry
```

### Context Window Strategy

With state storage, the agent's context strategy changes:

**Phase 3 (Evidence Assessment) — the expensive phase:**
1. Agent loads the requirement register from state (or carries it from Phase 2)
2. For each domain group:
   a. Work through ~15-20 requirements, building matrix rows
   b. Call wkfl_store_state to persist the completed group
   c. Drop the group's matrix rows from working memory
3. Agent only carries: current group's requirements + current search results
4. Context per turn: ~15K tokens (manageable in any model)

**Phase 4 (Validation):**
1. Agent calls wkfl_list_states to see all completed groups
2. Loads each group's matrix rows via wkfl_load_state
3. Runs coverage check, produces stats
4. Can process groups sequentially — doesn't need all in memory simultaneously

### Session Resume

If a conversation times out at group 4 of 6:
1. New conversation starts
2. Agent calls wkfl_list_states("assessment-abc")
3. Sees: phase_1, phase_2, group_access_control, group_cryptography, group_network, group_physical (4 complete)
4. Loads phase_2 requirements to identify remaining groups
5. Continues from group 5

No work is lost. This is a significant UX improvement that falls out naturally.

### Stale State Cleanup

- _meta.json tracks last_updated timestamp
- Cleanup options: TTL-based cron (delete assessments older than 30 days),
  explicit wkfl_delete_assessment after delivery, or manual
- v1: manual cleanup is fine. Automated cleanup is a v2 nicety.

### Implementation: ~1 day

```
New files:
  src/state/store.ts           ← read/write/list/delete JSON files
  src/tools/state.ts           ← 4 tool handlers
  test/tools/state.test.ts     ← tests

Modified files:
  src/tools/index.ts           ← register 4 new tools + definitions
```

No new dependencies. Pure Node.js fs operations.

---

## Structural Validation Rules (new)

These are registered in the validation engine alongside the existing DFD rules.

| Rule ID | Severity | Description |
|---------|----------|-------------|
| every_requirement_has_verdict | required | Every applicable req in register has a matrix entry |
| every_compliant_has_evidence | required | Verdict "compliant" must have at least 1 evidence_ref |
| every_partial_has_gap | required | Verdict "partial" must have gap_description |
| no_high_confidence_without_quote | warning | High confidence verdicts should have verbatim_quote |
| intake_responses_complete | required | Every intake_question has a corresponding response |
| framework_version_recorded | required | Every framework in enumeration_metadata has a version |

## MCP Tool Manifest

```json
{
  "mcp_tools": [
    {
      "mcp": "document-index-mcp",
      "tools": ["index_document", "search_document", "get_section", "get_document_overview", "get_surrounding_sections"],
      "when": "phase_1_intake, phase_3_evidence",
      "guidance": "Index all uploaded documents in Phase 1. In Phase 3, search with multiple query variations per requirement. Use get_surrounding_sections when a match needs context from adjacent sections."
    },
    {
      "mcp": "security-controls-mcp",
      "tools": ["get_framework_controls", "get_control", "search_controls"],
      "when": "phase_2_enumeration",
      "guidance": "Use get_framework_controls to enumerate complete control lists. Use get_control for individual control details when building matrix rows."
    },
    {
      "mcp": "eu-regulations-mcp",
      "tools": ["get_article", "search_regulations", "get_definitions", "check_applicability"],
      "when": "phase_2_enumeration, phase_1_scoping",
      "guidance": "Use check_applicability during scoping to determine which EU regulations apply. Use get_article to enumerate requirements during Phase 2."
    },
    {
      "mcp": "automotive-cybersecurity-mcp",
      "tools": ["search_requirements", "get_requirement", "list_work_products", "export_compliance_matrix"],
      "when": "phase_2_enumeration",
      "guidance": "Use search_requirements and get_requirement for ISO 21434 / UNECE R155 enumeration."
    }
  ]
}
```

## Question Discipline

### Heuristic
**If the agent would reach the same verdict regardless of the answer, don't ask.**

### Rules
- Every question must be load-bearing: changes scope, unlocks evidence, or resolves ambiguity
- "Nice to know" questions that don't materially affect the matrix get cut
- Questions are batched — presented as a group in Phase 1, not trickled out
- Maximum ~5 intake questions per framework (more = fatigue)
- Mid-flow clarification (Phase 3) only when verdict would differ based on answer
  - For v1: prefer marking "requires_human_review" over interrupting

### Question Categories (generated dynamically from framework)
- **Applicability**: "Do you operate physical data centers?" → affects A.11 scope
- **Bundle completeness**: "I see an InfoSec Policy. For full coverage I'd also expect an IR Plan. Do you have one?"
- **Org profile**: "Are you an essential entity under NIS2?" → affects which articles apply
- **Document quality**: "Several sections appear to be template boilerplate. Proceed with assessment?"

## Prompting Guidance (for agent system prompt)

```
You are conducting a structured compliance assessment. Follow the workflow-intelligence
task definition strictly.

PHASE 1 - SCOPING:
- Index all uploaded documents using document-index MCP
- Assess document quality: look for specific operational language vs template boilerplate
- Identify applicable frameworks from document content and user context
- Generate intake questions — ONLY ask questions where the answer changes the assessment outcome
- Present all questions in a single batch, wait for responses
- Record every user response — these become part of the evidence trail

PHASE 2 - ENUMERATION:
- For each applicable framework, fetch the COMPLETE requirement list from the relevant MCP
- Do not skip requirements. Do not sample. Enumerate exhaustively.
- Apply N/A exclusions from intake responses with explicit reasoning
- Group into domain slices of 15-20 requirements for systematic processing

PHASE 3 - EVIDENCE ASSESSMENT:
- Work through each domain group systematically
- For each requirement, search document-index with at least 3 query variations:
  1. Direct terminology from the requirement text
  2. Common synonyms/abbreviations
  3. Operational language (what an implementation would say vs what the standard says)
- When evidence is found, retrieve full section + surrounding sections for context
- Extract a verbatim quote that supports or contradicts the requirement
- Assign verdict honestly. When uncertain, mark requires_human_review rather than guessing.
- Do NOT default confidence to "high" — calibrate based on evidence quality

PHASE 4 - VALIDATION:
- Verify every applicable requirement has a matrix row
- Surface any requires_human_review items to the user for final input
- Generate scope and methodology section
- Every claim in the matrix must trace back to a document section_ref
```

## Design Review Findings

Review conducted 2026-03-07. Three blocking prerequisites, three type system extensions,
and one content task identified.

### Blocking Prerequisites

#### B1. Document-Index MCP Catalog is Broken (Low risk, mechanical fix)
Platform tool catalog (`mcp_tool_catalog.py`) has wrong tool names for document-index:
- Catalog: `search_documents` → Actual: `search_document`
- Catalog: `get_document_chunk` → Actual: `get_section`
- Catalog: `get_document_summary` → Actual: `get_document_overview`
- REST routes in `tool_handler.py` mirror the wrong names
- Missing tools: `index_document`, `get_surrounding_sections`
- **Impact**: No agent can currently use document-index through the platform at all
- **Fix**: Update `_DOCUMENT_INDEX` in catalog + `_REST_API_ROUTES` in tool_handler.py

#### B2. File-to-Index Bridge Doesn't Exist (Medium risk, design decision)
`index_document` expects file path (STDIO) or base64 (HTTP). The agent has neither —
files come through portal upload → file_service. No mechanism routes uploaded files to
document-index for indexing.

**Design decision required before building** — not just plumbing:
- Auto-index on upload? What if a document shouldn't be indexed? What about re-indexing
  on document replacement?
- Explicit trigger model is safer: agent calls a bridge endpoint with file_id, which
  retrieves from file_service and forwards to document-index
- The trigger decision affects UX: does the agent ask "shall I index this document?"
  or does it happen automatically?

#### B3. Context Window Overflow (RESOLVED — state storage in v1)
Token accumulation estimate for 200-requirement assessment:
- requirement_register: ~30,000 tokens
- compliance_matrix (growing): ~40,000 tokens
- Search results across conversation: ~300,000 tokens
- Section retrievals: ~120,000 tokens
- Total: ~525,000 tokens — 4x the 128K context window

**Resolved**: wkfl_store_state / wkfl_load_state pulled into v1 implementation.
See "State Storage" section above for full design. ~1 day additional effort.
Enables multi-framework assessments, custom requirements of any size, and session resume.

### Type System Extensions

#### T1. FieldRule Only Supports `min_count`
Phase gates need `"exists"` (org_profile is present) and `"equals"` (report_ready = true).
Current FieldRule type: `rule: "min_count"`. Need to extend to union:
`rule: "min_count" | "exists" | "equals"`.
Small change, backward-compatible.

#### T2. Single completion_criteria Can't Express 4 Phases
Current TaskDefinition has one `completion_criteria` and one `prompting_guidance` string.
The compliance assessment needs per-phase criteria and per-phase guidance.

**Recommended approach**: Optional `phases` array on TaskDefinition:
```typescript
phases?: {
  id: string;
  name: string;
  completion_criteria: CompletionCriteria;
  prompting_guidance: string;
}[];
```
Single-phase tasks (DFD) keep using flat fields. Multi-phase tasks use `phases[]`.
Engine detects current phase by finding first phase whose criteria aren't met.

**Caution**: This becomes load-bearing across all future task definitions. Get the
abstraction right before shipping. Key question: is linear phase progression always
correct, or will future tasks need branching/conditional phases? For v1, linear is
sufficient — but name the field carefully.

#### T3. additionalProperties Breaks Partial State
JSON Schema validation (Ajv) runs before structural rules. With `additionalProperties: false`,
partial state (Phase 1 without Phase 3 fields) fails schema validation.

**Fix**: Define all Phase 2-4 fields as optional in schema. Use structural rules
(not JSON Schema) to enforce phase-specific requirements. Do NOT use
`additionalProperties: false` on the top-level object.

### Content Task

#### C1. ISO 27001 Intake Question Set (Blocks Phase 2)
The Scoper needs an actual question set for ISO 27001. This is content/product work,
not code. Someone must write the questions before the agent prompt can be finalized.

For ISO 27001, the bounded set is approximately:
- Deployment model: cloud-only / on-prem / hybrid? (affects A.11 physical security)
- Organization size / employee count? (affects A.7 HR security scope)
- Third-party processing of data? (affects A.15 supplier relationships)
- Regulated data types: PII, PHI, PCI? (affects A.18 compliance scope)
- Geographic scope / jurisdictions? (affects which law MCPs to reference)
- Document bundle completeness: which policy documents are being submitted?

These questions are generated dynamically in the long term (Scoper derives from framework
applicability criteria). For v1 with ISO 27001, a curated question set is faster and
more reliable than dynamic generation.

### EU Regulations MCP Catalog (Non-blocking but needed)
Catalog `_EU_REGULATIONS_CORE` has 5 of 12 actual tools. Missing: `check_applicability`,
`map_controls`, `get_evidence_requirements`, `compare_requirements`, `diff_article`,
`get_article_history`, `get_recent_changes`. Not blocking for ISO 27001 v1 (uses
security-controls MCP), but needed for DORA/NIS2/GDPR assessments.

---

## Implementation Plan

### v1 Scope: ISO 27001 + state storage, single document bundle, happy path

```
Phase 0 — Prerequisites (do first, unblocks everything)
├── 0a. Fix document-index catalog + REST routes        [mechanical, ~2hr]
│       mcp_tool_catalog.py: update _DOCUMENT_INDEX
│       tool_handler.py: update _REST_API_ROUTES
├── 0b. Design file-to-index trigger model              [design decision]
│       Decision: explicit agent trigger via file_id
│       Build bridge endpoint in file_service or agent_service
│       Agent calls bridge with file_id → bridge calls document-index POST /index
│       Consider: what if doc shouldn't be indexed? Re-index on replacement?
├── 0c. Write ISO 27001 intake question set             [content/product task]
│       ~6 load-bearing questions for Scoper phase
│       Curated for v1, dynamic generation deferred to v2

Phase 1 — Infrastructure (~2-3 days)
├── 1a. State storage: src/state/store.ts               [~1 day]
│       JSON files on disk, keyed by assessment_id
│       4 tools: store_state, load_state, list_states, delete_assessment
│       Register in tools/index.ts
│       Tests
├── 1b. Extend FieldRule: "exists" + "equals" rules     [task.ts, field-presence.ts]
├── 1c. Add optional phases[] to TaskDefinition          [task.ts]
│       Design the abstraction carefully — linear for v1
│       Engine: detect current phase, evaluate phase-specific criteria
│       Caution: this becomes load-bearing across all future tasks
├── 1d. Update evaluateCompleteness for phase-aware eval [engine.ts]
├── 1e. Tests for all type system changes

Phase 2 — Compliance Assessment Task (~2-3 days)
├── 2a. compliance-assessment.json task definition
│       stage_state_schema (all fields, Phase 2+ optional)
│       4 phases with per-phase completion_criteria
│       quality_rubric for matrix entries
│       mcp_tools manifest
│       prompting_guidance per phase (including state storage instructions)
├── 2b. compliance-matrix.ts structural validation rules
│       6 rules: every_requirement_has_verdict, every_compliant_has_evidence,
│       every_partial_has_gap, no_high_confidence_without_quote,
│       intake_responses_complete, framework_version_recorded
├── 2c. Register task + rules in loader and engine
├── 2d. Tests: task validation, rule correctness, phase transitions

Phase 3 — Agent Wiring (~1 day)
├── 3a. Add compliance-assessment agent to agent_wiring.yaml
│       MCPs: workflow-intelligence, document-index, security-controls
│       System prompt: compliance assessment focus
├── 3b. Seed agent via seed_chat_agents.py
├── 3c. Verify tool count stays under 128

Phase 4 — Validate (~1 day)
├── 4a. End-to-end test: upload ISO 27001 policy doc
├── 4b. Verify: document indexed, requirements enumerated, matrix produced
├── 4c. Verify: state storage works (groups persisted and reloaded)
├── 4d. Verify: intake questions batched, citations trace to sections
├── 4e. Verify: coverage validator catches completeness
├── 4f. Review matrix quality — are verdicts defensible?
└── 4g. Test session resume (interrupt mid-assessment, resume in new conversation)
```

### v2 (after v1 validated)
- EU regulations catalog update for DORA/NIS2/GDPR assessments
- Dynamic intake question generation from MCP applicability criteria
- Custom requirements from uploaded documents (XLSX/CSV/DOCX)
- Custom requirements from direct input (chat/JSON)
- Portal matrix renderer component
- Additional framework support (DORA, NIS2, SOC 2, NIST CSF)
- PDF/Excel export
- Automated stale state cleanup (TTL-based)

## Files to Create/Modify

### New files (in workflow-intelligence-mcp)
1. `src/state/store.ts` — state storage (read/write/list/delete JSON files)
2. `src/tools/state.ts` — 4 state tool handlers
3. `src/definitions/tasks/compliance-assessment.json` — task definition
4. `src/validation/rules/compliance-matrix.ts` — structural validation rules
5. `test/tools/state.test.ts` — state storage tests
6. `test/tools/compliance-assessment.test.ts` — task validation tests
7. `test/validation/compliance-matrix.test.ts` — rule tests

### Modified files (in workflow-intelligence-mcp)
1. `src/types/task.ts` — FieldRule union, optional phases[] on TaskDefinition
2. `src/validation/rules/field-presence.ts` — handle "exists" and "equals" rules
3. `src/validation/engine.ts` — phase-aware evaluation, register new rules
4. `src/tools/index.ts` — register state tools + compliance task
5. `src/tools/get-task-definition.ts` — add to knownTasks array

### Platform fixes (in Ansvar_platform — prerequisites only)
1. `services/agent_service/app/services/tools/mcp_tool_catalog.py` — fix _DOCUMENT_INDEX
2. `services/agent_service/app/services/tools/tool_handler.py` — fix REST routes
3. `services/agent_service/config/agent_wiring.yaml` — add compliance-assessment agent
4. File-to-index bridge (location TBD based on design decision in 0b)

### No changes needed
- Platform workflow_service — not involved
- Platform agent_service execution code — no new logic
- Database migrations — no schema changes
- Docker compose — no new containers (workflow-intelligence-mcp already deployed)
- Report generators — matrix is the deliverable (structured JSON from chat)

## Deliverable Format

The compliance matrix lives in state storage and is assembled in Phase 4.
The portal can render it from the chat response, or we add a lightweight matrix renderer.

```json
{
  "assessment": {
    "assessment_id": "assess-abc-123",
    "scope_and_methodology": { ... },
    "coverage_stats": { ... },
    "compliance_matrix": [ ... ],
    "client_attestations": [ ... ]
  }
}
```

Future: PDF export, Excel matrix export. But v1 = structured JSON rendered in portal.

## Cost & Time Estimates

With state storage, assessments of any size are feasible. Cost is driven by:
- Input tokens: requirement texts + document sections retrieved from search
- Output tokens: matrix rows + evidence summaries
- State storage eliminates context window as a constraint

| Scenario | Requirements | Estimated Turns | Token Cost | Wall Clock |
|----------|-------------|-----------------|------------|------------|
| ISO 27001 Annex A | ~93 controls | ~15-20 | $3-6 | 8-12 min |
| NIS2 only | ~40 articles | ~10-12 | $2-4 | 5-8 min |
| ISO 27001 + DORA + NIS2 | ~200 requirements | ~30-40 | $8-15 | 15-25 min |
| Full multi-framework | ~400 requirements | ~50-60 | $15-25 | 25-40 min |
| Custom requirements (large) | ~500+ requirements | ~60-80 | $20-35 | 30-50 min |

### Implementation effort estimate
| Phase | Effort |
|-------|--------|
| Phase 0 (prerequisites) | 1-2 days |
| Phase 1 (state storage + type system) | 2-3 days |
| Phase 2 (task definition + rules) | 2-3 days |
| Phase 3 (agent wiring) | 0.5 day |
| Phase 4 (validation) | 1 day |
| **Total v1** | **~7-10 days** |
