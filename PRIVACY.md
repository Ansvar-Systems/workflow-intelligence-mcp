# Privacy Notice

## Data Processing

This MCP server is **stateless**. It does not:

- Store any data submitted by clients
- Log tool call inputs or outputs
- Send data to external services
- Maintain session state between requests

All processing happens in-memory during the tool call and is discarded immediately after the response is returned.

## Data Flow

```
Client (agent/portal) → MCP tool call → In-memory processing → Response → No persistence
```

The server reads only its own bundled task definitions (JSON files shipped with the package). It does not access external databases, APIs, or file systems at runtime.

## Contact

For privacy inquiries: **privacy@ansvar.eu**
