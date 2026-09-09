import Anthropic from "@anthropic-ai/sdk";
import { listarToolsMcp, llamarTool } from "../mcpClient.js";
import { SYSTEM_PROMPT, MAX_PASOS, MAX_TURNOS_HISTORIAL, extraerJsonDeContenidoMcp } from "../chatPrompt.js";

// Se crea de forma perezosa para que el servidor arranque aunque falte la key
// todavia; el error solo aparece si de verdad se usa el chat sin configurarla.
let anthropic;
function getCliente() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Falta ANTHROPIC_API_KEY en el .env para usar el chat con Claude");
    }
    anthropic = new Anthropic();
  }
  return anthropic;
}

const MODEL = process.env.CLAUDE_CHAT_MODEL || "claude-opus-5";

async function toolsParaClaude() {
  const tools = await listarToolsMcp();
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

function extraerTexto(content) {
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// Recorta el historial sin partir un turno a la mitad. En el formato de
// Claude un tool_result tambien va en un mensaje "user", asi que solo cuenta
// como inicio de turno un "user" cuyo content sea texto plano.
function recortarHistorial(mensajes, maxTurnos) {
  const iniciosDeTurno = mensajes
    .map((m, i) => (m.role === "user" && typeof m.content === "string" ? i : -1))
    .filter((i) => i !== -1);
  if (iniciosDeTurno.length <= maxTurnos) return mensajes;
  const corte = iniciosDeTurno[iniciosDeTurno.length - maxTurnos];
  return mensajes.slice(corte);
}

export async function chat({ usuarioId, mensajes }) {
  const tools = await toolsParaClaude();
  const messages = [...mensajes];
  const eventos = [];

  for (let paso = 0; paso < MAX_PASOS; paso++) {
    const response = await getCliente().messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      return {
        respuesta: extraerTexto(response.content),
        eventos,
        historial: recortarHistorial(messages, MAX_TURNOS_HISTORIAL),
      };
    }

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
    const toolResults = [];

    for (const bloque of toolUseBlocks) {
      const resultado = await llamarTool(bloque.name, bloque.input, usuarioId);
      const datos = extraerJsonDeContenidoMcp(resultado);

      eventos.push({ tool: bloque.name, input: bloque.input, output: datos });

      toolResults.push({
        type: "tool_result",
        tool_use_id: bloque.id,
        content: JSON.stringify(datos),
        is_error: resultado.isError === true,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return {
    respuesta: "Se alcanzo el limite de pasos para esta consulta, intenta reformularla.",
    eventos,
    historial: recortarHistorial(messages, MAX_TURNOS_HISTORIAL),
  };
}
