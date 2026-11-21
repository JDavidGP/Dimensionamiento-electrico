import { validarIntegridadReferencial } from "../src/modules/validacion/referencial.ts";

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

const proyecto = { id: "proy1", nombre: "Proyecto" };
const equipo = { id: "eq1", circuitoId: "c1", nombre: "Lámpara", valor: 40, cantidad: 1, modoEntrada: "potencia" };

function circuito(representacion) {
  return { id: "c1", nombre: "C1", voltaje: 120, fases: "mono", representacion };
}

function entradaCircuito(lista) {
  return lista.find((e) => e.id === "c1");
}

// --- "ambos" (o sin el campo, compatibilidad con proyectos viejos) advierte en los DOS lados ---
for (const representacion of ["ambos", undefined]) {
  const lista = validarIntegridadReferencial(proyecto, [circuito(representacion)], [equipo], [], [], [], [], []);
  const c = entradaCircuito(lista);
  assert(c.problemas.some((p) => p.includes("sin representar en el diagrama unifilar")), `representacion=${representacion}: advierte sobre el diagrama`);
  assert(c.problemas.some((p) => p.includes("sin representar en el plano")), `representacion=${representacion}: advierte sobre el plano`);
}

// --- "diagrama" SOLO advierte sobre el diagrama, nunca sobre el plano ---
{
  const lista = validarIntegridadReferencial(proyecto, [circuito("diagrama")], [equipo], [], [], [], [], []);
  const c = entradaCircuito(lista);
  assert(c.problemas.some((p) => p.includes("sin representar en el diagrama unifilar")), "representacion=diagrama: SÍ advierte sobre el diagrama");
  assert(!c.problemas.some((p) => p.includes("sin representar en el plano")), "representacion=diagrama: NO advierte sobre el plano");
}

// --- "plano" SOLO advierte sobre el plano, nunca sobre el diagrama ---
{
  const lista = validarIntegridadReferencial(proyecto, [circuito("plano")], [equipo], [], [], [], [], []);
  const c = entradaCircuito(lista);
  assert(!c.problemas.some((p) => p.includes("sin representar en el diagrama unifilar")), "representacion=plano: NO advierte sobre el diagrama");
  assert(c.problemas.some((p) => p.includes("sin representar en el plano")), "representacion=plano: SÍ advierte sobre el plano");
}

// --- "ninguno" no advierte en NINGÚN lado ---
{
  const lista = validarIntegridadReferencial(proyecto, [circuito("ninguno")], [equipo], [], [], [], [], []);
  const c = entradaCircuito(lista);
  assert(!c.problemas.some((p) => p.includes("sin representar en el diagrama unifilar")), "representacion=ninguno: NO advierte sobre el diagrama");
  assert(!c.problemas.some((p) => p.includes("sin representar en el plano")), "representacion=ninguno: NO advierte sobre el plano");
  assert(c.estado === "ok", "representacion=ninguno: el circuito queda en estado 'ok' (el equipo SÍ tiene potencia válida, sin más advertencias)");
}

// --- Si el equipo SÍ está representado, no hay advertencia aunque representacion='ambos' ---
{
  const nodosDiagrama = [{ id: "n1", entidadId: "eq1" }];
  const marcadoresEquipoPlano = [{ id: "m1", entidadId: "eq1" }];
  const lista = validarIntegridadReferencial(proyecto, [circuito("ambos")], [equipo], [], [], nodosDiagrama, [], marcadoresEquipoPlano);
  const c = entradaCircuito(lista);
  assert(!c.problemas.some((p) => p.includes("sin representar")), "Con el equipo YA representado en los dos lados, no hay ninguna advertencia de representación");
}

console.log("\nListo.");
