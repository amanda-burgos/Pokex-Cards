import stripe from "../stripeClient.js";
import { obtenerSobrePorSessionId } from "../db.js";
import { confirmarPago } from "../pagos.js";

// Requiere el body crudo (sin parsear como JSON) para verificar la firma.
export async function stripeWebhookHandler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`[webhook] Firma invalida: ${err.message}`);
    return res.status(400).send(`Webhook signature error: ${err.message}`);
  }

  console.log(
    `[webhook] Evento recibido: type=${event.type} id=${event.id} livemode=${event.livemode}`
  );

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const sobre = obtenerSobrePorSessionId(session.id);
    if (sobre) await confirmarPago(sobre);
  }

  res.json({ received: true });
}
