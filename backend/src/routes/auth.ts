import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { hashearPassword, verificarPassword } from "../lib/password.js";
import { firmarToken } from "../lib/jwt.js";
import { manejarAsync } from "../lib/manejarAsync.js";

export const router = Router();

const esquemaRegistro = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  nombre: z.string().trim().min(1, "El nombre no puede estar vacío."),
});

router.post("/registro", manejarAsync(async (req, res) => {
  const datos = esquemaRegistro.safeParse(req.body);
  if (!datos.success) {
    res.status(400).json({ error: datos.error.issues[0]?.message ?? "Datos inválidos." });
    return;
  }
  const { email, password, nombre } = datos.data;

  const existente = await pool.query("SELECT id FROM usuarios WHERE email = $1", [email]);
  if (existente.rowCount) {
    res.status(409).json({ error: "Ese correo ya está registrado." });
    return;
  }

  const passwordHash = await hashearPassword(password);
  const resultado = await pool.query<{ id: string }>(
    "INSERT INTO usuarios (email, password_hash, nombre) VALUES ($1, $2, $3) RETURNING id",
    [email, passwordHash, nombre]
  );
  const usuarioId = resultado.rows[0].id;
  const token = firmarToken({ usuarioId });
  res.status(201).json({ token, usuario: { id: usuarioId, email, nombre } });
}));

const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string(),
});

router.post("/login", manejarAsync(async (req, res) => {
  const datos = esquemaLogin.safeParse(req.body);
  if (!datos.success) {
    res.status(400).json({ error: "Datos inválidos." });
    return;
  }
  const { email, password } = datos.data;

  const resultado = await pool.query<{ id: string; password_hash: string; nombre: string }>(
    "SELECT id, password_hash, nombre FROM usuarios WHERE email = $1",
    [email]
  );
  const fila = resultado.rows[0];
  // Mismo mensaje genérico para "no existe" y "contraseña incorrecta"
  // — no darle a quien ataca información de si el correo está
  // registrado o no.
  if (!fila || !(await verificarPassword(password, fila.password_hash))) {
    res.status(401).json({ error: "Correo o contraseña incorrectos." });
    return;
  }

  const token = firmarToken({ usuarioId: fila.id });
  res.json({ token, usuario: { id: fila.id, email, nombre: fila.nombre } });
}));
