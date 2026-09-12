import IORedis from "ioredis";

// BullMQ exige maxRetriesPerRequest: null en la conexion que usan Queue y
// Worker (usan comandos bloqueantes internamente). Se comparte una sola
// conexion entre quien encola (la API) y quien procesa (el worker).
export const conexionRedis = new IORedis(
  process.env.REDIS_URL || "redis://127.0.0.1:6379",
  { maxRetriesPerRequest: null }
);
