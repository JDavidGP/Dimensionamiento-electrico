-- Esquema inicial del backend DEC — alcance MVP acordado con el usuario
-- (2026-11-27): el backend solo maneja cuentas y guarda/carga proyectos;
-- el cálculo sigue corriendo en el navegador exactamente como ahora. `datos`
-- guarda el mismo blob que ya produce guardarProyectoComoJson() en
-- hooks/useCircuitos.ts (proyecto, normativaActiva, tipoInstalacion,
-- circuitos, equipos, tableros, fuentesEnergia, transformadores,
-- diferenciales, nodosDiagrama, conexionesDiagrama, plano) — sin
-- normalizar a columnas propias todavía, igual que el archivo .json de
-- siempre, para no inventar un segundo modelo de datos en paralelo al que
-- ya existe y está probado en el frontend.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propietario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  datos JSONB NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proyectos_propietario_idx ON proyectos(propietario_id);
