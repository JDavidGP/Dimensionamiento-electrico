import "dotenv/config";
import { app } from "./app.js";

// Variables requeridas al arrancar — mejor fallar ya, con un mensaje
// claro, que recién al primer login (JWT_SECRET) o al primer query
// (DATABASE_URL).
for (const variable of ["JWT_SECRET", "DATABASE_URL"]) {
  if (!process.env[variable]) {
    console.error(`Falta la variable de entorno ${variable} (ver .env.example).`);
    process.exit(1);
  }
}

const PUERTO = Number(process.env.PUERTO ?? 3001);
app.listen(PUERTO, () => {
  console.log(`DEC backend escuchando en http://localhost:${PUERTO}`);
});
