import { Queue } from "bullmq";
import { conexionRedis } from "./connection.js";

// Toda la app debe delegar el envio de emails a esta cola: nadie llama a
// src/email.js directamente salvo el worker (src/queues/emailWorker.js).
export const NOMBRE_COLA_EMAILS = "emails";

export const colaEmails = new Queue(NOMBRE_COLA_EMAILS, {
  connection: conexionRedis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

// Un helper por cada tipo de email que exista. El "name" del job (primer
// argumento de colaEmails.add) es lo que el worker usa para elegir que
// funcion de src/email.js ejecutar.
export async function encolarEmailPagoConfirmado({ to, sobre }) {
  await colaEmails.add("pago-confirmado", { to, sobre });
}
