// Canalizaciones aéreas y subterráneas — usuario, 2026-11-25. Prueba
// pura, sin navegador (mismo criterio que test_canalizacion_rebt.mjs):
// NEC (factor de ajuste por agrupamiento 310.15(B)(2)(a) + profundidad
// mínima de enterrado 300.5) y REBT (profundidad enterrada ITC-BT-07 +
// factor de agrupación de tubos ITC-BT-19 Tabla B), ambos todavía sin
// UI conectada — ver la nota en MotorCalculoMediator.js. Valores de
// referencia copiados a mano de los documentos que aportó el usuario
// (NEC_subterr_neo.docx, REBT_conexión_subterráneo.docx), no del
// módulo bajo prueba.
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FALLÓ:", msg); fallos++; }
  else console.log("OK:", msg);
}

// --- NEC: factor de ajuste por conductores portadores de corriente (310.15(B)(2)(a)) ---
assert(App.motor.factorAjusteCCCNec(3) === 1, "≤3 CCC: sin reducción (regla no aplica)");
assert(App.motor.factorAjusteCCCNec(4) === 0.8, "4 CCC: 80%");
assert(App.motor.factorAjusteCCCNec(6) === 0.8, "6 CCC: 80% (límite superior del rango)");
assert(App.motor.factorAjusteCCCNec(7) === 0.7, "7 CCC: 70%");
assert(App.motor.factorAjusteCCCNec(9) === 0.7, "9 CCC: 70%");
assert(App.motor.factorAjusteCCCNec(10) === 0.5, "10 CCC: 50%");
assert(App.motor.factorAjusteCCCNec(20) === 0.5, "20 CCC: 50%");
assert(App.motor.factorAjusteCCCNec(21) === 0.4, "21 CCC: 40%");
assert(App.motor.factorAjusteCCCNec(40) === 0.4, "40 CCC: 40%");
assert(App.motor.factorAjusteCCCNec(41) === 0.25, "41 CCC: 25%");
assert(App.motor.factorAjusteCCCNec(100) === 0.25, "100 CCC: 25% (tope superior)");

assert(App.motor.conductoresPortadoresCorriente("mono") === 2, "Monofásico: 2 CCC (fase+neutro, el neutro siempre cuenta)");
assert(App.motor.conductoresPortadoresCorriente("bi") === 2, "Bifásico: 2 CCC");
assert(App.motor.conductoresPortadoresCorriente("tri") === 3, "Trifásico: 3 CCC (neutro no cuenta, carga balanceada asumida)");

// --- NEC: profundidad mínima de enterrado (Tabla 300.5) ---
assert(App.motor.profundidadMinimaEnterradoNEC("pvc", "general") === 18, "PVC en tierra general: 18in");
assert(App.motor.profundidadMinimaEnterradoNEC("rmc_imc", "general") === 6, "RMC/IMC en tierra general: 6in (metálico rígido, menor profundidad)");
assert(App.motor.profundidadMinimaEnterradoNEC("cable_directo", "general") === 24, "Cable directo (sin tubo) en tierra general: 24in");
assert(App.motor.profundidadMinimaEnterradoNEC("pvc", "bajo_concreto_2in") === 12, "PVC bajo 2in de concreto: 12in (menos que en tierra directa)");
assert(App.motor.profundidadMinimaEnterradoNEC("rmc_imc", "bajo_edificacion") === 0, "Bajo una edificación: 0in (ya está protegido por la estructura)");
assert(App.motor.profundidadMinimaEnterradoNEC("pvc", "calzada_estacionamiento") === 24, "PVC bajo calzada/estacionamiento: 24in (tráfico vehicular)");
assert(App.motor.profundidadMinimaEnterradoNEC("rmc_imc", "driveway_residencial") === 18, "RMC bajo driveway residencial: 18in");
assert(App.motor.profundidadMinimaEnterradoNEC("pvc", "ubicacion_inventada") === null, "Ubicación no reconocida: null, no se inventa un valor");

