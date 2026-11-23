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
  { id: "spd", nombre: "Protector contra sobretensiones (SPD)", categoria: "medicion_proteccion", puntosConexion: { entradas: 1, salidas: 0 }, entidadVinculada: null },
  { id: "fusible", nombre: "Fusible", categoria: "medicion_proteccion", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },

  // --- Distribución ---
  { id: "tablero_electrico", nombre: "Tablero eléctrico", categoria: "distribucion", puntosConexion: { entradas: 1, salidas: Infinity }, entidadVinculada: "tablero" },
  { id: "barra_distribucion", nombre: "Barra de distribución", categoria: "distribucion", puntosConexion: { entradas: Infinity, salidas: Infinity }, entidadVinculada: null },

  // --- Carga ---
  { id: "contacto", nombre: "Contacto (tomacorriente)", categoria: "carga", puntosConexion: { entradas: 1, salidas: 0 }, entidadVinculada: "equipo" },
  { id: "interruptor", nombre: "Interruptor", categoria: "carga", puntosConexion: { entradas: 1, salidas: 1 }, entidadVinculada: null },
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
