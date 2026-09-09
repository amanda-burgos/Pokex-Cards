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

export async function chat(args) {
  const nombre = proveedorActual();
  const proveedor = await PROVEEDORES[nombre]();
  return proveedor.chat(args);
}
