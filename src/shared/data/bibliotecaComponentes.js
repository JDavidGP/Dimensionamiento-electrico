// Biblioteca de componentes del diagrama unifilar — catálogo de tipos
// de símbolo que un nodo del diagrama puede tener. Pedido explícito
// del usuario (spec larga de "Diagrama unifilar", 2026-11-20): FASE 1
// ("lo necesario") es solo el catálogo como DATOS — id, nombre,
// categoría, puntos de conexión (cardinalidad) y a qué ENTIDAD YA
// EXISTENTE del sistema se vincula, si alguna. NO incluye todavía:
// representación SVG (Motor de dibujo), reglas de conexión semánticas
// más allá de la cardinalidad básica (Motor de reglas eléctricas), ni
// posicionamiento automático (Motor de autoorganización) — esos son
// "los detalles", para después.
//
// DECISIÓN DE ARQUITECTURA (siguiendo el "Modelo canónico" ya
// documentado en ARCHITECTURE.md §9, "anti-bucle tabla ↔ diagrama"):
// el diagrama es una VISTA sobre el modelo canónico (circuitos,
// equipos, tableros, fuentesEnergia), NO una copia paralela de los
// datos eléctricos. Por eso cada tipo de componente que YA tiene una
// entidad propia en el sistema (`entidadVinculada`) debe, cuando se
// use, REFERENCIAR esa entidad por id (ver modules/diagrama/index.js,
// campo `entidadId` de un nodo) en vez de duplicar sus datos
// eléctricos en el nodo. Los tipos sin entidad vinculada (protecciones,
// control) son nodos puramente de diagrama por ahora — documentan la
// topología, no alimentan ningún cálculo todavía (mismo criterio ya
// usado para fuentesEnergia/conmutación: registrar primero, calcular
// después, cuando haya un proyecto real que lo necesite).
//
// `puntosConexion.entradas`/`.salidas`: cardinalidad máxima de
// conductores que pueden llegar/salir de este tipo de nodo. Infinity =
// sin límite práctico (ej. una barra de distribución). Es la base de
// la única regla de conexión que SÍ se valida ya en Fase 1 (ver
// validarConexion en modules/diagrama/index.js) — el resto de las
// reglas semánticas que pidió el usuario ("un tomacorriente no puede
// alimentar un tablero", "los paneles solares deben ir a un inversor")
// son Fase 2, necesitan un motor de reglas por PAR de tipos, no solo
// cardinalidad.

export const CATEGORIAS_COMPONENTE = {
  FUENTE: "fuente",
  MEDICION_PROTECCION: "medicion_proteccion",
  DISTRIBUCION: "distribucion",
  CARGA: "carga",
  CONTROL: "control",
};

