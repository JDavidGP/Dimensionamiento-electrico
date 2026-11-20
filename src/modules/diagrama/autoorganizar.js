// src/modules/diagrama/autoorganizar.js
//
// Autoorganización del diagrama unifilar (usuario, 2026-11-20, segundo
// pedido de su lista para el diagrama, después del PDF embebido):
// acomoda los nodos en niveles (capas) según su distancia a la fuente
// más cercana, siguiendo el sentido de las conexiones — así el dibujo
// queda ordenado de arriba (acometida/fuentes) hacia abajo (cargas),
// que es como se lee cualquier diagrama unifilar real. NUNCA se dispara
// solo: el instalador lo pide con un botón, puede seguir moviendo
// nodos a mano después (esto no "bloquea" el posicionamiento manual).
//
// Algoritmo: capa de cada nodo = camino MÁS LARGO desde un nodo raíz
// (sin conexiones entrantes) — layout de grafo dirigido en capas,
// estándar (mismo principio que Sugiyama/jerárquico). Un nodo con dos
// padres de profundidad distinta queda bajo el MÁS profundo de los
// dos, nunca se superpone a ninguno de sus ancestros. Iterativo (no
// recursivo) para no desbordar con proyectos grandes. Un ciclo (no
// debería darse en un diagrama unifilar real, pero no se asume) no
// traba el cálculo: el/los nodo(s) que nunca "liberan" sus entradas
// pendientes simplemente quedan en el nivel 0, no se inventa nada para
// ellos.
//
// Módulo puro — se usa a través de DiagramaMediator. Devuelve
// POSICIONES nuevas (nodoId -> {x,y}); nunca muta `nodos`, ni decide
// cómo se guardan — eso es el hook, igual criterio que el resto de los
// módulos de dominio.

/**
 * @param {object[]} nodos - [{id, ...}]
 * @param {object[]} conexiones - [{nodoOrigenId, nodoDestinoId}]
 * @param {{anchoCelda?: number, altoCelda?: number, margenX?: number, margenY?: number}} [opciones]
 * @returns {Object<string, {x:number, y:number}>}
 */
export function autoorganizarNodos(nodos = [], conexiones = [], opciones = {}) {
  const anchoCelda = opciones.anchoCelda ?? 150;
  const altoCelda = opciones.altoCelda ?? 125;
  const margenX = opciones.margenX ?? 40;
  const margenY = opciones.margenY ?? 20;

  if (nodos.length === 0) return {};

  const idsValidos = new Set(nodos.map((n) => n.id));
  const entradasPendientes = new Map(nodos.map((n) => [n.id, 0]));
  const salientesDe = new Map(nodos.map((n) => [n.id, []]));
  for (const c of conexiones) {
    // Referencia rota (nodo inexistente) — ya la reporta integridad
    // referencial; acá simplemente se ignora, no se inventa un nodo.
    if (!idsValidos.has(c.nodoOrigenId) || !idsValidos.has(c.nodoDestinoId)) continue;
    entradasPendientes.set(c.nodoDestinoId, (entradasPendientes.get(c.nodoDestinoId) ?? 0) + 1);
    salientesDe.get(c.nodoOrigenId).push(c.nodoDestinoId);
  }

  const nivelDe = new Map();
  const pendientesRestantes = new Map(entradasPendientes);
  let cola = nodos.filter((n) => (entradasPendientes.get(n.id) ?? 0) === 0).map((n) => n.id);
  const visitados = new Set(cola);
  cola.forEach((id) => nivelDe.set(id, 0));

  while (cola.length > 0) {
    const siguienteCola = [];
    for (const id of cola) {
      for (const destinoId of salientesDe.get(id) ?? []) {
        pendientesRestantes.set(destinoId, (pendientesRestantes.get(destinoId) ?? 0) - 1);
        const nivelPropuesto = (nivelDe.get(id) ?? 0) + 1;
        nivelDe.set(destinoId, Math.max(nivelDe.get(destinoId) ?? 0, nivelPropuesto));
        if (pendientesRestantes.get(destinoId) <= 0 && !visitados.has(destinoId)) {
          visitados.add(destinoId);
          siguienteCola.push(destinoId);
        }
      }
    }
    cola = siguienteCola;
  }
  // Nodos nunca alcanzados (parte de un ciclo) quedan en el nivel 0 —
  // mismo criterio de "no inventar" que el resto de la app.
  nodos.forEach((n) => {
    if (!nivelDe.has(n.id)) nivelDe.set(n.id, 0);
  });

  // Agrupados por nivel, en el mismo orden relativo que ya traían (lista
  // `nodos` estable) — reordenar la vista no debería "barajar" la
  // topología sin motivo.
  const idsPorNivel = new Map();
  nodos.forEach((n) => {
    const lv = nivelDe.get(n.id);
    if (!idsPorNivel.has(lv)) idsPorNivel.set(lv, []);
    idsPorNivel.get(lv).push(n.id);
  });

  const posiciones = {};
  for (const [lv, ids] of idsPorNivel) {
    ids.forEach((id, i) => {
      posiciones[id] = { x: margenX + i * anchoCelda, y: margenY + lv * altoCelda };
    });
  }
  return posiciones;
}
