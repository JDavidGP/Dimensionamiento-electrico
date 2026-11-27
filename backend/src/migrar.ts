// Aplica schema.sql contra DATABASE_URL — `npm run migrar`. No hay
// versionado de migraciones todavía (alcance MVP, un solo esquema);
// CREATE TABLE IF NOT EXISTS lo hace seguro de correr más de una vez.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import "dotenv/config";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrar() {
  const sql = readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query(sql);
  console.log("Esquema aplicado correctamente.");
  await pool.end();
}

migrar().catch((err) => {
  console.error("Error aplicando el esquema:", err);
  process.exit(1);
});
