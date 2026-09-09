import "dotenv/config";
import express from "express";
import session from "express-session";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripeWebhookHandler } from "./src/routes/webhook.js";
import catalogRoutes from "./src/routes/catalog.js";
import sobresRoutes from "./src/routes/sobres.js";
import sobreAleatorioRoutes from "./src/routes/sobreAleatorio.js";
import authRoutes from "./src/routes/auth.js";
import pokedexRoutes from "./src/routes/pokedex.js";
import inventarioRoutes from "./src/routes/inventario.js";
import chatRoutes from "./src/routes/chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// El webhook necesita el body crudo para verificar la firma de Stripe,
// por eso se registra ANTES del express.json() global.
app.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-cambiame",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax" },
  })
);

app.use(express.static(path.join(__dirname, "public")));

app.use("/api", authRoutes);
app.use("/api", catalogRoutes);
app.use("/api", sobresRoutes);
app.use("/api", sobreAleatorioRoutes);
app.use("/api", pokedexRoutes);
app.use("/api", inventarioRoutes);
app.use("/api", chatRoutes);

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`Entrenador Pokemon corriendo en http://localhost:${PORT}`);
});