export const CATALOGO_COMPONENTES = [
  // --- Fuente ---
  { id: "acometida", nombre: "Acometida", categoria: "fuente", puntosConexion: { entradas: 0, salidas: 1 }, entidadVinculada: null },
  { id: "transformador", nombre: "Transformador", categoria: "fuente", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: "transformador" },
  { id: "generador", nombre: "Generador", categoria: "fuente", puntosConexion: { entradas: 0, salidas: 1 }, entidadVinculada: "fuenteEnergia" },
  { id: "banco_baterias", nombre: "Banco de baterías", categoria: "fuente", puntosConexion: { entradas: 0, salidas: 1 }, entidadVinculada: "fuenteEnergia" },
  // Sin TIPOS_FUENTE_ENERGIA.FOTOVOLTAICO todavía (solo bateria/generador,
  // ver modules/origen/fuentesEnergia.js) — por ahora sin entidad vinculada,
  // no se inventa un tipo que el resto del sistema no reconoce todavía.
  { id: "panel_fotovoltaico", nombre: "Panel fotovoltaico", categoria: "fuente", puntosConexion: { entradas: 0, salidas: 1 }, entidadVinculada: null },

  // --- Medición y protección ---
  { id: "medidor", nombre: "Medidor", categoria: "medicion_proteccion", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },
  { id: "interruptor_principal", nombre: "Interruptor principal", categoria: "medicion_proteccion", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },
  { id: "interruptor_termomagnetico", nombre: "Interruptor termomagnético", categoria: "medicion_proteccion", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },
  { id: "interruptor_diferencial", nombre: "Interruptor diferencial", categoria: "medicion_proteccion", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },
  // Diferencial (ID) — usuario, 2026-11-25 (REBT ITC-BT-25): "El
  // diferencial se supone que agrupa x cantidad de PIA según
  // normativa... así que supongo que si debería tener su propio
  // marcador en el plano". Distinto de "interruptor_diferencial" arriba
  // (ese es puramente decorativo, sin entidad, pensado para dibujar un
  // diferencial cualquiera en el Diagrama unifilar): ESTE representa el
  // diferencial REAL (ver modules/diferencial/index.ts), vinculado por
  // `entidadId` — mismo patrón que "circuito" (soloPlano, se coloca y
  // mueve como pieza propia). Agrupa hasta MAX_CIRCUITOS_POR_DIFERENCIAL
  // circuitos. REBT únicamente — la entidad en sí (y su UI de creación)
  // queda gateada a IEC_ES, NEC/CIEN no tienen este concepto de
  // agrupación.
  { id: "diferencial", nombre: "Diferencial (ID)", categoria: "medicion_proteccion", puntosConexion: { entradas: 1, salidas: Infinity }, entidadVinculada: "diferencial", soloPlano: true },
  { id: "spd", nombre: "Protector contra sobretensiones (SPD)", categoria: "medicion_proteccion", puntosConexion: { entradas: 1, salidas: 0 }, entidadVinculada: null },
  { id: "fusible", nombre: "Fusible", categoria: "medicion_proteccion", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },

  // --- Distribución ---
  { id: "tablero_electrico", nombre: "Tablero eléctrico", categoria: "distribucion", puntosConexion: { entradas: 1, salidas: Infinity }, entidadVinculada: "tablero" },
  { id: "barra_distribucion", nombre: "Barra de distribución", categoria: "distribucion", puntosConexion: { entradas: Infinity, salidas: Infinity }, entidadVinculada: null },
  // Caja de empalme — usuario, 2026-11-24: "son como referencia de
  // donde y como se conecta cada cosa en una instalación", sobre todo
  // en residencial (industrial/comercial trabaja más directo
  // tablero→subtablero→consumidor). NO es un concepto eléctrico (sin
  // carga, sin breaker) — es puramente físico/de ruteo, por eso
  // entidadVinculada siempre null, nunca se vincula a nada. `soloPlano`
  // la saca del editor de Diagrama unifilar (ver
  // componentesPorCategoriaDiagrama más abajo): ahí no pidió esto el
  // usuario y el concepto no aporta nada a la topología eléctrica que
  // ese diagrama representa.
  { id: "caja_empalme", nombre: "Caja de empalme", categoria: "distribucion", puntosConexion: { entradas: Infinity, salidas: Infinity }, entidadVinculada: null, soloPlano: true },
  // Puesta a tierra — usuario, 2026-11-27, cerrando la lista de lo
  // esencial que un electricista necesita ver en el Plano ("tablero o
  // tableros eléctricos, puesta a tierra que se me olvidó, caja de
  // empalme, toma corriente y los puntos de luz con sus interruptores").
  // Igual criterio que "Caja de empalme"/"Fuente de agua": puramente
  // físico (sin carga, sin breaker), nunca se vincula a ninguna
  // entidad — `soloPlano` a propósito, no aporta nada a la topología
  // eléctrica del Diagrama unifilar.
  { id: "puesta_tierra", nombre: "Puesta a tierra", categoria: "distribucion", puntosConexion: { entradas: 1, salidas: 0 }, entidadVinculada: null, soloPlano: true },
  // Fuente de agua (bañera/ducha) — usuario, 2026-11-26, continuando
  // REBT ITC-BT-27 (volúmenes de seguridad del baño): referencia
  // puramente física (sin carga, sin breaker, nunca se vincula a una
  // entidad), igual criterio que "Caja de empalme" — su único dato
  // propio es `radioVolumen1M` (ver modules/plano/volumenesBano.ts),
  // editado directo sobre el marcador. `soloPlano` a propósito: no
  // aporta nada a la topología eléctrica del Diagrama unifilar.
  { id: "fuente_agua", nombre: "Fuente de agua (bañera/ducha)", categoria: "distribucion", puntosConexion: { entradas: 0, salidas: 0 }, entidadVinculada: null, soloPlano: true },
  // Circuito (PIA) — usuario, 2026-11-25: "la representación de los
  // circuitos en sí... no [están] los circuitos individuales que
  // realmente quiero mover en el plano". Hasta ahora un Circuito, como
  // entidad, no tenía NINGÚN marcador propio — solo se veían sus
  // equipos sueltos (ver "Generar circuito" arriba). Este marcador
  // representa el PIA de un circuito real, vinculado por `entidadId`
  // (mismo patrón que tablero_electrico, no uno nuevo) — se puede
  // colocar y mover como una pieza propia, típicamente cerca de su
  // tablero. `soloPlano` a propósito: el Diagrama unifilar sigue sin
  // un nodo por circuito (los equipos se conectan directo al tablero
  // ahí) — cambiar ESO es un alcance más grande (cardinalidad 1→N real
  // en vez de genérica), que queda aparte.
  { id: "circuito", nombre: "Circuito (PIA)", categoria: "distribucion", puntosConexion: { entradas: 1, salidas: Infinity }, entidadVinculada: "circuito", soloPlano: true },

  // --- Carga ---
  { id: "contacto", nombre: "Contacto (tomacorriente)", categoria: "carga", puntosConexion: { entradas: 1, salidas: 0 }, entidadVinculada: "equipo" },
  { id: "interruptor", nombre: "Interruptor", categoria: "carga", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },
  // Interruptor conmutado (3 vías) — usuario, 2026-11-25: "generar el
  // símbolo del interruptor conmutado junto el punto de luz que
  // controla, para ubicar geográficamente los interruptores conmutados
  // junto su punto de luz". El vínculo real (qué luminaria controla
  // CADA interruptor) vive en el marcador (MarcadorEquipoPlano.
  // controlaMarcadorId, ver modules/plano/tipos.ts) — este catálogo
  // solo da el símbolo. entidadVinculada: null, igual que "interruptor"
  // (un interruptor no es un "equipo" con carga propia en el sistema).
  { id: "interruptor_conmutado", nombre: "Interruptor conmutado (3 vías)", categoria: "carga", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },
  { id: "luminaria", nombre: "Luminaria", categoria: "carga", puntosConexion: { entradas: 1, salidas: 0 }, entidadVinculada: "equipo" },
  // Variantes de luminaria SOLO por cómo se controla (usuario,
  // 2026-11-23) — puramente documental/visual, ningún cálculo cambia
  // según cuál sea: "conmutada" = 2 puntos de control (ej. escalera);
  // "cascada" = una cadena de conmutados donde cada uno intermedio
  // deriva a SU propia luz o sigue la cadena, cerrando con un
  // interruptor sencillo en cada extremo — el cableado real entre
  // interruptores NO se modela como conexiones del diagrama (rompería
  // la cardinalidad simple fuente→tablero→carga del resto de la app
  // para algo que no alimenta ningún cálculo); el símbolo distinto ya
  // avisa que ese grupo tiene un esquema de control distinto a
  // "interruptor sencillo" (que reusa el símbolo de luminaria común).
  { id: "luminaria_conmutada", nombre: "Luminaria (conmutada)", categoria: "carga", puntosConexion: { entradas: 1, salidas: 0 }, entidadVinculada: "equipo" },
  { id: "luminaria_cascada", nombre: "Luminaria (cascada)", categoria: "carga", puntosConexion: { entradas: 1, salidas: 0 }, entidadVinculada: "equipo" },
  { id: "motor", nombre: "Motor", categoria: "carga", puntosConexion: { entradas: 1, salidas: 0 }, entidadVinculada: "equipo" },
  { id: "carga_especial", nombre: "Carga especial", categoria: "carga", puntosConexion: { entradas: 1, salidas: 0 }, entidadVinculada: "equipo" },

  // --- Control ---
  { id: "inversor", nombre: "Inversor", categoria: "control", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },
  { id: "variador_frecuencia", nombre: "Variador de frecuencia", categoria: "control", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },
  { id: "plc", nombre: "PLC", categoria: "control", puntosConexion: { entradas: Infinity, salidas: Infinity }, entidadVinculada: null },
  { id: "rele", nombre: "Relé", categoria: "control", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },
  { id: "contactor", nombre: "Contactor", categoria: "control", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },
  { id: "bobina", nombre: "Bobina", categoria: "control", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },
  { id: "sensor", nombre: "Sensor", categoria: "control", puntosConexion: { entradas: 0, salidas: 1 }, entidadVinculada: null },
];

