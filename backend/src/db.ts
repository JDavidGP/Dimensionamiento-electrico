import pg from "pg";

const { Pool } = pg;

// Pool chico a propósito: alcance MVP es ~20 usuarios concurrentes
// (hardware del usuario: Ryzen 9 7900/64GB/RTX 4070 Super, ver
// conversación de arquitectura 2026-11-27), muy lejos de necesitar un
// pool grande. Subir `max` es la primera perilla si hace falta más
// adelante, no hay que rediseñar nada.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
