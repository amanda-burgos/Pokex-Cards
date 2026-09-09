import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tools } from "./tools.js";

export function createMcpServer() {
  const server = new McpServer({ name: "pokeshop-mcp", version: "1.0.0" });

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema },
      async (args) => {
        try {
          return await tool.handler(args);
        } catch (err) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}
