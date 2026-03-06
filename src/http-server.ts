#!/usr/bin/env node

/**
 * Workflow Intelligence MCP Server (HTTP transport)
 *
 * Provides Streamable HTTP transport for Docker / remote MCP clients.
 * Use src/server.ts for local stdio-based usage.
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { TOOL_DEFINITIONS, TOOL_HANDLERS } from "./tools/index.js";

const SERVER_NAME = "workflow-intelligence-mcp";
const SERVER_VERSION = "1.0.0";
const PORT = parseInt(process.env.PORT || "3000", 10);

function createMcpServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
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

  return server;
}

async function main() {
  const sessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; server: Server }
  >();

  const httpServer = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || "/", `http://localhost:${PORT}`);

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, DELETE, OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, mcp-session-id",
      );
      res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // Health check
      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            server: SERVER_NAME,
            version: SERVER_VERSION,
            tools: TOOL_DEFINITIONS.length,
          }),
        );
        return;
      }

      // MCP endpoint
      if (url.pathname === "/mcp") {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        if (sessionId && sessions.has(sessionId)) {
          const session = sessions.get(sessionId)!;
          await session.transport.handleRequest(req, res);
        } else {
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
          });

          const mcpServer = createMcpServer();
          await mcpServer.connect(transport);

          transport.onclose = () => {
            if (transport.sessionId) {
              sessions.delete(transport.sessionId);
            }
          };

          await transport.handleRequest(req, res);

          if (transport.sessionId) {
            sessions.set(transport.sessionId, {
              transport,
              server: mcpServer,
            });
          }
        }
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    },
  );

  httpServer.listen(PORT, () => {
    console.error(
      `${SERVER_NAME} (HTTP) listening on port ${PORT}`,
    );
  });

  process.on("SIGTERM", () => {
    httpServer.close(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    httpServer.close(() => process.exit(0));
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
