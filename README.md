# Workflow Intelligence MCP

Structured workflow definitions, domain intelligence, and quality gates for security engineering tasks — delivered as an MCP server.

Agents call this server to get task definitions (what to build), domain hints (how to guide users), and completion validators (when it's done). No prompt engineering drift — quality criteria are versioned JSON, not system prompts.

## Why This Exists

Building a data flow diagram in chat requires more than a blank canvas. The agent needs to know:
- **What fields to collect** (processes, data stores, external entities, data flows, trust boundaries)
- **What makes a DFD structurally valid** (every process has a flow, no orphan data stores, valid references)
- **When quality is sufficient** (descriptions detailed enough, trust boundaries placed correctly)
- **Which external tools help** (security-controls-mcp for boundary decisions, eu-regulations-mcp for data classification)

This MCP encodes all of that as machine-readable definitions, so any agent on any platform follows the same quality standard.

## Quick Start

### stdio (Claude Desktop / CLI)

```json
{
  "mcpServers": {
    "workflow-intelligence": {
      "command": "npx",
      "args": ["-y", "@ansvar/workflow-intelligence-mcp"]
    }
  }
}
```

### Programmatic

```typescript
import { spawn } from "child_process";

const proc = spawn("npx", ["tsx", "src/server.ts"], { stdio: ["pipe", "pipe", "inherit"] });
```

## Tools

| Tool | Layer | Description |
|------|-------|-------------|
| `about` | Meta | Server identity, version, capabilities |
| `list_sources` | Meta | Data sources backing definitions |
| `list_tasks` | Definition | Available tasks, filterable by category |
| `get_task_definition` | Definition | Full task definition: schema, criteria, rubrics, MCP tool manifest |
| `check_stage_completeness` | Validation | Validate stage state against completion criteria and quality rubrics |
| `suggest_trust_boundaries` | Domain | Deterministic heuristics for DFD trust boundary placement |

### Agent Loop

```
get_task_definition("dfd_construction")
  → collect fields via chat (processes, stores, entities, flows)
  → check_stage_completeness(stage_state)
  → if incomplete: fill gaps identified in `missing`
  → if complete_with_quality_warnings: nudge user on `warnings`
  → if complete: advance to next task or finish
```

### Three-Status Response Model

- **`incomplete`** — blocking issues (missing required fields, broken references, schema violations). Agent must collect more data.
- **`complete_with_quality_warnings`** — structurally valid but descriptions are thin or soft thresholds unmet. Agent should nudge but can proceed.
- **`complete`** — all criteria met. Agent can advance.

### Cross-MCP Tool Manifests

Task definitions declare which external MCP tools are relevant per stage:

```json
{
  "mcp_tools": [
    {
      "mcp": "security-controls-mcp",
      "tools": ["get_control", "search_controls"],
      "when": "trust_boundary_placement",
      "guidance": "Use to suggest security controls for trust boundary decisions"
    }
  ]
}
```

## Available Tasks

| Task ID | Category | Description |
|---------|----------|-------------|
| `dfd_construction` | threat_modeling | Data flow diagram construction with guided validation |

More tasks (STRIDE analysis, gap analysis, risk assessment) planned for Phase 2+.

## Development

```bash
npm install
npm test          # 42 tests
npm run build     # TypeScript compilation
```

## Architecture

```
src/
  definitions/tasks/     # JSON task definitions (the data)
  validation/
    engine.ts            # Rule registry + dispatch
    rules/               # Rule implementations (field-presence, referential-integrity, structural, quality-rubric)
  tools/                 # MCP tool handlers
  types/                 # TypeScript interfaces
  server.ts              # MCP server entry point (stdio)
```

The validation engine is generic — it reads rules from task definitions and dispatches to registered implementations. Adding a new task means adding a JSON definition and (if needed) new rule functions.

## License

[Business Source License 1.1](LICENSE.md) — free for internal use and evaluation. Production use in competing products requires a commercial license. Converts to Apache 2.0 after 4 years.

## Disclaimer

This server provides workflow structure and quality heuristics, not legal or security advice. Outputs are advisory — professional review is required for compliance and security decisions.

---

Built by [Ansvar Systems](https://ansvar.eu) | Part of the [Ansvar MCP Network](https://ansvar.ai/mcp)
