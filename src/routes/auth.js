import { Router } from "express";
import { hashPassword, verificarPassword } from "../auth.js";
import {
  crearUsuario,
  obtenerUsuarioPorUsername,
  obtenerUsuarioPorId,
} from "../db.js";

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/auth/registro", (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password || password.length < 4) {
    return res.status(400).json({
      error: "Usuario y contraseña (minimo 4 caracteres) son requeridos",
    });
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: "Email invalido o faltante" });
  }

  if (obtenerUsuarioPorUsername(username)) {
    return res.status(409).json({ error: "Ese usuario ya existe" });
  }

  const hash = hashPassword(password);
  const id = crearUsuario(username, hash, email);
  req.session.userId = id;
  res.json({ id, username, email });
});

router.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  const usuario = obtenerUsuarioPorUsername(username);

  if (!usuario || !verificarPassword(password, usuario.password_hash)) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }

  req.session.userId = usuario.id;
  res.json({ id: usuario.id, username: usuario.username });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/auth/me", (req, res) => {
  const usuario = req.session.userId && obtenerUsuarioPorId(req.session.userId);
  if (!usuario) return res.status(401).json({ error: "No autenticado" });
  res.json({
    id: usuario.id,
    username: usuario.username,
    email: usuario.email,
    saldoCentavos: usuario.saldo_centavos,
  });
});

export default router;
