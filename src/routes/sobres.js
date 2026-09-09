import { Router } from "express";
import stripe from "../stripeClient.js";
import { requireAuth } from "../middleware.js";
import { obtenerCartasPorId } from "../pokeapi.js";
import { confirmarPago } from "../pagos.js";
import {
  crearSobre,
  asociarSessionStripe,
  obtenerSobre,
  obtenerUsuarioPorId,
  ajustarSaldo,
} from "../db.js";

const router = Router();
export const TAMANO_SOBRE = 3;

router.post("/sobre", requireAuth, async (req, res) => {
  try {
    const { pokemonIds } = req.body;

    if (!Array.isArray(pokemonIds) || pokemonIds.length !== TAMANO_SOBRE) {
      return res
        .status(400)
        .json({ error: `Elegi exactamente ${TAMANO_SOBRE} cartas` });
    }

    const cartas = await obtenerCartasPorId(pokemonIds);
    const totalCentavos = cartas.reduce((sum, c) => sum + c.precioCentavos, 0);
    const usuario = obtenerUsuarioPorId(req.session.userId);

    const sobreId = crearSobre({
      usuarioId: usuario.id,
      tipo: "directo",
      pokemonIds,
      totalCentavos,
    });

    if (usuario.saldo_centavos >= totalCentavos) {
      ajustarSaldo(usuario.id, -totalCentavos);
      await confirmarPago(obtenerSobre(sobreId));
      return res.json({ pagadoConSaldo: true, sobreId });
    }

    const line_items = cartas.map((carta) => ({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: carta.precioCentavos,
        product_data: {
          name: `${carta.nombre} (${carta.rareza})`,
          images: carta.imagen ? [carta.imagen] : undefined,
        },
      },
    }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      customer_email: usuario.email || undefined,
      metadata: { sobreId: String(sobreId) },
      success_url: `${process.env.DOMAIN}/success.html?sobre=${sobreId}`,
      cancel_url: `${process.env.DOMAIN}/index.html?cancelado=1`,
    });

    asociarSessionStripe(sobreId, session.id);

    res.json({ sobreId, url: session.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/sobre/:id", requireAuth, (req, res) => {
  const sobre = obtenerSobre(req.params.id);
  if (!sobre || sobre.usuario_id !== req.session.userId) {
    return res.status(404).json({ error: "Sobre no encontrado" });
  }
  res.json(sobre);
});

export default router;
