import { Router } from "express";
import { buscarCatalogo, RAREZAS } from "../pokeapi.js";

const router = Router();

router.get("/catalog", async (req, res) => {
  try {
    const { search = "", page = "1", rareza = "" } = req.query;
    const resultado = await buscarCatalogo({
      search: String(search),
      page: Number(page) || 1,
      pageSize: 24,
      rareza: String(rareza),
    });
    res.json(resultado);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get("/catalog/rarezas", (req, res) => {
  res.json(RAREZAS);
});

export default router;
