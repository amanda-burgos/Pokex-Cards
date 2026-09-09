import { Router } from "express";
import { requireAuth } from "../middleware.js";
import { listarPokedex } from "../db.js";
import { obtenerCartasPorId } from "../pokeapi.js";

const router = Router();

router.get("/pokedex", requireAuth, async (req, res) => {
  const items = listarPokedex(req.session.userId);
  if (items.length === 0) return res.json([]);

  const detalles = await obtenerCartasPorId(items.map((i) => i.pokemon_id));
  const detallePorId = new Map(detalles.map((d) => [d.id, d]));

  res.json(
    items.map((i) => ({
      pokedexId: i.id,
      origen: i.origen,
      obtenidoEn: i.obtenido_en,
      ...detallePorId.get(i.pokemon_id),
    }))
  );
});

export default router;
