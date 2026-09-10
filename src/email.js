import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function enviarEmailPagoConfirmado({ to, sobre }) {
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY no configurada; se omite el envio de email."
    );
    return;
  }

  if (!to) {
    console.warn(
      `[email] Sobre #${sobre.id} pagado pero el usuario no tiene email registrado.`
    );
    return;
  }

  const total = (sobre.total_centavos / 100).toFixed(2);

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM || "Entrenador Pokemon <onboarding@resend.dev>",
      to,
      subject: `Pago confirmado - Sobre #${sobre.id}`,
      html: `
        <h1>Gracias por tu compra!</h1>
        <p>Tu sobre #${sobre.id} fue pagado exitosamente.</p>
        <p><strong>Total:</strong> $${total}</p>
        <p>Ya puedes revisar tus cartas en tu Pokedex o Inventario.</p>
      `,
    });
    console.log(`[email] Enviado a ${to} por sobre #${sobre.id}`);
  } catch (err) {
    console.error(`[email] Error enviando email por sobre #${sobre.id}:`, err);
  }
}
