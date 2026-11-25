/**
 * validation/referencial.ts
 * Fase 1 — Validación de integridad REFERENCIAL.
 *
 * Recorre Project → Circuit → Equipment (modelo plano real de la app)
 * y devuelve una lista PLANA de entradas para la UI.
 *
 * Modelo real:
 *   - proyecto: { id, nombre, ... }
 *   - circuitos: array plano (sin anidar equipos), con tableroId (FK opcional)
 *   - equipos: array plano con circuitoId (FK)
 *   - tableros: array plano (Fase 3) — dato relacional puro, cero gráfico
 *
 * No calcula nada eléctrico aquí — solo estructura y referencias.
 */
import type { Circuito, Equipo, Tablero, FuenteEnergia, Transformador, Diferencial, NodoDiagrama, MarcadorEquipoPlano, Proyecto, Estado } from "./tipos.ts";
import { MAX_CIRCUITOS_POR_DIFERENCIAL } from "../diferencial/index.ts";

const ESTADOS: Record<"OK" | "ADVERTENCIA" | "ERROR", Estado> = { OK: "ok", ADVERTENCIA: "advertencia", ERROR: "error" };

function peorEstado(a: Estado, b: Estado): Estado {
  const rango: Record<Estado, number> = { ok: 0, advertencia: 1, error: 2 };
  return rango[b] > rango[a] ? b : a;
}

export interface Entrada {
  id: string;
  tipo: "tablero" | "circuito" | "equipo" | "fuenteEnergia" | "transformador" | "diferencial";
  nombre: string;
  parentId: string | null | undefined;
  estado: Estado;
  resumen: string;
  problemas: string[];
}

function crearEntrada({ id, tipo, nombre, parentId, estado, resumen, problemas }: Entrada): Entrada {
  return {
    id,
    tipo, // "tablero" | "circuito" | "equipo"
    nombre,
    parentId,
    estado, // "ok" | "advertencia" | "error"
    resumen,
    problemas, // string[]
  };
}

function resumenCargaEquipo(equipo: Equipo): string {
  if (equipo.modoEntrada === "corriente" && equipo.valor != null) {
    return `${equipo.valor} A × ${equipo.cantidad ?? 1}`;
  }
  if (equipo.valor != null) {
    return `${equipo.valor} W × ${equipo.cantidad ?? 1}`;
  }
  return "sin datos de carga";
}

