import {
  marcarComoPagado,
  actualizarPokemonIds,
  agregarAPokedex,
  agregarAInventario,
  obtenerUsuarioPorId,
} from "./db.js";
import { elegirAleatorios } from "./pokeapi.js";
import { encolarEmailPagoConfirmado } from "./queues/emailQueue.js";

// Idempotente: si el sobre ya esta pagado (p.ej. el webhook llega dos veces), no hace nada.
export async function confirmarPago(sobre) {
  if (sobre.estado === "pagado") return;

  if (sobre.tipo === "aleatorio") {
    const cartas = await elegirAleatorios(sobre.cantidad * 3);
    const ids = cartas.map((c) => c.id);
    actualizarPokemonIds(sobre.id, ids);
    for (const id of ids) agregarAInventario(sobre.usuario_id, id);
  } else {
    const ids = JSON.parse(sobre.pokemon_ids);
    for (const id of ids) agregarAPokedex(sobre.usuario_id, id, "directo");
  }

  marcarComoPagado(sobre.id);

  const usuario = obtenerUsuarioPorId(sobre.usuario_id);
  await encolarEmailPagoConfirmado({ to: usuario?.email, sobre });
}