export function obtenerComponente(tipoId) {
  return CATALOGO_COMPONENTES.find((c) => c.id === tipoId) ?? null;
}

export function componentesPorCategoria() {
  const mapa = {};
  for (const c of CATALOGO_COMPONENTES) {
    (mapa[c.categoria] ??= []).push(c);
  }
  return mapa;
}

/** Igual que componentesPorCategoria(), pero sin los tipos `soloPlano` (ej. caja de empalme) — para el editor de Diagrama unifilar, que no los necesita. */
export function componentesPorCategoriaDiagrama() {
  const mapa = {};
  for (const c of CATALOGO_COMPONENTES) {
    if (c.soloPlano) continue;
    (mapa[c.categoria] ??= []).push(c);
  }
  return mapa;
}

// "Colocar equipo" en el Plano (usuario, 2026-11-27, cerrando la
// discusión sobre qué símbolos merece ver un electricista: "en el
// plano solo se observará tomacorrientes, puntos de luces con sus
// interruptores y motores" + la lista final — tablero, puesta a
// tierra, caja de empalme, tomacorriente, puntos de luz con sus
// interruptores — más motor/carga especial, confirmados aparte como
// "también merecen símbolo" para instalaciones más grandes). El
// catálogo completo (33 símbolos) sigue existiendo tal cual — solo
// pensado para el Diagrama unifilar (topología eléctrica: medidor,
// PLC, relé, contactor, bobina, sensor, transformador, generador,
// etc., cosas que casi nunca se ubican físicamente en un plano de
// planta) — un selector de "Colocar equipo" con esos 33 tipos
// abrumaba la tarea real de ubicar un tomacorriente o una luz. Esta
// lista es un WHITELIST explícito, no un criterio derivado (a
// diferencia de `soloPlano`, que separa por "sirve al Diagrama o no")
// — incluye los `soloPlano` YA existentes (caja_empalme, fuente_agua,
// circuito, diferencial) que siguen siendo relevantes acá, más los
// tipos de carga/distribución físicos que un electricista sí ubica a
// mano. NO borra ni deja de reconocer ningún tipo del catálogo — un
// marcador YA colocado de un tipo fuera de esta lista (de una ronda
// anterior) sigue dibujándose normal, esto solo filtra qué se OFRECE
// al colocar uno nuevo.
const IDS_PLANO_EQUIPO = new Set([
  "tablero_electrico",
  "puesta_tierra",
  "caja_empalme",
  "fuente_agua",
  "circuito",
  "diferencial",
  "contacto",
  "interruptor",
  "interruptor_conmutado",
  "luminaria",
  "luminaria_conmutada",
  "luminaria_cascada",
  "motor",
  "carga_especial",
]);

/** Igual que componentesPorCategoria(), pero acotado a los tipos que un electricista de verdad ubica en un plano de planta — ver IDS_PLANO_EQUIPO arriba. Para "Colocar equipo" del Plano; el Diagrama unifilar sigue usando componentesPorCategoriaDiagrama (el catálogo completo, sin los `soloPlano`). */
export function componentesPorCategoriaPlano() {
  const mapa = {};
  for (const c of CATALOGO_COMPONENTES) {
    if (!IDS_PLANO_EQUIPO.has(c.id)) continue;
    (mapa[c.categoria] ??= []).push(c);
  }
  return mapa;
}