function validarEquipo(equipo: Equipo, circuito: Circuito | null | undefined, idsVistos: Set<string>): Entrada {
  const problemas: string[] = [];
  let estado: Estado = ESTADOS.OK;

  if (idsVistos.has(equipo.id)) {
    problemas.push("ID duplicado en el proyecto");
    estado = ESTADOS.ERROR;
  }
  idsVistos.add(equipo.id);

  if (!equipo.circuitoId) {
    problemas.push("Sin circuitoId (equipo huérfano)");
    estado = ESTADOS.ERROR;
  } else if (circuito && equipo.circuitoId !== circuito.id) {
    problemas.push(
      `Referencia cruzada: apunta a circuito ${equipo.circuitoId}, pero se validó bajo ${circuito.id}`
    );
    estado = ESTADOS.ERROR;
  }

  if (equipo.valor == null || !(Number(equipo.valor) > 0)) {
    problemas.push(
      equipo.modoEntrada === "corriente"
        ? "Sin corriente unitaria válida"
        : "Sin potencia unitaria válida"
    );
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  if (!equipo.nombre || !String(equipo.nombre).trim()) {
    problemas.push("Nombre vacío");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  if (!(Number(equipo.cantidad) >= 1)) {
    problemas.push("Cantidad inválida (< 1)");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  return crearEntrada({
    id: equipo.id,
    tipo: "equipo",
    nombre: equipo.nombre || equipo.id,
    parentId: equipo.circuitoId || null,
    estado,
    resumen: resumenCargaEquipo(equipo),
    problemas,
  });
}

function validarCircuito(
  circuito: Circuito,
  equiposDelCircuito: Equipo[],
  proyecto: Proyecto,
  idsVistos: Set<string>,
  tableros: Tablero[] = [],
  nodosDiagrama: NodoDiagrama[] = [],
  marcadoresEquipoPlano: MarcadorEquipoPlano[] = [],
  diferenciales: Diferencial[] = []
): Entrada[] {
  const problemas: string[] = [];
  let estado: Estado = ESTADOS.OK;

  if (idsVistos.has(circuito.id)) {
    problemas.push("ID duplicado en el proyecto");
    estado = ESTADOS.ERROR;
  }
  idsVistos.add(circuito.id);

  // tableroId es opcional (Fase 3 recién agregada) — un circuito sin
  // tablero asignado NO es un error, solo no está agrupado todavía.
  if (circuito.tableroId) {
    const tableroExiste = tableros.some((t) => t.id === circuito.tableroId);
    if (!tableroExiste) {
      problemas.push(`Referencia a tablero inexistente (${circuito.tableroId})`);
      estado = ESTADOS.ERROR;
    }
  }

  // diferencialId es opcional (REBT ITC-BT-25) — mismo criterio que tableroId.
  if (circuito.diferencialId) {
    const diferencialExiste = diferenciales.some((d) => d.id === circuito.diferencialId);
    if (!diferencialExiste) {
      problemas.push(`Referencia a diferencial inexistente (${circuito.diferencialId})`);
      estado = ESTADOS.ERROR;
    }
  }

  if (equiposDelCircuito.length === 0) {
    problemas.push("Sin equipos asignados");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  if (circuito.tipo === "dedicado" && equiposDelCircuito.length > 1) {
    problemas.push(
      "Marcado como dedicado pero tiene más de un equipo (recomendación: cambiar a mixto o separar)"
    );
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  if (!circuito.nombre || !String(circuito.nombre).trim()) {
    problemas.push("Nombre vacío");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  if (!(Number(circuito.voltaje) > 0)) {
    problemas.push("Voltaje no definido o inválido");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  if (!circuito.fases) {
    problemas.push("Fases no asignadas");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  const entradaCircuito = crearEntrada({
    id: circuito.id,
    tipo: "circuito",
    nombre: circuito.nombre || circuito.id,
    parentId: circuito.tableroId || proyecto.id,
    estado,
    resumen: `${equiposDelCircuito.length} equipo(s)`,
    problemas,
  });

  const entradasEquipos = equiposDelCircuito.map((eq) =>
    validarEquipo(eq, circuito, idsVistos)
  );

  // El estado del circuito hereda el peor de sus equipos
  entradasEquipos.forEach((e) => {
    entradaCircuito.estado = peorEstado(entradaCircuito.estado, e.estado);
  });

  // Caso inverso de la sincronización diagrama↔tabla (ARCHITECTURE.md
  // §9): qué equipos de este circuito TODAVÍA no tienen un nodo en el
  // diagrama unifilar apuntándolos (nodo.entidadId === equipo.id). Se
  // reporta acá, a nivel circuito (no por equipo individual) porque hoy
  // no hay una fila de UI por equipo donde mostrarlo — TablaResultados
  // ya muestra los `problemas` del circuito, así que esto se ve sin
  // construir una pantalla nueva. Es ADVERTENCIA, no error: un equipo
  // sin dibujar en el diagrama sigue siendo un dato de cálculo válido.
  //
  // Gateado por `circuito.representacion` (pedido explícito del
  // usuario, 2026-11-20 — ver REPRESENTACION_CIRCUITO en shared/
  // constants/constantes.js): un circuito marcado "plano" o "ninguno"
  // no necesita (ni debería advertir sobre) un nodo en el diagrama —
  // PURAMENTE informativo, nunca bloquea vincular/colocar igual si el
  // usuario quiere. Default "ambos" para no cambiar el comportamiento
  // de un proyecto guardado antes de que este campo existiera.
  const representacion = circuito.representacion || "ambos";
  const quiereDiagrama = representacion === "diagrama" || representacion === "ambos";
  const quierePlano = representacion === "plano" || representacion === "ambos";

  if (quiereDiagrama) {
    const equiposSinRepresentarDiagrama = equiposDelCircuito.filter(
      (eq) => !nodosDiagrama.some((n) => n.entidadId === eq.id)
    );
    if (equiposSinRepresentarDiagrama.length > 0) {
      const nombres = equiposSinRepresentarDiagrama.map((e) => e.nombre || e.id).join(", ");
      entradaCircuito.problemas.push(
        `${equiposSinRepresentarDiagrama.length} equipo(s) sin representar en el diagrama unifilar: ${nombres}`
      );
      entradaCircuito.estado = peorEstado(entradaCircuito.estado, ESTADOS.ADVERTENCIA);
    }
  }

  // Mismo caso, simétrico, para el Plano inteligente (marcadores de
  // equipo con `entidadId` apuntando al equipo — ver modules/plano/index.js).
  if (quierePlano) {
    const equiposSinRepresentarPlano = equiposDelCircuito.filter(
      (eq) => !marcadoresEquipoPlano.some((m) => m.entidadId === eq.id)
    );
    if (equiposSinRepresentarPlano.length > 0) {
      const nombres = equiposSinRepresentarPlano.map((e) => e.nombre || e.id).join(", ");
      entradaCircuito.problemas.push(
        `${equiposSinRepresentarPlano.length} equipo(s) sin representar en el plano: ${nombres}`
      );
      entradaCircuito.estado = peorEstado(entradaCircuito.estado, ESTADOS.ADVERTENCIA);
    }
  }

  return [entradaCircuito, ...entradasEquipos];
}

function validarTablero(
  tablero: Tablero,
  circuitos: Circuito[],
  idsVistos: Set<string>,
  proyectoId: string | undefined,
  tableros: Tablero[] = [],
  fuentesEnergia: FuenteEnergia[] = [],
  nodosDiagrama: NodoDiagrama[] = [],
  transformadores: Transformador[] = []
): Entrada {
  const problemas: string[] = [];
  let estado: Estado = ESTADOS.OK;

  if (idsVistos.has(tablero.id)) {
    problemas.push("ID duplicado en el proyecto");
    estado = ESTADOS.ERROR;
  }
  idsVistos.add(tablero.id);

  const circuitosAsociados = circuitos.filter((c) => c.tableroId === tablero.id);
  if (circuitosAsociados.length === 0) {
    problemas.push("Sin circuitos asociados");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  // tableroPadreId es opcional: null significa alimentado directo de la
  // acometida/poste, no de otro tablero — no es un error. Puede
  // apuntar a OTRO tablero, a una fuente de energía (Batería/
  // Generador, ver modules/origen/fuentesEnergia.js) o a un
  // Transformador (ver modules/motor/transformador.js, origen
  // seleccionable solo en instalaciones industriales) — mismo campo,
  // tres catálogos posibles a buscar (ver OrigenMediator.resolver).
  // NO se valida la cadena hacia arriba (ciclos) todavía — es el
  // siguiente paso, no esta sesión.
  if (tablero.tableroPadreId) {
    if (tablero.tableroPadreId === tablero.id) {
      problemas.push("Tablero padre apunta a sí mismo");
      estado = ESTADOS.ERROR;
    } else if (
      !tableros.some((t) => t.id === tablero.tableroPadreId) &&
      !fuentesEnergia.some((f) => f.id === tablero.tableroPadreId) &&
      !transformadores.some((tr) => tr.id === tablero.tableroPadreId)
    ) {
      problemas.push(`Referencia a tablero padre, fuente de energía o transformador inexistente (${tablero.tableroPadreId})`);
      estado = ESTADOS.ERROR;
    }
  }

  // Esquema de conmutación (DOCUMENTAL, ver modules/origen/conmutacion.js)
  // — mismo chequeo que tableroPadreId: "acometida" y "" (ninguna) son
  // siempre válidos; cualquier otro valor debe ser una fuente real.
  if (tablero.conmutacion?.activa) {
    const camposFuente: [string, string | null | undefined][] = [
      ["fuentePrincipalId", tablero.conmutacion.fuentePrincipalId],
      ["fuenteSecundariaId", tablero.conmutacion.fuenteSecundariaId],
      ["fuenteAuxiliarId", tablero.conmutacion.fuenteAuxiliarId],
    ];
    for (const [campo, valor] of camposFuente) {
      if (valor && valor !== "acometida" && !fuentesEnergia.some((f) => f.id === valor)) {
        problemas.push(`Conmutación: ${campo} referencia una fuente de energía inexistente (${valor})`);
        estado = ESTADOS.ERROR;
      }
    }
  }

  // Caso inverso de la sincronización diagrama↔tabla — ver nota igual en validarCircuito.
  if (!nodosDiagrama.some((n) => n.entidadId === tablero.id)) {
    problemas.push("Sin representar en el diagrama unifilar");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  return crearEntrada({
    id: tablero.id,
    tipo: "tablero",
    nombre: tablero.nombre || tablero.id,
    parentId: proyectoId,
    estado,
    resumen: `${circuitosAsociados.length} circuito(s)`,
    problemas,
  });
}

/**
 * Fuente de energía (Batería/Generador) como entrada propia de
 * integridad — agregado cuando PanelFuentesEnergia.jsx le dio una lista
 * propia en la UI (antes no tenía dónde mostrarse, ver el commit del
 * caso inverso de la sincronización diagrama↔tabla). Chequeo mínimo,
 * mismo criterio que tablero/circuito/equipo: ID duplicado (error) y
 * representación en el diagrama (advertencia) — nada más se valida de
 * una fuenteEnergia hoy (capacidadKW/notas son libres, no tienen regla).
 */
function validarFuenteEnergia(fuente: FuenteEnergia, idsVistos: Set<string>, proyectoId: string | undefined, nodosDiagrama: NodoDiagrama[] = []): Entrada {
  const problemas: string[] = [];
  let estado: Estado = ESTADOS.OK;

  if (idsVistos.has(fuente.id)) {
    problemas.push("ID duplicado en el proyecto");
    estado = ESTADOS.ERROR;
  }
  idsVistos.add(fuente.id);

  if (!nodosDiagrama.some((n) => n.entidadId === fuente.id)) {
    problemas.push("Sin representar en el diagrama unifilar");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  return crearEntrada({
    id: fuente.id,
    tipo: "fuenteEnergia",
    nombre: fuente.nombre || fuente.id,
    parentId: proyectoId,
    estado,
    resumen: fuente.tipo ?? "",
    problemas,
  });
}

/**
 * Transformador como entrada propia de integridad — mismo criterio y
 * mismos 2 chequeos que validarFuenteEnergia (ID duplicado, representación
 * en el diagrama), agregado cuando Transformador recibió su propia lista
 * en la UI (PanelTransformadores.jsx, mismo patrón que PanelFuentesEnergia).
 * Capacidad/conexiones/%Z siguen sin campo de UI (ver TRANSFORMADOR_VACIO),
 * así que no hay nada más que validar todavía.
 */
function validarTransformador(transformador: Transformador, idsVistos: Set<string>, proyectoId: string | undefined, nodosDiagrama: NodoDiagrama[] = []): Entrada {
  const problemas: string[] = [];
  let estado: Estado = ESTADOS.OK;

  if (idsVistos.has(transformador.id)) {
    problemas.push("ID duplicado en el proyecto");
    estado = ESTADOS.ERROR;
  }
  idsVistos.add(transformador.id);

  if (!nodosDiagrama.some((n) => n.entidadId === transformador.id)) {
    problemas.push("Sin representar en el diagrama unifilar");
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  return crearEntrada({
    id: transformador.id,
    tipo: "transformador",
    nombre: transformador.nombre || transformador.id,
    parentId: proyectoId,
    estado,
    resumen: `${transformador.fases}${transformador.tensionPrimariaV && transformador.tensionSecundariaV ? ` · ${transformador.tensionPrimariaV}V→${transformador.tensionSecundariaV}V` : ""}`,
    problemas,
  });
}

/**
 * Diferencial (ID) como entrada propia de integridad — REBT ITC-BT-25.
 * Mismo criterio que validarTransformador (ID duplicado, representación
 * en el diagrama) + el chequeo propio de esta entidad: más de
 * MAX_CIRCUITOS_POR_DIFERENCIAL (5, cita exacta "garantizando un máximo
 * de cinco circuitos por cada diferencial") es ADVERTENCIA, no error —
 * un dato a corregir, no un dato roto (el proyecto sigue siendo válido
 * mientras se reparte en más diferenciales).
 */
function validarDiferencial(diferencial: Diferencial, circuitos: Circuito[], idsVistos: Set<string>, proyectoId: string | undefined): Entrada {
  const problemas: string[] = [];
  let estado: Estado = ESTADOS.OK;

  if (idsVistos.has(diferencial.id)) {
    problemas.push("ID duplicado en el proyecto");
    estado = ESTADOS.ERROR;
  }
  idsVistos.add(diferencial.id);

  const circuitosAsociados = circuitos.filter((c) => c.diferencialId === diferencial.id);
  if (circuitosAsociados.length > MAX_CIRCUITOS_POR_DIFERENCIAL) {
    problemas.push(
      `Agrupa ${circuitosAsociados.length} circuitos — ITC-BT-25 garantiza un máximo de ${MAX_CIRCUITOS_POR_DIFERENCIAL} circuitos por diferencial, repartir en más de uno`
    );
    estado = peorEstado(estado, ESTADOS.ADVERTENCIA);
  }

  // Sin chequeo de "representado en el diagrama unifilar" a propósito
  // — mismo criterio que el propio Circuito (soloPlano, ver bibliotecaComponentes.js):
  // ninguno de los dos tiene un tipo de nodo en el diagrama, solo marcador en el Plano.

  return crearEntrada({
    id: diferencial.id,
    tipo: "diferencial",
    nombre: diferencial.nombre || diferencial.id,
    parentId: proyectoId,
    estado,
    resumen: `${circuitosAsociados.length} circuito(s) · ${diferencial.sensibilidadMA ?? 30}mA`,
    problemas,
  });
}

/**
 * Punto de entrada de Fase 1 (+ Fase 3, Tablero).
 * @param proyecto - metadatos del proyecto ({ id, nombre, ... })
 * @param circuitos - array plano de circuitos
 * @param equipos   - array plano de equipos (con circuitoId)
 * @param tableros  - array plano de tableros (con id, nombre...)
 * @param fuentesEnergia - array plano de fuentes de energía (Batería/Generador)
 * @param nodosDiagrama - array plano de nodos del diagrama unifilar (con entidadId) — caso inverso de la sincronización, ver ARCHITECTURE.md §9
 * @param transformadores - array plano de transformadores (ver modules/motor/transformador.js) — origen seleccionable solo en instalaciones industriales
 * @param marcadoresEquipoPlano - marcadores de equipo del plano (con entidadId) — caso inverso simétrico al de nodosDiagrama, ver modules/plano/index.js
 * @param diferenciales - array plano de diferenciales (REBT ITC-BT-25, ver modules/diferencial/index.ts) — agrupación opcional de hasta 5 circuitos
 * @returns lista plana de entradas para la UI
 */
export function validarIntegridadReferencial(
  proyecto: Proyecto | null | undefined,
  circuitos: Circuito[] = [],
  equipos: Equipo[] = [],
  tableros: Tablero[] = [],
  fuentesEnergia: FuenteEnergia[] = [],
  nodosDiagrama: NodoDiagrama[] = [],
  transformadores: Transformador[] = [],
  marcadoresEquipoPlano: MarcadorEquipoPlano[] = [],
  diferenciales: Diferencial[] = []
): Entrada[] {
  const idsVistos = new Set<string>();
  const entradas: Entrada[] = [];
  const proj: Proyecto = proyecto || { id: "proyecto" };
  // Compatibilidad: si alguien todavía anida tableros en proyecto.tableros
  // en vez de pasarlos explícitos, se siguen aceptando.
  const listaTableros = tableros.length > 0 ? tableros : proj.tableros || [];

  listaTableros.forEach((t) => {
    entradas.push(validarTablero(t, circuitos, idsVistos, proj.id, listaTableros, fuentesEnergia, nodosDiagrama, transformadores));
  });

  fuentesEnergia.forEach((f) => {
    entradas.push(validarFuenteEnergia(f, idsVistos, proj.id, nodosDiagrama));
  });

  transformadores.forEach((tr) => {
    entradas.push(validarTransformador(tr, idsVistos, proj.id, nodosDiagrama));
  });

  diferenciales.forEach((d) => {
    entradas.push(validarDiferencial(d, circuitos, idsVistos, proj.id));
  });

  circuitos.forEach((c) => {
    const equiposDelCircuito = equipos.filter((e) => e.circuitoId === c.id);
    entradas.push(...validarCircuito(c, equiposDelCircuito, proj, idsVistos, listaTableros, nodosDiagrama, marcadoresEquipoPlano, diferenciales));
  });

  // Equipos huérfanos (circuitoId que no existe)
  const idsCircuitos = new Set(circuitos.map((c) => c.id));
  equipos.forEach((eq) => {
    if (eq.circuitoId && !idsCircuitos.has(eq.circuitoId)) {
      if (!idsVistos.has(eq.id)) {
        idsVistos.add(eq.id);
        entradas.push(
          crearEntrada({
            id: eq.id,
            tipo: "equipo",
            nombre: eq.nombre || eq.id,
            parentId: eq.circuitoId,
            estado: ESTADOS.ERROR,
            resumen: resumenCargaEquipo(eq),
            problemas: [`Apunta a circuito inexistente (${eq.circuitoId})`],
          })
        );
      }
    }
  });

  return entradas;
}

export { ESTADOS, peorEstado };
