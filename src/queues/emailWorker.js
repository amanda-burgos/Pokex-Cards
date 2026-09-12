import { Worker } from "bullmq";
import { conexionRedis } from "./connection.js";
import { NOMBRE_COLA_EMAILS } from "./emailQueue.js";
import { enviarEmailPagoConfirmado } from "../email.js";

// Un handler por cada "name" de job que se pueda encolar en emailQueue.js.
const HANDLERS = {
  "pago-confirmado": (data) => enviarEmailPagoConfirmado(data),
};

export const emailWorker = new Worker(
  NOMBRE_COLA_EMAILS,
  async (job) => {
    const handler = HANDLERS[job.name];
    if (!handler) throw new Error(`No hay handler para el job de email "${job.name}"`);
    await handler(job.data);
  },
  { connection: conexionRedis }
);

emailWorker.on("completed", (job) => {
  console.log(`[email-worker] "${job.name}" (job ${job.id}) enviado`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`[email-worker] "${job?.name}" (job ${job?.id}) fallo:`, err.message);
});
