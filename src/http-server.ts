#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createServer as createHttpServer,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { randomUUID } from "crypto";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS, TOOL_HANDLERS } from "./tools/index.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const SERVER_NAME = "workflow-intelligence-mcp";
const SERVER_VERSION = "1.0.0";

function createMCPServer(): Server {
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
              message: `Tool '${name}' not found. Available: ${Object.keys(TOOL_HANDLERS).join(", ")}`,
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
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createHttpServer(
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

      try {
        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }
        if (url.pathname === "/health" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "ok",
              server: SERVER_NAME,
              version: SERVER_VERSION,
            }),
          );
          return;
        }
        if (url.pathname !== "/mcp") {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error:
                "Not found. Use /mcp for MCP protocol or /health for health check.",
            }),
          );
          return;
        }

        if (req.method === "POST") {
          const sessionId = req.headers["mcp-session-id"] as string | undefined;
          let transport = sessionId ? sessions.get(sessionId) : undefined;
          if (!transport) {
            const newId = randomUUID();
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => newId,
            });
            sessions.set(newId, transport);
            const server = createMCPServer();
            await server.connect(transport);
            transport.onclose = () => {
              sessions.delete(newId);
            };
          }
          await transport.handleRequest(req, res);
          return;
        }

        if (req.method === "GET") {
          const sessionId = req.headers["mcp-session-id"] as string | undefined;
          const transport = sessionId ? sessions.get(sessionId) : undefined;
          if (!transport) {
            res.writeHead(400);
            res.end("No active session");
            return;
          }
          await transport.handleRequest(req, res);
          return;
        }

        if (req.method === "DELETE") {
          const sessionId = req.headers["mcp-session-id"] as string | undefined;
          const transport = sessionId ? sessions.get(sessionId) : undefined;
          if (transport) {
            await transport.handleRequest(req, res);
            sessions.delete(sessionId!);
          } else {
            res.writeHead(200);
            res.end();
          }
          return;
        }

        res.writeHead(405);
        res.end("Method not allowed");
      } catch (err) {
        console.error("Request error:", err);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end("Internal server error");
        }
      }
    },
  );

  httpServer.listen(PORT, () =>
    console.log(`${SERVER_NAME} HTTP server listening on port ${PORT}`),
  );
  process.on("SIGINT", () => {
    httpServer.close();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    httpServer.close();
    process.exit(0);
  });
}

main().catch(console.error);
