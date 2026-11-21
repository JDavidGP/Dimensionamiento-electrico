import { normalizarTransformador, calcularCorrientesNominales } from "../src/modules/motor/transformador.ts";
import { TIPOS_CONEXION_EQUIPO, TIPOS_EQUIPO_ESPECIAL, CONEXIONES_DISPONIBLES_POR_DEFECTO, EQUIPO_ESPECIAL_VACIO } from "../src/shared/data/equiposEspeciales.js";
import { Config } from "../src/core/services/Config.js";

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FALLÓ:", msg); fallos++; }
  else console.log("OK:", msg);
}

// 1. normalizarTransformador: pass-through + defaults
const t1 = normalizarTransformador({ nombre: "T1", capacidadKVA: 75 });
assert(t1.nombre === "T1" && t1.capacidadKVA === 75 && t1.fases === "tri", "normalizarTransformador aplica defaults y pasa datos");

// 2. calcularCorrientesNominales — trifásico
const r1 = calcularCorrientesNominales({ capacidadKVA: 75, fases: "tri", tensionPrimariaV: 13800, tensionSecundariaV: 240 });
assert(r1.disponible === true, "corrientes nominales trifásico disponible");
const esperadaSec = (75 * 1000) / (240 * Math.sqrt(3));
assert(Math.abs(r1.corrienteSecundariaA - esperadaSec) < 0.01, `corriente secundaria trifásica correcta (${r1.corrienteSecundariaA.toFixed(2)} A esperado ${esperadaSec.toFixed(2)} A)`);

// 3. calcularCorrientesNominales — monofásico
const r2 = calcularCorrientesNominales({ capacidadKVA: 10, fases: "mono", tensionPrimariaV: 7200, tensionSecundariaV: 240 });
const esperadaSecMono = (10 * 1000) / 240;
assert(Math.abs(r2.corrienteSecundariaA - esperadaSecMono) < 0.01, "corriente secundaria monofásica correcta (sin dividir por sqrt(3))");

// 4. Nunca sumar 0 y seguir: capacidad o tensión faltante -> disponible:false con motivo
const r3 = calcularCorrientesNominales({ fases: "tri", tensionPrimariaV: 13800, tensionSecundariaV: 240 });
assert(r3.disponible === false && typeof r3.motivo === "string", "sin capacidadKVA -> disponible:false con motivo (no inventa 0)");

const r4 = calcularCorrientesNominales({ capacidadKVA: 75, fases: "tri", tensionSecundariaV: 240 });
assert(r4.disponible === false && typeof r4.motivo === "string", "sin tensionPrimariaV -> disponible:false con motivo");

// 5. equiposEspeciales: tipos y defaults
assert(TIPOS_CONEXION_EQUIPO.DELTA === "delta" && TIPOS_CONEXION_EQUIPO.PARALELO === "paralelo", "TIPOS_CONEXION_EQUIPO tiene las 4 claves esperadas");
assert(CONEXIONES_DISPONIBLES_POR_DEFECTO[TIPOS_EQUIPO_ESPECIAL.MOTOR].includes("delta"), "motor admite delta por defecto");
assert(CONEXIONES_DISPONIBLES_POR_DEFECTO[TIPOS_EQUIPO_ESPECIAL.CONTACTOR].includes("serie"), "contactor admite serie por defecto");
assert(EQUIPO_ESPECIAL_VACIO.tipo === "" && EQUIPO_ESPECIAL_VACIO.conexion === "", "EQUIPO_ESPECIAL_VACIO arranca vacío, no inventa un tipo/conexión por defecto");

// 6. Config: equiposEspeciales presente y modificable sin perder otras claves (bug ya corregido)
assert(JSON.stringify(Config.equiposEspeciales.conexionesDisponibles.motor) === JSON.stringify(["delta","estrella"]), "Config.equiposEspeciales arranca con los defaults del catálogo");

const limitesAntes = { ...Config.limites };
Config.set({ limites: { desbalanceFasesPct: 15 } });
assert(Config.limites.desbalanceFasesPct === 15, "Config.set actualiza desbalanceFasesPct");
assert(Config.limites.caidaTensionPct === limitesAntes.caidaTensionPct, "Config.set NO borra caidaTensionPct al actualizar solo desbalanceFasesPct (bug de referencia corregido)");
assert(Config.limites.factorCargaContinua === limitesAntes.factorCargaContinua, "Config.set NO borra factorCargaContinua");

Config.set({ equiposEspeciales: { conexionesDisponibles: { motor: ["delta"] } } });
assert(JSON.stringify(Config.equiposEspeciales.conexionesDisponibles.motor) === JSON.stringify(["delta"]), "Config.set actualiza conexionesDisponibles.motor");
assert(Config.equiposEspeciales.conexionesDisponibles.contactor.length === 2, "Config.set NO borra conexionesDisponibles.contactor al tocar solo motor");

console.log(fallos === 0 ? "\nTODOS LOS CHECKS PASARON" : `\n${fallos} CHECK(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
