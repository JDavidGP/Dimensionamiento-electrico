// Motor geométrico de cruces de pared — usuario, 2026-11-22,
// "empecemos con el espesor de pared conectado a un cálculo real...
// crear un motor que realice cálculos geométricos más exacto". Prueba
// la capa PURA: interseccionSegmentos/anguloAgudoEntreSegmentos
// (geometria/) y calcularCrucesPared (plano/).
import { interseccionSegmentos, anguloAgudoEntreSegmentos } from "../src/modules/geometria/index.ts";
import { calcularCrucesPared, ANGULO_MINIMO_CRUCE_GRADOS } from "../src/modules/plano/index.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. interseccionSegmentos: casos básicos ---
// Cruz perfecta: (0,0)-(10,10) vs (0,10)-(10,0) se cruzan en (5,5).
const cruce1 = interseccionSegmentos({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 });
assert(cruce1 && Math.abs(cruce1.x - 5) < 1e-9 && Math.abs(cruce1.y - 5) < 1e-9, `Cruce diagonal en (5,5) (real: ${JSON.stringify(cruce1)})`);

// Segmentos paralelos -> null.
const cruceParalelo = interseccionSegmentos({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 });
assert(cruceParalelo === null, "Segmentos paralelos -> null, no hay cruce único");

// Se cruzarían si fueran rectas infinitas, pero NO dentro de los segmentos reales -> null.
const cruceFueraDeRango = interseccionSegmentos({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 0 }, { x: 5, y: 10 });
assert(cruceFueraDeRango === null, "Cruce fuera del rango de ambos segmentos -> null");

// Perpendiculares en T (comparten extremo) -> SÍ cuentan (t=1, dentro del rango [0,1]).
const cruceEnExtremo = interseccionSegmentos({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: -5 }, { x: 10, y: 5 });
assert(cruceEnExtremo && Math.abs(cruceEnExtremo.x - 10) < 1e-9, "Cruce justo en el extremo de un segmento SÍ cuenta");

// --- 2. anguloAgudoEntreSegmentos ---
// Perpendiculares (horizontal vs vertical) -> 90°.
const angulo90 = anguloAgudoEntreSegmentos({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: -5 }, { x: 5, y: 5 });
assert(Math.abs((angulo90 * 180) / Math.PI - 90) < 1e-6, `Perpendiculares -> 90° (real: ${(angulo90 * 180) / Math.PI}°)`);

// 45° entre horizontal y diagonal.
const angulo45 = anguloAgudoEntreSegmentos({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 10 });
assert(Math.abs((angulo45 * 180) / Math.PI - 45) < 1e-6, `Horizontal vs diagonal 45° (real: ${(angulo45 * 180) / Math.PI}°)`);

// Ángulo OBTUSO (150°) da el mismo resultado AGUDO (30°) — cruzar en 150° o en 30° atraviesa el mismo espesor real.
const angulo150 = anguloAgudoEntreSegmentos({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: -10, y: 5.7735 } /* ~150° de (10,0) */);
assert(Math.abs((angulo150 * 180) / Math.PI - 30) < 0.1, `Ángulo obtuso 150° -> agudo equivalente 30° (real: ${(angulo150 * 180) / Math.PI}°)`);

// --- 3. calcularCrucesPared: cruce perpendicular, extra = espesorM exacto ---
// Pared horizontal de (0,0) a (10,0), espesor 0.2m. Ruta vertical de (5,-3) a (5,3) cruza perpendicular en (5,0).
const nodos1 = [
  { id: "pA", punto: { x: 0, y: 0 } },
  { id: "pB", punto: { x: 10, y: 0 } },
  { id: "rA", punto: { x: 5, y: -3 } },
  { id: "rB", punto: { x: 5, y: 3 } },
];
const paredes1 = [{ id: "pared1", nodoAId: "pA", nodoBId: "pB", tipo: "pared", espesorM: 0.2 }];
const ruta1 = { id: "r1", nodoIds: ["rA", "rB"], nombre: "Ruta vertical", longitudM: 6 };
const resultado1 = calcularCrucesPared(ruta1, nodos1, paredes1);
assert(resultado1.cruces.length === 1, `Un cruce detectado (real: ${resultado1.cruces.length})`);
assert(Math.abs(resultado1.cruces[0].anguloGrados - 90) < 1e-6, `Ángulo de cruce = 90° (real: ${resultado1.cruces[0].anguloGrados}°)`);
assert(Math.abs(resultado1.cruces[0].extraM - 0.2) < 1e-9, `Cruce perpendicular: extra = espesorM exacto (real: ${resultado1.cruces[0].extraM})`);
assert(Math.abs(resultado1.longitudTotalM - 6.2) < 1e-9, `Longitud total = 6 (base) + 0.2 (cruce) = 6.2 (real: ${resultado1.longitudTotalM})`);