// --- REBT: profundidad mínima enterrada (ITC-BT-07) ---
assert(App.motor.profundidadMinimaEnterradaREBT("acera") === 0.6, "Bajo acera: 0,60m");
assert(App.motor.profundidadMinimaEnterradaREBT("calzada") === 0.8, "Bajo calzada: 0,80m (más profundo, tráfico)");
assert(App.motor.profundidadMinimaEnterradaREBT("patio") === null, "Ubicación no reconocida: null");

// --- REBT: separación mínima con otras canalizaciones ---
assert(App.motor.separacionMinimaOtrasCanalizacionesREBT() === 0.2, "Separación general (agua/telecom): 0,20m por defecto");
assert(App.motor.separacionMinimaOtrasCanalizacionesREBT(true) === 0.4, "Separación con gas de alta presión: 0,40m");

// --- REBT: factor de agrupación de tubos enterrados (ITC-BT-19 Tabla B) ---
assert(App.motor.factorAgrupacionTubosREBT(2, "contacto") === 0.8, "2 cables en contacto: 0,80");
assert(App.motor.factorAgrupacionTubosREBT(2, "1.00_o_mas") === 1.0, "2 cables a ≥1m: sin corrección (1,00)");
assert(App.motor.factorAgrupacionTubosREBT(9, "0.25") === 0.53, "9 cables a 0,25m: 0,53");
assert(App.motor.factorAgrupacionTubosREBT(20, "contacto") === 0.35, "20 cables en contacto: 0,35 (máximo agrupamiento tabulado)");
// 10 no es una fila exacta (la tabla salta de 9 a 12) — se redondea HACIA ARRIBA (lado conservador) a la fila de 12.
assert(App.motor.factorAgrupacionTubosREBT(10, "0.50") === App.motor.factorAgrupacionTubosREBT(12, "0.50"), "10 cables (fila intermedia) usa el factor de la fila de 12 (conservador, redondeo hacia arriba)");
assert(App.motor.factorAgrupacionTubosREBT(25, "contacto") === null, "Más de 20 cables: la norma no lo tabula, no se extrapola (null)");
assert(App.motor.factorAgrupacionTubosREBT(1, "contacto") === null, "1 cable no es agrupamiento (mínimo tabulado: 2)");

assert(App.motor.separacionABucket(0) === "contacto", "0m de separación → bucket 'contacto'");
assert(App.motor.separacionABucket(0.1) === "contacto", "0,10m (entre 0 y 0,25) → redondea HACIA ABAJO a 'contacto' (conservador)");
assert(App.motor.separacionABucket(0.25) === "0.25", "Exactamente 0,25m → bucket '0.25'");
assert(App.motor.separacionABucket(0.4) === "0.25", "0,40m (entre 0,25 y 0,50) → redondea hacia abajo a '0.25'");
assert(App.motor.separacionABucket(0.5) === "0.50", "Exactamente 0,50m → bucket '0.50'");
assert(App.motor.separacionABucket(0.99) === "0.50", "0,99m (justo debajo de 1m) → bucket '0.50', no '1.00_o_mas'");
assert(App.motor.separacionABucket(1) === "1.00_o_mas", "Exactamente 1m → sin corrección");
assert(App.motor.separacionABucket(5) === "1.00_o_mas", "5m → sin corrección");

// --- Normativas existentes no se ven afectadas por este módulo nuevo ---
assert(typeof App.motor.llenadoConducto === "function", "Llenado de conducto NEC (ya existente) sigue expuesto sin cambios");
assert(typeof App.motor.diametroTuboREBT === "function", "Diámetro de tubo REBT superficial/empotrada (ya existente) sigue expuesto sin cambios");

console.log(fallos === 0 ? "\nTODOS LOS CHECKS PASARON" : `\n${fallos} CHECK(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
