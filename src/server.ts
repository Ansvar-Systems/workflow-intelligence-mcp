import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS, TOOL_HANDLERS } from "./tools/index.js";

const server = new Server(
  {
    name: "workflow-intelligence-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
