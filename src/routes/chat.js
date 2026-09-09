import { Router } from "express";
import { requireAuth } from "../middleware.js";
import { chat } from "../chatAgent.js";

const router = Router();

router.post("/chat", requireAuth, async (req, res) => {
  const { mensaje } = req.body;
  if (!mensaje || typeof mensaje !== "string") {
    return res.status(400).json({ error: "Falta el mensaje" });
  }

  if (!req.session.chatHistorial) req.session.chatHistorial = [];
  req.session.chatHistorial.push({ role: "user", content: mensaje });

  try {
    const { respuesta, eventos, historial } = await chat({
      usuarioId: req.session.userId,
      mensajes: req.session.chatHistorial,
    });
    req.session.chatHistorial = historial;
    res.json({ respuesta, eventos });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post("/chat/reiniciar", requireAuth, (req, res) => {
  req.session.chatHistorial = [];
  res.json({ ok: true });
});

export default router;
