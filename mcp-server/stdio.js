// Punto de entrada standalone del MCP - PokeShop, para probar las tools con
// clientes MCP externos (Postman, MCP Inspector, Claude Desktop, etc).
// La app en si NO usa este proceso: el chat conecta al mismo servidor en
// memoria via src/mcpClient.js para compartir la conexion a entrenador.db.
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./createServer.js";

const server = createMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
