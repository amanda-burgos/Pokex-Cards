// Selecciona el proveedor de chat con CHAT_PROVIDER=claude|deepseek en el
// .env (default: claude). Cambiar de proveedor es solo cambiar esta variable
// y su API key correspondiente (ANTHROPIC_API_KEY o DEEPSEEK_API_KEY); el
// resto de la app (MCP, tools, rutas, frontend) no cambia.
const PROVEEDORES = {
  claude: () => import("./chatProviders/claude.js"),
  deepseek: () => import("./chatProviders/deepseek.js"),
};

function proveedorActual() {
  const nombre = (process.env.CHAT_PROVIDER || "claude").toLowerCase();
  if (!PROVEEDORES[nombre]) {
    throw new Error(
      `CHAT_PROVIDER="${nombre}" invalido, usa "claude" o "deepseek"`
    );
  }
  return nombre;
}

// El prompt le pide al modelo que no escriba el link de pago (ya se muestra
// como boton), pero algunos modelos lo pegan igual. Esto lo garantiza siempre,
// sin depender de que el LLM obedezca: si una tool devolvio una url y el
// modelo la repitio en su texto, se quita antes de mandarla al cliente.
function quitarUrlsDeTools(respuesta, eventos) {
  let texto = respuesta;
  for (const evento of eventos) {
    const url = evento.output?.url;
    if (url && texto.includes(url)) {
      texto = texto.split(url).join("");
    }
  }
  return texto.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function chat(args) {
  const nombre = proveedorActual();
  const proveedor = await PROVEEDORES[nombre]();
  const resultado = await proveedor.chat(args);
  return { ...resultado, respuesta: quitarUrlsDeTools(resultado.respuesta, resultado.eventos) };
}
