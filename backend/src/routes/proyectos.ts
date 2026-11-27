import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { autenticar } from "../middleware/autenticar.js";
import { manejarAsync } from "../lib/manejarAsync.js";

export const router = Router();

router.use(autenticar);

// Lista liviana (sin el blob `datos`) para la pantalla de "Abrir
// proyecto" — traer el JSON completo de cada proyecto del usuario
// solo para mostrar nombre/fecha sería desperdiciar ancho de banda.
router.get(
  "/",
  manejarAsync(async (req, res) => {
    const resultado = await pool.query(
      "SELECT id, nombre, creado_en, actualizado_en FROM proyectos WHERE propietario_id = $1 ORDER BY actualizado_en DESC",
      [req.usuarioId]
    );
    res.json(resultado.rows);
  })
);

router.get(
  "/:id",
  manejarAsync(async (req, res) => {
    const resultado = await pool.query(
      "SELECT id, nombre, datos, creado_en, actualizado_en FROM proyectos WHERE id = $1 AND propietario_id = $2",
      [req.params.id, req.usuarioId]
    );
    const fila = resultado.rows[0];
    if (!fila) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    res.json(fila);
  })
);

const esquemaCrear = z.object({
  nombre: z.string().trim().min(1, "El nombre no puede estar vacío."),
  datos: z.unknown(),
});

router.post(
  "/",
  manejarAsync(async (req, res) => {
    const cuerpo = esquemaCrear.safeParse(req.body);
    if (!cuerpo.success) {
      res.status(400).json({ error: cuerpo.error.issues[0]?.message ?? "Datos inválidos." });
      return;
    }
    const { nombre, datos } = cuerpo.data;
    const resultado = await pool.query<{ id: string }>(
      "INSERT INTO proyectos (propietario_id, nombre, datos) VALUES ($1, $2, $3) RETURNING id",
      [req.usuarioId, nombre, datos]
    );
    res.status(201).json({ id: resultado.rows[0].id });
  })
);

const esquemaActualizar = z.object({
  nombre: z.string().trim().min(1).optional(),
  datos: z.unknown().optional(),
});

router.put(
  "/:id",
  manejarAsync(async (req, res) => {
    const cuerpo = esquemaActualizar.safeParse(req.body);
    if (!cuerpo.success) {
      res.status(400).json({ error: cuerpo.error.issues[0]?.message ?? "Datos inválidos." });
      return;
    }
    if (cuerpo.data.nombre === undefined && cuerpo.data.datos === undefined) {
      res.status(400).json({ error: "No hay nada para actualizar." });
      return;
    }

    const resultado = await pool.query(
      `UPDATE proyectos
       SET nombre = COALESCE($1, nombre),
           datos = COALESCE($2, datos),
           actualizado_en = now()
       WHERE id = $3 AND propietario_id = $4
       RETURNING id`,
      [cuerpo.data.nombre ?? null, cuerpo.data.datos ?? null, req.params.id, req.usuarioId]
    );
    if (!resultado.rowCount) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    res.status(204).end();
  })
);

router.delete(
  "/:id",
  manejarAsync(async (req, res) => {
    const resultado = await pool.query("DELETE FROM proyectos WHERE id = $1 AND propietario_id = $2", [
      req.params.id,
      req.usuarioId,
    ]);
    if (!resultado.rowCount) {
      res.status(404).json({ error: "Proyecto no encontrado." });
      return;
    }
    res.status(204).end();
  })
);
