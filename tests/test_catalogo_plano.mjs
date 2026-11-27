// "Colocar equipo" filtrado a lo que un electricista de verdad ubica
// en planta — usuario, 2026-11-27: "ya definimos que lo necesario para
// un electricista es saber tablero o tableros eléctricos, puesta
// tierra que se me olvidó, caja de empalme, toma corriente y los
// puntos de luz con sus interruptores" + motores/carga especial
// confirmados aparte. Prueba la capa PURA:
// componentesPorCategoriaPlano (bibliotecaComponentes.js).
import {
  CATALOGO_COMPONENTES,
  obtenerComponente,
  componentesPorCategoria,
  componentesPorCategoriaDiagrama,
  componentesPorCategoriaPlano,
} from "../src/shared/data/bibliotecaComponentes.ts";

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

function idsDe(mapaPorCategoria) {
  return Object.values(mapaPorCategoria).flat().map((c) => c.id);
}

const idsPlano = idsDe(componentesPorCategoriaPlano());

// --- 1. Los 14 tipos esenciales (+ extras ya acordados) están todos ---
const ESENCIALES = [
  "tablero_electrico",
  "puesta_tierra",
  "caja_empalme",
  "fuente_agua",
  "circuito",
  "diferencial",
  "contacto",
  "interruptor",
  "interruptor_conmutado",
  "luminaria",
  "luminaria_conmutada",
  "luminaria_cascada",
  "motor",
  "carga_especial",
];
for (const id of ESENCIALES) {
  assert(idsPlano.includes(id), `'${id}' está en el selector del Plano`);
}
assert(idsPlano.length === ESENCIALES.length, `El selector del Plano tiene EXACTAMENTE ${ESENCIALES.length} tipos, ni uno más (real: ${idsPlano.length})`);

// --- 2. Los tipos de topología eléctrica (solo Diagrama unifilar) NO aparecen en el Plano ---
const SOLO_DIAGRAMA = ["medidor", "plc", "rele", "contactor", "bobina", "sensor", "transformador", "generador", "banco_baterias", "panel_fotovoltaico", "variador_frecuencia", "interruptor_principal", "interruptor_termomagnetico", "interruptor_diferencial", "spd", "fusible", "barra_distribucion", "acometida"];
for (const id of SOLO_DIAGRAMA) {
  assert(!idsPlano.includes(id), `'${id}' (topología eléctrica, solo Diagrama unifilar) NO aparece en el selector del Plano`);
}

// --- 3. "Puesta a tierra" existe en el catálogo completo, es soloPlano, sin entidad vinculada ---
const puestaTierra = obtenerComponente("puesta_tierra");
assert(puestaTierra !== null, "'Puesta a tierra' existe en el catálogo completo");
assert(puestaTierra.soloPlano === true, "'Puesta a tierra' es soloPlano — no aporta nada a la topología del Diagrama");
assert(puestaTierra.entidadVinculada === null, "'Puesta a tierra' nunca se vincula a ninguna entidad (puramente físico, igual criterio que Caja de empalme)");

// --- 4. "Puesta a tierra" NO aparece en el Diagrama unifilar (mismo criterio que Caja de empalme/Fuente de agua) ---
const idsDiagrama = idsDe(componentesPorCategoriaDiagrama());
assert(!idsDiagrama.includes("puesta_tierra"), "'Puesta a tierra' NO aparece en el selector del Diagrama unifilar");
assert(idsDiagrama.includes("transformador") && idsDiagrama.includes("medidor"), "El Diagrama unifilar SIGUE teniendo sus propios tipos de topología (sin tocar)");

// --- 5. El catálogo completo (componentesPorCategoria, sin filtrar) sigue trayendo TODO, cero cambio de comportamiento ---
const idsCompletos = idsDe(componentesPorCategoria());
assert(idsCompletos.length === CATALOGO_COMPONENTES.length, `componentesPorCategoria() (sin filtrar) sigue trayendo los ${CATALOGO_COMPONENTES.length} tipos completos (real: ${idsCompletos.length})`);
assert(idsCompletos.includes("medidor") && idsCompletos.includes("puesta_tierra") && idsCompletos.includes("contacto"), "El catálogo completo incluye de todo, sin ningún filtro");

console.log("\nTodas las pruebas completadas.");