// --- 4. Cruce en 45°: extra = espesorM / sin(45°) = espesorM × √2, MAYOR que el perpendicular ---
const nodos2 = [
  { id: "pA", punto: { x: 0, y: 0 } },
  { id: "pB", punto: { x: 10, y: 0 } },
  { id: "rA", punto: { x: 2, y: -3 } },
  { id: "rB", punto: { x: 8, y: 3 } },
];
const ruta2 = { id: "r2", nodoIds: ["rA", "rB"], nombre: "Ruta diagonal", longitudM: Math.hypot(6, 6) };
const resultado2 = calcularCrucesPared(ruta2, nodos2, paredes1.map((p) => ({ ...p, nodoAId: "pA", nodoBId: "pB" })));
assert(resultado2.cruces.length === 1, "Cruce diagonal detectado");
assert(Math.abs(resultado2.cruces[0].anguloGrados - 45) < 0.5, `Ángulo de cruce ≈45° (real: ${resultado2.cruces[0].anguloGrados}°)`);
const extraEsperado45 = 0.2 / Math.sin(Math.PI / 4);
assert(Math.abs(resultado2.cruces[0].extraM - extraEsperado45) < 1e-6, `Cruce en 45°: extra = 0.2/sin(45°) ≈${extraEsperado45.toFixed(4)}m, MAYOR que el perpendicular (real: ${resultado2.cruces[0].extraM.toFixed(4)})`);
assert(resultado2.cruces[0].extraM > 0.2, "El cruce diagonal agrega MÁS que el espesor nominal (atraviesa más material)");

// --- 5. Pared sin espesorM medido -> se reporta, NO se inventa un valor ---
const paredesSinEspesor = [{ id: "pared2", nodoAId: "pA", nodoBId: "pB", tipo: "pared", espesorM: "" }];
const resultado3 = calcularCrucesPared(ruta1, nodos1, paredesSinEspesor);
assert(resultado3.cruces.length === 0, "Pared sin espesorM: no genera un 'cruce' con valor inventado");
assert(resultado3.paredesSinEspesor.includes("pared2"), "Pared sin espesorM: se reporta en paredesSinEspesor");
assert(resultado3.extraTotalM === 0, "Sin espesorM, el extra total es 0 (no se infla con un dato inexistente)");

// --- 6. Cruce demasiado oblicuo (<15°) -> indeterminado, NO se suma al total ---
const nodos4 = [
  { id: "pA", punto: { x: 0, y: 0 } },
  { id: "pB", punto: { x: 10, y: 0 } },
  { id: "rA", punto: { x: 0, y: -0.1 } },
  { id: "rB", punto: { x: 10, y: 0.1 } }, // cruza casi paralelo a la pared
];
const resultado4 = calcularCrucesPared({ id: "r4", nodoIds: ["rA", "rB"], nombre: "Ruta rasante", longitudM: 10 }, nodos4, paredes1);
assert(resultado4.cruces.length === 1, "Cruce rasante detectado");
assert(resultado4.cruces[0].anguloGrados < ANGULO_MINIMO_CRUCE_GRADOS, `Ángulo del cruce rasante < ${ANGULO_MINIMO_CRUCE_GRADOS}° (real: ${resultado4.cruces[0].anguloGrados.toFixed(2)}°)`);
assert(resultado4.cruces[0].extraM === null, "Cruce demasiado oblicuo: extraM = null (indeterminado, no un número inventado)");
assert(resultado4.paredesAnguloIndeterminado.includes("pared1"), "Se reporta en paredesAnguloIndeterminado");
assert(resultado4.extraTotalM === 0, "El cruce indeterminado NO se suma al extraTotalM");

// --- 7. Ruta que NO cruza ninguna pared -> sin cruces, longitudTotalM = longitudBaseM ---
const nodos5 = [
  { id: "pA", punto: { x: 0, y: 0 } },
  { id: "pB", punto: { x: 10, y: 0 } },
  { id: "rA", punto: { x: 0, y: 5 } },
  { id: "rB", punto: { x: 10, y: 5 } },
];
const resultado5 = calcularCrucesPared({ id: "r5", nodoIds: ["rA", "rB"], nombre: "Ruta lejos", longitudM: 10 }, nodos5, paredes1);
assert(resultado5.cruces.length === 0, "Ruta que no cruza ninguna pared: 0 cruces");
assert(resultado5.longitudTotalM === resultado5.longitudBaseM, "Sin cruces, longitudTotalM === longitudBaseM (sin cambio)");

// --- 8. Ruta con VARIOS tramos cruzando VARIAS paredes — se suman todos los extras conocidos ---
const nodosMultiples = [
  { id: "pA1", punto: { x: 0, y: 0 } },
  { id: "pB1", punto: { x: 10, y: 0 } },
  { id: "pA2", punto: { x: 0, y: 4 } },
  { id: "pB2", punto: { x: 10, y: 4 } },
  { id: "r1n", punto: { x: 5, y: -2 } },
  { id: "r2n", punto: { x: 5, y: 2 } },
  { id: "r3n", punto: { x: 5, y: 6 } },
];
const paredesMultiples = [
  { id: "paredA", nodoAId: "pA1", nodoBId: "pB1", tipo: "pared", espesorM: 0.15 },
  { id: "paredB", nodoAId: "pA2", nodoBId: "pB2", tipo: "pared", espesorM: 0.25 },
];
const rutaMultiple = { id: "rM", nodoIds: ["r1n", "r2n", "r3n"], nombre: "Ruta de 2 tramos", longitudM: 8 };
const resultadoMultiple = calcularCrucesPared(rutaMultiple, nodosMultiples, paredesMultiples);
assert(resultadoMultiple.cruces.length === 2, `2 cruces (uno por cada pared) (real: ${resultadoMultiple.cruces.length})`);
assert(Math.abs(resultadoMultiple.extraTotalM - 0.4) < 1e-9, `Extra total = 0.15+0.25=0.4m, ambos perpendiculares (real: ${resultadoMultiple.extraTotalM})`);

console.log("\nTodas las pruebas completadas.");
