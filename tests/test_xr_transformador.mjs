// X/R del transformador — usuario, 2026-11-21, documento "tabla
// completa X/R aceite/seco" (GE/ABB standard design). Prueba
// obtenerXRTransformador (valores exactos, interpolación, fuera de
// rango) y el reparto R/X real en calcularImpedanciaTransformadorOhm.
import { obtenerXRTransformador, calcularImpedanciaTransformadorOhm } from "../src/modules/motor/index.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// --- 1. Valores exactos de la tabla ---
const r75 = obtenerXRTransformador({ capacidadKVA: 75, tipoRefrigeracion: "aceite" });
assert(r75.disponible && r75.xr === 3.2 && !r75.interpolado, `75kVA aceite: X/R=3.2 exacto (real: ${JSON.stringify(r75)})`);

const r1000seco = obtenerXRTransformador({ capacidadKVA: 1000, tipoRefrigeracion: "seco" });
assert(r1000seco.disponible && r1000seco.xr === 5.5 && !r1000seco.interpolado, `1000kVA seco: X/R=5.5 exacto (real: ${JSON.stringify(r1000seco)})`);

const r750aceite = obtenerXRTransformador({ capacidadKVA: 750, tipoRefrigeracion: "aceite" });
assert(r750aceite.disponible && r750aceite.xr === 5.5, `750kVA aceite: X/R=5.5 (punto medio entre 500kVA=5.2 y 1000kVA=6.5, confirmado por el usuario tras descartar 6.0 y 4.0 — ningún dato de catálogo exacto existe para este punto en el rango de tensión correcto) (real: ${JSON.stringify(r750aceite)})`);

// --- 2. Interpolación lineal entre puntos citados ---
// 225kVA aceite: entre 150(3.8) y 300(4.5), fracción=(225-150)/(300-150)=0.5 -> 3.8+0.5*(4.5-3.8)=4.15
const r225 = obtenerXRTransformador({ capacidadKVA: 225, tipoRefrigeracion: "aceite" });
assert(r225.disponible && r225.interpolado && Math.abs(r225.xr - 4.15) < 0.001, `225kVA aceite interpolado = 4.15 (real: ${JSON.stringify(r225)})`);

// --- 3. Fuera de rango -> no disponible, no extrapola ---
const rFueraBajo = obtenerXRTransformador({ capacidadKVA: 50, tipoRefrigeracion: "aceite" });
assert(!rFueraBajo.disponible, "50kVA (<75, fuera de rango) -> no disponible, no extrapola");
const rFueraAlto = obtenerXRTransformador({ capacidadKVA: 2500, tipoRefrigeracion: "aceite" });
assert(!rFueraAlto.disponible, "2500kVA (>1000, fuera de rango de distribución) -> no disponible");

// --- 4. Sin tipo de refrigeración -> no disponible, motivo explícito ---
const rSinTipo = obtenerXRTransformador({ capacidadKVA: 500, tipoRefrigeracion: "" });
assert(!rSinTipo.disponible, "Sin tipo de refrigeración -> no disponible (no asume aceite por defecto)");

// --- 5. calcularImpedanciaTransformadorOhm: reparto R/X real con xr, vs. degenerado sin xr ---
// 500kVA, 400V, %Z=4% (mismo caso base de siempre) + X/R=5.2 (aceite, exacto de tabla)
const impedanciaConXR = calcularImpedanciaTransformadorOhm({ capacidadKVA: 500, tensionSecundariaV: 400, impedanciaPct: 4, xr: 5.2 });
assert(impedanciaConXR.disponible, "calcularImpedanciaTransformadorOhm con xr: disponible");
if (impedanciaConXR.disponible) {
  const { r, x } = impedanciaConXR.impedancia;
  const zReconstruido = Math.sqrt(r * r + x * x);
  const zEsperado = (4 / 100) * (400 * 400) / (500 * 1000);
  assert(Math.abs(zReconstruido - zEsperado) < 1e-9, `Magnitud |Z| no cambia con el reparto real (real: ${zReconstruido} vs esperado ${zEsperado})`);
  assert(Math.abs(x / r - 5.2) < 0.001, `X/R del reparto = 5.2, como se pidió (real: ${(x / r).toFixed(3)})`);
  assert(r > 0, "Con xr, R ya NO es 0 (reparto real, no degenerado)");
}

// Sin xr -> comportamiento degenerado de siempre (backward compatible).
const impedanciaSinXR = calcularImpedanciaTransformadorOhm({ capacidadKVA: 500, tensionSecundariaV: 400, impedanciaPct: 4 });
assert(impedanciaSinXR.disponible && impedanciaSinXR.impedancia.r === 0, "Sin xr, sigue el reparto degenerado r=0 (compatibilidad hacia atrás, cero cambio para lo ya construido)");

console.log("\nTodas las pruebas completadas.");
