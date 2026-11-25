// Diámetro mínimo de tubo REBT (ITC-BT-21, Tablas 2 y 5) — usuario,
// 2026-11-24, "llenado de conducto para REBT". Prueba pura, sin
// navegador (como el resto de modules/motor/ todavía sin UI propia —
// ver nota en MotorCalculoMediator.js, mismo nivel que llenadoConducto
// de NEC). Valores de referencia copiados a mano del texto oficial
// (https://www.plcmadrid.es/documentos-rebt/ITC-21.pdf, extraído con
// pdftotext -layout, páginas 3 y 5-6) — no del módulo bajo prueba.
import { ApplicationMediator as App } from "../src/core/ApplicationMediator.js";

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FALLÓ:", msg); fallos++; }
  else console.log("OK:", msg);
}

// --- 1. Tabla 2 (superficial) — spot-checks contra el texto oficial ---
assert(
  App.motor.diametroTuboREBT(1.5, 1, "superficial").diametroExteriorMm === 12,
  "Superficial, 1.5mm² × 1 conductor = 12mm"
);
assert(
  App.motor.diametroTuboREBT(2.5, 5, "superficial").diametroExteriorMm === 20,
  "Superficial, 2.5mm² × 5 conductores = 20mm"
);
assert(
  App.motor.diametroTuboREBT(95, 1, "superficial").diametroExteriorMm === 32,
  "Superficial, 95mm² × 1 conductor = 32mm"
);
assert(
  App.motor.diametroTuboREBT(240, 2, "superficial").diametroExteriorMm === 75,
  "Superficial, 240mm² × 2 conductores = 75mm"
);

// --- 2. Tabla 5 (empotrada) — da valores DISTINTOS a la Tabla 2 (no es la misma tabla con otro nombre) ---
assert(
  App.motor.diametroTuboREBT(2.5, 3, "empotrada").diametroExteriorMm === 20,
  "Empotrada, 2.5mm² × 3 conductores = 20mm"
);
assert(
  App.motor.diametroTuboREBT(16, 5, "empotrada").diametroExteriorMm === 40,
  "Empotrada, 16mm² × 5 conductores = 40mm"
);
assert(
  App.motor.diametroTuboREBT(2.5, 3, "superficial").diametroExteriorMm === 16,
  "El mismo caso (2.5mm² × 3) da 16mm en superficial — confirma que las 2 tablas NO son iguales"
);

// --- 3. Celda "--" de la tabla oficial (combinación no tabulada) ---
const celdaVacia = App.motor.diametroTuboREBT(240, 3, "superficial");
assert(celdaVacia.disponible === false, "240mm² × 3 conductores en superficial es una celda '--' de la tabla real — no inventa un diámetro");

// --- 4. Más de 5 conductores: NO calcula (depende del fabricante, no de la norma) ---
const masDe5 = App.motor.diametroTuboREBT(2.5, 6, "empotrada");
assert(masDe5.disponible === false, "Más de 5 conductores no se calcula (ITC-BT-21 no lo tabula)");
assert(/fabricante/.test(masDe5.motivo), `El motivo explica que hace falta el dato del fabricante (real: '${masDe5.motivo}')`);

// --- 5. Sección no reconocida / tipo de instalación inválido / cantidad inválida ---
assert(App.motor.diametroTuboREBT(999, 1, "empotrada").disponible === false, "Sección no tabulada (999mm²) no se inventa");
assert(App.motor.diametroTuboREBT(2.5, 1, "aerea").disponible === false, "Tipo de instalación no reconocido ('aerea') se rechaza explícito");
assert(App.motor.diametroTuboREBT(2.5, 0, "empotrada").disponible === false, "Cantidad de conductores 0 se rechaza explícito");
assert(App.motor.diametroTuboREBT(2.5, 2.5, "empotrada").disponible === false, "Cantidad de conductores no entera se rechaza explícito");

// --- 6. Normativa IEC_ES/CIEN/NEC no se ven afectadas por este módulo nuevo (import limpio) ---
assert(typeof App.motor.llenadoConducto === "function", "El llenado de conducto NEC (ya existente) sigue expuesto sin cambios");

// --- 7. Tabla 9 de ITC-BT-21 (enterrado) — usuario, 2026-11-25, documento aparte con los valores reales ---
assert(App.motor.diametroTuboEnterradoREBT(1.5, 1).diametroExteriorMm === 25, "Enterrado, 1.5mm² × 1 conductor (≤6): 25mm");
assert(App.motor.diametroTuboEnterradoREBT(1.5, 6).diametroExteriorMm === 25, "Enterrado, 1.5mm² × 6 conductores (límite de la banda ≤6): sigue en 25mm");
assert(App.motor.diametroTuboEnterradoREBT(1.5, 7).diametroExteriorMm === 32, "Enterrado, 1.5mm² × 7 conductores (banda 7-10): salta a 32mm");
assert(App.motor.diametroTuboEnterradoREBT(70, 10).diametroExteriorMm === 160, "Enterrado, 70mm² × 10 conductores: 160mm (máximo de la tabla)");
assert(App.motor.diametroTuboEnterradoREBT(16, 1).diametroExteriorMm === 63, "Enterrado, 16mm² × 1 conductor: 63mm (misma que 10mm², la tabla no siempre sube por sección)");

const mas10 = App.motor.diametroTuboEnterradoREBT(2.5, 11);
assert(mas10.disponible === false, "Más de 10 conductores enterrados no se calcula (Tabla 9 no lo tabula)");
assert(/fabricante/.test(mas10.motivo), `El motivo explica que hace falta el dato del fabricante (real: '${mas10.motivo}')`);

assert(App.motor.diametroTuboEnterradoREBT(999, 1).disponible === false, "Sección no tabulada (999mm²) en Tabla 9 no se inventa");
assert(App.motor.diametroTuboEnterradoREBT(2.5, 0).disponible === false, "Cantidad de conductores 0 se rechaza explícito (Tabla 9)");

console.log(fallos === 0 ? "\nTODOS LOS CHECKS PASARON" : `\n${fallos} CHECK(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
