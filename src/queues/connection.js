import IORedis from "ioredis";

// BullMQ exige maxRetriesPerRequest: null en la conexion que usan Queue y
// Worker (usan comandos bloqueantes internamente). Se comparte una sola
// conexion entre quien encola (la API) y quien procesa (el worker).
export const conexionRedis = new IORedis(
  process.env.REDIS_URL || "redis://127.0.0.1:6379",
  { maxRetriesPerRequest: null }
);

// Sin este listener, un error de conexion (ej. Redis todavia no existe o esta
// caido) tumba todo el proceso porque IORedis emite "error" sin nadie
// escuchando. Con esto el servidor sigue vivo; los emails simplemente se
// quedan sin encolar hasta que Redis vuelva a estar disponible.
conexionRedis.on("error", (err) => {
  console.error("[redis] Error de conexion:", err.message);
});
