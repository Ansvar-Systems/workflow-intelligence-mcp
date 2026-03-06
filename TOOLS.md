# Tools Reference — Workflow Intelligence MCP

## about

Server identity and capabilities.

**Parameters:** None

**Returns:**
```json
{
  "name": "workflow-intelligence-mcp",
  "version": "0.1.0",
  "description": "Structured workflow definitions, domain intelligence, and quality gates for security engineering tasks",
  "capabilities": ["task_definitions", "stage_validation", "domain_intelligence"],
  "task_count": 1,
  "categories": ["threat_modeling"]
}
```

---

## list_sources

Data sources backing the workflow definitions.

**Parameters:** None

**Returns:** Array of source objects with `id`, `name`, `description`, `version`.

---

## list_tasks

List available tasks, optionally filtered by category.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | string | No | Filter by category (e.g., `threat_modeling`) |

**Returns:**
```json
{
  "tasks": [
    {
      "id": "dfd_construction",
      "name": "Data Flow Diagram Construction",
      "category": "threat_modeling",
      "version": "1.0",
      "standalone": true,
      "description": "Guided construction of a data flow diagram..."
    }
  ],
  "total": 1
}
```

---

## get_task_definition

Full task definition including schema, completion criteria, quality rubrics, MCP tool manifest, and prompting guidance.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `task_id` | string | Yes | Task identifier (e.g., `dfd_construction`) |

**Returns:** Complete task definition object. Key fields:

- `stage_state_schema` — JSON Schema for the stage state payload
- `completion_criteria` — required fields, structural rules, soft warnings
- `quality_rubric` — per-item quality checks (min_words, etc.)
- `mcp_tools` — cross-MCP tool manifest (which external tools to use per stage)
- `prompting_guidance` — agent conversation flow guidance
- `dependencies` — task dependency declarations

**Error:** `{ "error": "task_not_found" }` if task_id doesn't exist.

---

## check_stage_completeness

Validate a stage state against the task's completion criteria and quality rubrics.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `task_id` | string | Yes | Task identifier |
| `stage_id` | string | Yes | Stage identifier (often same as task_id for single-stage tasks) |
| `definition_version` | string | Yes | Version the agent is working against (e.g., `"1.0"`) |
| `stage_state` | object | Yes | The current state to validate |

**Returns:**
```json
{
  "status": "incomplete | complete_with_quality_warnings | complete",
  "missing": [
    { "field": "trust_boundaries", "rule": "min_count", "expected": 1, "actual": 0, "message": "At least one trust boundary is required" }
  ],
  "warnings": [
    { "field": "data_flows", "rule": "min_count", "expected": 3, "actual": 2, "message": "Most systems have more than 2 data flows..." }
  ],
  "quality_warnings": [
    { "item_id": "proc-001", "field": "description", "message": "Process 'API' has a vague description..." }
  ],
  "version_note": "optional — present when definition_version differs from current"
}
```

**Statuses:**
- `incomplete` — blocking issues in `missing`. Agent must collect more data.
- `complete_with_quality_warnings` — structurally valid, advisory items in `warnings` or `quality_warnings`.
- `complete` — all criteria met.

**Error:** `{ "error": "task_not_found" }` if task_id doesn't exist.

---

## suggest_trust_boundaries

Deterministic heuristics for DFD trust boundary placement. Analyzes existing elements and suggests boundaries the user may have missed.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `stage_state` | object | Yes | Current DFD state (processes, data_stores, external_entities, data_flows) |

**Returns:**
```json
{
  "suggestions": [
    {
      "id": "tb-suggested-001",
      "name": "Network Boundary",
      "rationale": "Separates untrusted external entities from internal processes",
      "enclosed_ids": ["ext-001", "ext-002"],
      "heuristic": "network_boundary"
    }
  ],
  "note": "These are heuristic suggestions. Review and adjust based on your system's actual trust model."
}
```

**Heuristics applied:**
1. **Network boundary** — groups untrusted external entities
2. **Data tier boundary** — groups data stores with confidential/restricted classification
3. **DMZ boundary** — identifies processes that sit between external entities and internal components

**Limitations:** Rule-based only. Cannot detect application-specific trust boundaries (e.g., microservice isolation, tenant separation). Agent should ask the user about domain-specific boundaries after presenting suggestions.
