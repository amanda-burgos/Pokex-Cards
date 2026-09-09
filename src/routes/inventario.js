import { Router } from "express";
import { requireAuth } from "../middleware.js";
import { obtenerCartasPorId } from "../pokeapi.js";
import {
  listarInventario,
  obtenerInventarioItem,
  eliminarDeInventario,
  agregarAPokedex,
  ajustarSaldo,
} from "../db.js";

const router = Router();
export const CANTIDAD_A_RECLAMAR = 3;
export const PORCENTAJE_VENTA = 0.5;

router.get("/inventario", requireAuth, async (req, res) => {
  const items = listarInventario(req.session.userId);
  if (items.length === 0) return res.json([]);

  const detalles = await obtenerCartasPorId(items.map((i) => i.pokemon_id));
  const detallePorId = new Map(detalles.map((d) => [d.id, d]));

  res.json(
    items.map((i) => ({
      inventarioId: i.id,
      obtenidoEn: i.obtenido_en,
      ...detallePorId.get(i.pokemon_id),
    }))
  );
});

router.post("/inventario/reclamar", requireAuth, (req, res) => {
  const { inventarioIds } = req.body;

  if (!Array.isArray(inventarioIds) || inventarioIds.length !== CANTIDAD_A_RECLAMAR) {
    return res
      .status(400)
      .json({ error: `Selecciona exactamente ${CANTIDAD_A_RECLAMAR} cartas para reclamar` });
  }

  const items = inventarioIds.map((id) =>
    obtenerInventarioItem(id, req.session.userId)
  );

  if (items.some((i) => !i)) {
    return res
      .status(404)
      .json({ error: "Alguna carta seleccionada no esta en tu inventario" });
  }

  for (const item of items) {
    agregarAPokedex(req.session.userId, item.pokemon_id, "aleatorio");
    eliminarDeInventario(item.id, req.session.userId);
  }

  res.json({ ok: true });
});

router.post("/inventario/vender", requireAuth, async (req, res) => {
  const { inventarioId } = req.body;
  const item = obtenerInventarioItem(inventarioId, req.session.userId);

  if (!item) {
    return res.status(404).json({ error: "Esa carta no esta en tu inventario" });
  }

  const [carta] = await obtenerCartasPorId([item.pokemon_id]);
  const saldoSumado = Math.round(carta.precioCentavos * PORCENTAJE_VENTA);
  eliminarDeInventario(item.id, req.session.userId);
  ajustarSaldo(req.session.userId, saldoSumado);

  res.json({ ok: true, saldoSumado });
});

export default router;
