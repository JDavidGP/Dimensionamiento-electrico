// Volúmenes de seguridad del baño — REBT ITC-BT-27, cita LITERAL
// confirmada contra el texto consolidado del REBT en el BOE (no un
// resumen): usuario, 2026-11-26, "sigamos" tras pedirme confirmar yo
// mismo la Tabla 1 exacta antes de fijar un número. Prueba la capa
// PURA: clasificarDistanciaBano/fuenteAguaMasCercana/evaluarZonaBano
// (modules/plano/volumenesBano.ts).
import {
  clasificarDistanciaBano,
  fuenteAguaMasCercana,
  evaluarZonaBano,
  ANCHO_VOLUMEN_2_M,
  ANCHO_VOLUMEN_3_M,
  RADIO_VOLUMEN1_DEFECTO_M,
} from "../src/modules/plano/index.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. clasificarDistanciaBano con el radio DEFAULT (0.6m) ---
// Límite prohibido = 0.6 (V1) + 0.6 (V2) = 1.2m. Límite Volumen 3 = 1.2 + 2.4 = 3.6m.
// Los límites EXACTOS se recalculan acá con la misma suma en el mismo
// orden que usa la función (en vez de un literal tipo "3.6") para no
// chocar con imprecisión de punto flotante (0.6+0.6+2.4 !== 3.6 bit a
// bit en JS) — el valor "pasado el límite" sí usa un margen (+0.01)
// bien por encima de ese ruido.
const limiteProhibidoDefault = RADIO_VOLUMEN1_DEFECTO_M + ANCHO_VOLUMEN_2_M;
const limiteVolumen3Default = limiteProhibidoDefault + ANCHO_VOLUMEN_3_M;
assert(clasificarDistanciaBano(0).zona === "prohibido", "Distancia 0 (dentro de la bañera) -> prohibido");
assert(clasificarDistanciaBano(limiteProhibidoDefault).zona === "prohibido", "Distancia EXACTA al límite -> todavía prohibido (límite inclusivo)");
assert(clasificarDistanciaBano(limiteProhibidoDefault + 0.01).zona === "volumen_3", "Justo pasado el límite -> Volumen 3");
assert(clasificarDistanciaBano(limiteVolumen3Default).zona === "volumen_3", "Distancia EXACTA al límite de Volumen 3 -> todavía Volumen 3");
assert(clasificarDistanciaBano(limiteVolumen3Default + 0.01).zona === "fuera", "Justo pasado el límite de Volumen 3 -> fuera, sin restricción");

// --- 2. Con un radio de Volumen 1 distinto (1.2m, difusor móvil) los límites se corren igual ---
const limiteProhibidoGrande = 1.2 + ANCHO_VOLUMEN_2_M; // mismo cálculo que hace la función
const conRadioGrande = clasificarDistanciaBano(limiteProhibidoGrande, 1.2);
assert(conRadioGrande.zona === "prohibido", "Con radio Volumen 1 = 1.2m, el límite prohibido se corre acorde (real: " + conRadioGrande.zona + ")");

// --- 3. Las citas (motivo) mencionan la sección real ---
assert(/ITC-BT-27/.test(clasificarDistanciaBano(0).motivo) && /No permitida/.test(clasificarDistanciaBano(0).motivo), "Prohibido cita ITC-BT-27 Tabla 1 ('No permitida')");
assert(/30mA/.test(clasificarDistanciaBano(2).motivo), "Volumen 3 cita el límite de 30mA del diferencial");
assert(clasificarDistanciaBano(5).motivo === "", "Fuera de todo volumen -> sin motivo que citar");

// --- 4. fuenteAguaMasCercana: ignora marcadores de otro tipo, encuentra la MÁS cercana entre varias ---
const marcadores = [
  { punto: { x: 0, y: 0 }, tipo: "contacto" }, // no es fuente de agua, se ignora
  { punto: { x: 5, y: 0 }, tipo: "fuente_agua" },
  { punto: { x: 1, y: 0 }, tipo: "fuente_agua" }, // la más cercana al origen
];
const cercana = fuenteAguaMasCercana({ x: 0, y: 0 }, marcadores);
assert(cercana && Math.abs(cercana.distanciaM - 1) < 1e-9, `fuenteAguaMasCercana ignora 'contacto' y elige la fuente de agua más próxima (real: ${cercana?.distanciaM})`);

// --- 5. Sin ninguna fuente de agua en el plano -> null, no revienta ---
assert(fuenteAguaMasCercana({ x: 0, y: 0 }, [{ punto: { x: 1, y: 1 }, tipo: "contacto" }]) === null, "Sin fuentes de agua -> null");

// --- 6. evaluarZonaBano: combina la búsqueda + la clasificación, usando el radioVolumen1M PROPIO del marcador más cercano ---
const puntoDePrueba = { x: limiteProhibidoGrande, y: 0 }; // justo en el límite prohibido SI el radio usado es 1.2m
const fuenteConRadioPropio = [{ punto: { x: 0, y: 0 }, tipo: "fuente_agua", radioVolumen1M: 1.2 }];
const zonaConRadioPropio = evaluarZonaBano(puntoDePrueba, fuenteConRadioPropio);
assert(zonaConRadioPropio.zona === "prohibido", `evaluarZonaBano usa el radioVolumen1M del marcador (1.2m), no el default (real: ${zonaConRadioPropio.zona})`);

const fuenteSinRadioPropio = [{ punto: { x: 0, y: 0 }, tipo: "fuente_agua" }]; // sin radioVolumen1M -> usa el default 0.6, cuyo límite prohibido (1.2) es MENOR que la distancia de prueba (1.8) -> ya cae en volumen_3
const zonaConDefault = evaluarZonaBano(puntoDePrueba, fuenteSinRadioPropio);
assert(zonaConDefault.zona === "volumen_3", `evaluarZonaBano usa RADIO_VOLUMEN1_DEFECTO_M (${RADIO_VOLUMEN1_DEFECTO_M}m) si el marcador no trae el suyo (real: ${zonaConDefault.zona})`);

assert(evaluarZonaBano({ x: 0, y: 0 }, []) === null, "Sin ninguna fuente de agua en el plano -> evaluarZonaBano devuelve null, no un resultado inventado");

// --- 7. Constantes citadas exactas (ITC-BT-27 §2.1.3/§2.1.4) ---
assert(ANCHO_VOLUMEN_2_M === 0.6, "ANCHO_VOLUMEN_2_M = 0.6m (§2.1.3, cita exacta)");
assert(ANCHO_VOLUMEN_3_M === 2.4, "ANCHO_VOLUMEN_3_M = 2.4m (§2.1.4, cita exacta)");
assert(RADIO_VOLUMEN1_DEFECTO_M === 0.6, "RADIO_VOLUMEN1_DEFECTO_M = 0.6m (§2.1.2, ducha con rociador fijo)");

console.log("\nTodas las pruebas completadas.");
