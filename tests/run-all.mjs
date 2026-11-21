// Corredor de toda la regresión (lógica pura + UI con Playwright) —
// usuario, 2026-11-22, "hacer más robusta la seguridad": antes esto
// vivía solo en un scratchpad efímero de sesión, nunca llegaba al
// repo ni corría en CI. Este script:
//   1. Levanta UN solo `vite preview` sobre dist/ (hay que compilar
//      antes con `npm run build`) en BASE_URL.
//   2. Corre cada tests/test_*.mjs (con BASE_URL/PLAYWRIGHT_CHROMIUM_PATH
//      ya en el entorno) con concurrencia limitada.
//   3. Compara cada falla contra tests/known-failures.json: una falla
//      YA CONOCIDA no rompe la corrida (es deuda de las pruebas, no
//      del programa — ver la nota de ese archivo); una falla NUEVA sí.
//   4. Avisa (sin romper la corrida) si una prueba "conocida como
//      fallando" empezó a pasar — señal de que ya se puede sacar de
//      la lista.
import { spawn } from "child_process";
import { readdirSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const PUERTO = process.env.BASE_URL ? new URL(process.env.BASE_URL).port : "4343";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PUERTO}`;
const CONCURRENCIA = Number(process.env.TEST_CONCURRENCY || 6);

const conocidas = JSON.parse(readFileSync(path.join(DIR, "known-failures.json"), "utf-8"));
delete conocidas._nota;

function esperarServidor(url, intentosMax = 40) {
  return new Promise((resolve, reject) => {
    let intentos = 0;
    const intentar = () => {
      intentos++;
      fetch(url)
        .then(() => resolve())
        .catch(() => {
          if (intentos >= intentosMax) return reject(new Error(`El servidor en ${url} no respondió tras ${intentosMax} intentos.`));
          setTimeout(intentar, 250);
        });
    };
    intentar();
  });
}

function correrUnaPrueba(archivo) {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, [path.join(DIR, archivo)], {
      env: { ...process.env, BASE_URL },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let salida = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (salida += d));
    hijo.on("close", (code) => resolve({ archivo, code, salida }));
  });
}

async function correrConcurrencia(archivos, limite) {
  const resultados = [];
  let i = 0;
  async function trabajador() {
    while (i < archivos.length) {
      const archivo = archivos[i++];
      resultados.push(await correrUnaPrueba(archivo));
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, archivos.length) }, trabajador));
  return resultados;
}

async function main() {
  const filtro = process.env.TEST_FILTER || "";
  const todasLasPruebas = readdirSync(DIR).filter((f) => f.startsWith("test_") && f.endsWith(".mjs") && f.includes(filtro));
  console.log(`Encontradas ${todasLasPruebas.length} pruebas.`);

  console.log(`Levantando "vite preview" en el puerto ${PUERTO} (requiere haber corrido "npm run build" antes)...`);
  const servidor = spawn("npx", ["vite", "preview", "--port", PUERTO, "--strictPort"], {
    cwd: path.join(DIR, ".."),
    stdio: ["ignore", "ignore", "pipe"],
  });
  try {
    await esperarServidor(BASE_URL);
  } catch (e) {
    console.error(e.message);
    servidor.kill();
    process.exit(1);
  }
  console.log("Servidor listo.\n");

  const resultados = await correrConcurrencia(todasLasPruebas, CONCURRENCIA);
  servidor.kill();

  const fallosNuevos = [];
  const fallosConocidos = [];
  const conocidasQuePasaron = [];

  for (const r of resultados) {
    const nombre = r.archivo.replace(/\.mjs$/, "");
    const fallo = r.code !== 0;
    if (fallo && conocidas[nombre]) {
      fallosConocidos.push(nombre);
    } else if (fallo) {
      fallosNuevos.push({ nombre, salida: r.salida });
    } else if (conocidas[nombre]) {
      conocidasQuePasaron.push(nombre);
    }
  }

  console.log(`\n=== Resultado: ${resultados.length - fallosNuevos.length - fallosConocidos.length} OK, ${fallosConocidos.length} fallas conocidas (deuda de las pruebas), ${fallosNuevos.length} fallas NUEVAS ===\n`);

  if (fallosConocidos.length > 0) {
    console.log("Fallas conocidas (ver tests/known-failures.json, no rompen la corrida):");
    for (const n of fallosConocidos) console.log(`  - ${n}: ${conocidas[n]}`);
    console.log();
  }

  if (conocidasQuePasaron.length > 0) {
    console.log("AVISO: estas pruebas estaban marcadas como fallando pero ahora PASAN — se pueden sacar de tests/known-failures.json:");
    for (const n of conocidasQuePasaron) console.log(`  - ${n}`);
    console.log();
  }

  if (fallosNuevos.length > 0) {
    console.error("FALLAS NUEVAS (esto es lo que rompe la corrida):");
    for (const { nombre, salida } of fallosNuevos) {
      console.error(`\n--- ${nombre} ---`);
      console.error(salida.split("\n").slice(-25).join("\n"));
    }
    process.exit(1);
  }

  console.log("Sin fallas nuevas.");
  process.exit(0);
}

main();
