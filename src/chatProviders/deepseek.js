import OpenAI from "openai";
import { listarToolsMcp, llamarTool } from "../mcpClient.js";
import { SYSTEM_PROMPT, MAX_PASOS, MAX_TURNOS_HISTORIAL, extraerJsonDeContenidoMcp } from "../chatPrompt.js";

// DeepSeek expone una API compatible con OpenAI, por eso se usa el SDK de
// OpenAI apuntando a su base URL en vez de un cliente propio. Se crea de
// forma perezosa para que el servidor arranque aunque falte la key todavia;
// el error solo aparece si de verdad se usa el chat sin configurarla.
let deepseek;
function getCliente() {
  if (!deepseek) {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error("Falta DEEPSEEK_API_KEY en el .env para usar el chat con DeepSeek");
    }
    deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
  }
  return deepseek;
}

const MODEL = process.env.DEEPSEEK_CHAT_MODEL || "deepseek-chat";

async function toolsParaDeepSeek() {
  const tools = await listarToolsMcp();
  return tools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

// Recorta el historial sin partir un turno a la mitad (un mensaje "user" con
// texto plano siempre marca el inicio de un turno completo; los "tool" no).
function recortarHistorial(mensajes, maxTurnos) {
  const iniciosDeTurno = mensajes
    .map((m, i) => (m.role === "user" ? i : -1))
    .filter((i) => i !== -1);
  if (iniciosDeTurno.length <= maxTurnos) return mensajes;
  const corte = iniciosDeTurno[iniciosDeTurno.length - maxTurnos];
  return mensajes.slice(corte);
}

export async function chat({ usuarioId, mensajes }) {
  const tools = await toolsParaDeepSeek();
  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...mensajes];
  const eventos = [];

  for (let paso = 0; paso < MAX_PASOS; paso++) {
    const response = await getCliente().chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto",
    });

    const mensaje = response.choices[0].message;
    messages.push(mensaje);

    if (!mensaje.tool_calls || mensaje.tool_calls.length === 0) {
      return {
        respuesta: mensaje.content ?? "",
        eventos,
        historial: recortarHistorial(messages.slice(1), MAX_TURNOS_HISTORIAL),
      };
    }

    for (const llamada of mensaje.tool_calls) {
      let args = {};
      try {
        args = JSON.parse(llamada.function.arguments || "{}");
      } catch {
        // argumentos invalidos: se llama la tool igual sin args y que ella misma reporte el error
      }

      const resultado = await llamarTool(llamada.function.name, args, usuarioId);
      const datos = extraerJsonDeContenidoMcp(resultado);

      eventos.push({ tool: llamada.function.name, input: args, output: datos });

      messages.push({
        role: "tool",
        tool_call_id: llamada.id,
        content: JSON.stringify(datos),
      });
    }
  }

  return {
    respuesta: "Se alcanzo el limite de pasos para esta consulta, intenta reformularla.",
    eventos,
    historial: recortarHistorial(messages.slice(1), MAX_TURNOS_HISTORIAL),
  };
}
