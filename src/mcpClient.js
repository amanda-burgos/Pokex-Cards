import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../mcp-server/createServer.js";

// Campos que el modelo nunca debe rellenar: se inyectan del lado del servidor
// con el usuario autenticado de la sesion, para que el chat no pueda tocar
// datos de otro usuario aunque el modelo lo intente.
const CAMPOS_INTERNOS = ["usuarioId"];

let clientPromise;

function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const server = createMcpServer();
      const client = new Client({ name: "pokeshop-chat", version: "1.0.0" });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);
      return client;
    })();
  }
  return clientPromise;
}

// Lista las tools del MCP en un formato neutral (ni OpenAI ni Anthropic),
// sin exponer `usuarioId`. Cada proveedor en src/chatProviders/ la adapta a
// su propio formato de "tool calling".
export async function listarToolsMcp() {
  const client = await getClient();
  const { tools } = await client.listTools();

  return tools.map((tool) => {
    const schema = tool.inputSchema ?? { type: "object", properties: {} };
    const properties = { ...schema.properties };
    for (const campo of CAMPOS_INTERNOS) delete properties[campo];
    const required = (schema.required ?? []).filter((r) => !CAMPOS_INTERNOS.includes(r));

    return {
      name: tool.name,
      description: tool.description ?? "",
      parameters: { type: "object", properties, required },
    };
  });
}

export async function llamarTool(nombre, args, usuarioId) {
  const client = await getClient();
  return client.callTool({
    name: nombre,
    arguments: { ...args, usuarioId },
  });
}
