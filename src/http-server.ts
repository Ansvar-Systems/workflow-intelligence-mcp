#!/usr/bin/env node
/**
 * Workflow Intelligence MCP Server (HTTP transport)
 *
 * Streamable HTTP transport for remote MCP clients.
 * Use server.ts for local stdio-based usage.
 */
import { createServer } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { TOOL_DEFINITIONS, TOOL_HANDLERS } from "./tools/index.js";

const PORT = parseInt(process.env.PORT || "3000", 10);

function createMcpServer(): Server {
  const srv = new Server(
    { name: "workflow-intelligence-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  srv.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  srv.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = TOOL_HANDLERS[name];
    if (!handler) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              error: "unknown_tool",
              message: `Tool '${name}' not found.`,
            }),
          },
        ],
        isError: true,
      } as Record<string, unknown>;
    }
    return handler(args ?? {}) as unknown as Record<string, unknown>;
  });

  return srv;
}

const sessions = new Map<string, StreamableHTTPServerTransport>();

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", server: "workflow-intelligence-mcp" }));
    return;
  }

  if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
    if (req.method === "POST") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          sessions.set(sid, transport);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };

      const server = createMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    if (req.method === "GET") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing or invalid session" }));
      return;
    }

    if (req.method === "DELETE") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }
      res.writeHead(204);
      res.end();
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Workflow Intelligence MCP listening on http://0.0.0.0:${PORT}/mcp`);
});
