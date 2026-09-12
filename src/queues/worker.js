// Proceso separado que consume la cola de emails. Correr con `npm run worker`.
// El servidor de Express (server.js) solo encola; este proceso es el unico
// que de verdad manda emails (via src/email.js).
import "dotenv/config";
import "./emailWorker.js";

console.log("[email-worker] Escuchando la cola de emails...");
