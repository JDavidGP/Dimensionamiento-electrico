import express from "express";
import cors from "cors";
import type { ErrorRequestHandler } from "express";
import { router as rutasAuth } from "./routes/auth.js";
import { router as rutasProyectos } from "./routes/proyectos.js";

export const app = express();
app.use(cors({ origin: process.env.ORIGEN_PERMITIDO ?? "*" }));
app.use(express.json({ limit: "5mb" })); // un proyecto completo (plano incluido) puede pesar varios MB en base64

app.get("/salud", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", rutasAuth);
app.use("/proyectos", rutasProyectos);

app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada." });
});

// Firma de 4 argumentos obligatoria — es lo único que le indica a
// Express que esto es el manejador de errores, no una ruta más.
const manejarError: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
};
app.use(manejarError);
