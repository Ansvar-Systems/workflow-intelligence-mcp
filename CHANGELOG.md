# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-03-05

### Added
- Initial release — Phase 1: DFD Construction task (standalone)
- 7 MCP tools: `about`, `list_sources`, `list_tasks`, `get_task_definition`, `check_stage_completeness`, `suggest_trust_boundaries`
- Validation engine with rule registry (field presence, referential integrity, structural rules, quality rubrics)
- Three-status response model: `incomplete` / `complete_with_quality_warnings` / `complete`
- Cross-MCP tool manifests for security-controls-mcp and eu-regulations-mcp
- Stage-state JSON Schema contracts for typed agent-portal payloads
- 42 tests across 7 test files
- 9 DFD test fixtures covering valid, invalid, and edge cases
