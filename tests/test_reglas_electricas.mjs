import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

let fallos = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FALLÓ:", msg); fallos++; }
  else console.log("OK:", msg);
}

function nodo(tipo, nombre) {
  return App.diagrama.crearNodo({ tipo, nombre });
}

// --- Ejemplos EXPLÍCITOS citados por el usuario ---

// 1. "Un tomacorriente no puede alimentar un tablero" — ya cubierto por cardinalidad (salidas:0),
// pero confirmamos también que la regla semántica no lo permitiría igual si tuviera salidas.
const r1 = App.diagrama.validarReglaElectrica("contacto", "tablero_electrico");
assert(r1.valido === false, `contacto -> tablero_electrico es inválido también a nivel de regla semántica (carga no origina nada) (motivo: "${r1.motivo}")`);

// 2. "Un interruptor principal solo puede tener una entrada" — ya probado en Fase 1 (cardinalidad), no se repite acá.

// 3. "Un motor no puede conectarse directamente a un medidor sin protección"
const r3 = App.diagrama.validarReglaElectrica("medidor", "motor");
assert(r3.valido === false && r3.motivo.includes("protección"), `medidor -> motor se rechaza explícitamente (motivo: "${r3.motivo}")`);
// Pero medidor -> interruptor_termomagnetico (protección) sí debe ser válido
const r3b = App.diagrama.validarReglaElectrica("medidor", "interruptor_termomagnetico");
assert(r3b.valido === true, "medidor -> interruptor_termomagnetico (protección intermedia) SÍ es válido");
// Y protección -> motor sí es válido (con protección de por medio)
const r3c = App.diagrama.validarReglaElectrica("interruptor_termomagnetico", "motor");
assert(r3c.valido === true, "interruptor_termomagnetico -> motor SÍ es válido (ya con protección de por medio)");

// 4. "Los paneles solares deben conectarse a un inversor o controlador según el sistema"
const r4ok = App.diagrama.validarReglaElectrica("panel_fotovoltaico", "inversor");
assert(r4ok.valido === true, "panel_fotovoltaico -> inversor es válido");
const r4bad = App.diagrama.validarReglaElectrica("panel_fotovoltaico", "tablero_electrico");
assert(r4bad.valido === false, `panel_fotovoltaico -> tablero_electrico (saltándose el inversor) se rechaza (motivo: "${r4bad.motivo}")`);
const r4bad2 = App.diagrama.validarReglaElectrica("panel_fotovoltaico", "luminaria");
assert(r4bad2.valido === false, "panel_fotovoltaico -> luminaria directo también se rechaza");

// --- Flujo general de categorías (casos típicos, deben ser válidos) ---
assert(App.diagrama.validarReglaElectrica("acometida", "interruptor_principal").valido === true, "acometida -> interruptor_principal (fuente -> protección) válido");
assert(App.diagrama.validarReglaElectrica("acometida", "tablero_electrico").valido === true, "acometida -> tablero_electrico (fuente -> distribución) válido");
assert(App.diagrama.validarReglaElectrica("tablero_electrico", "interruptor_termomagnetico").valido === true, "tablero -> breaker de circuito (distribución -> protección) válido");
assert(App.diagrama.validarReglaElectrica("interruptor_termomagnetico", "luminaria").valido === true, "breaker -> luminaria (protección -> carga) válido");
assert(App.diagrama.validarReglaElectrica("tablero_electrico", "barra_distribucion").valido === true, "tablero -> barra (distribución -> distribución) válido");
assert(App.diagrama.validarReglaElectrica("interruptor_termomagnetico", "contactor").valido === true, "breaker -> contactor (protección -> control, arranque de motor) válido");
assert(App.diagrama.validarReglaElectrica("contactor", "motor").valido === true, "contactor -> motor (control -> carga) válido");

// --- Flujo inverso/absurdo (deben ser inválidos) ---
assert(App.diagrama.validarReglaElectrica("luminaria", "tablero_electrico").valido === false, "luminaria -> tablero (carga no origina nada) inválido");
assert(App.diagrama.validarReglaElectrica("motor", "acometida").valido === false, "motor -> acometida (carga -> fuente, al revés) inválido");

// --- Tipo desconocido ---
const rDesc = App.diagrama.validarReglaElectrica("marciano", "motor");
assert(rDesc.valido === false && rDesc.motivo.includes("desconocido"), "tipo de componente desconocido se rechaza con motivo claro, no crashea");

// --- Integración: validarConexion end-to-end con nodos reales usa la regla semántica ---
const medidorNodo = nodo("medidor", "M1");
const motorNodo = nodo("motor", "Bomba");
const resultado = App.diagrama.crearConexionValidada({ nodoOrigenId: medidorNodo.id, nodoDestinoId: motorNodo.id }, [medidorNodo, motorNodo], []);
assert(resultado.ok === false && resultado.motivo.includes("protección"), `crearConexionValidada end-to-end rechaza medidor->motor con el motivo de la regla (motivo: "${resultado.motivo}")`);

console.log(fallos === 0 ? "\nTODOS LOS CHECKS PASARON" : `\n${fallos} CHECK(S) FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
