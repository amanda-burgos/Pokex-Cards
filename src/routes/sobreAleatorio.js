import { Router } from "express";
import stripe from "../stripeClient.js";
import { requireAuth } from "../middleware.js";
import { confirmarPago } from "../pagos.js";
import {
  crearSobre,
  asociarSessionStripe,
  obtenerSobre,
  obtenerUsuarioPorId,
  ajustarSaldo,
} from "../db.js";

const router = Router();
export const PRECIO_SOBRE_ALEATORIO_CENTAVOS = 250;
export const MAX_SOBRES_POR_COMPRA = 10;

router.get("/sobre-aleatorio/precio", (req, res) => {
  res.json({ precioCentavos: PRECIO_SOBRE_ALEATORIO_CENTAVOS, maxCantidad: MAX_SOBRES_POR_COMPRA });
});

router.post("/sobre-aleatorio", requireAuth, async (req, res) => {
  try {
    const cantidad = Number(req.body?.cantidad) || 1;

    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_SOBRES_POR_COMPRA) {
      return res
        .status(400)
        .json({ error: `La cantidad debe ser entre 1 y ${MAX_SOBRES_POR_COMPRA}` });
    }

    const usuario = obtenerUsuarioPorId(req.session.userId);
    const totalCentavos = cantidad * PRECIO_SOBRE_ALEATORIO_CENTAVOS;

    // Las cartas se sortean recien cuando se confirma el pago (ver confirmarPago).
    const sobreId = crearSobre({
      usuarioId: usuario.id,
      tipo: "aleatorio",
      cantidad,
      pokemonIds: [],
      totalCentavos,
    });

    if (usuario.saldo_centavos >= totalCentavos) {
      ajustarSaldo(usuario.id, -totalCentavos);
      await confirmarPago(obtenerSobre(sobreId));
      return res.json({ pagadoConSaldo: true, sobreId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: cantidad,
          price_data: {
            currency: "usd",
            unit_amount: PRECIO_SOBRE_ALEATORIO_CENTAVOS,
            product_data: {
              name: "Sobre Sorpresa (3 cartas al azar)",
            },
          },
        },
      ],
      customer_email: usuario.email || undefined,
      metadata: { sobreId: String(sobreId) },
      success_url: `${process.env.DOMAIN}/success.html?sobre=${sobreId}`,
      cancel_url: `${process.env.DOMAIN}/sobre-aleatorio.html?cancelado=1`,
    });

    asociarSessionStripe(sobreId, session.id);
    res.json({ sobreId, url: session.url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
