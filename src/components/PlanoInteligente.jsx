import React, { useState } from "react";
import { colores, fuentes } from "../styles/colores";
import { inputStyle } from "./Campo";
import { BotonPill } from "./PanelTableros";
import PlanoCanvas from "./PlanoCanvas";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";

// Plano inteligente — Fase 1 (2026-11-20): calibración de escala +
// trazado manual de paredes. Ver PLANO_INTELIGENTE_DISENO.md para el
// porqué de la arquitectura (independencia de dispositivo/resolución).
//
// Este componente es la "Interfaz gráfica" — mantiene el `modo` activo
// y el estado de la interacción EN CURSO (calibración pendiente, trazo
// de pared en curso) como estado de React puramente efímero, nunca
// persistido — solo cuando una acción se CONFIRMA (segundo punto de
// calibración + distancia, o un segmento de pared) se llama a una
// función del hook, que es quien de verdad guarda algo en el proyecto.
const MODOS = [
  { valor: "mover", label: "Mover vista", ayuda: "Arrastrá para mover, rueda del mouse (o los botones +/−) para zoom." },
  { valor: "perspectiva", label: "Corregir perspectiva", ayuda: "Para fotos: hacé click en las 4 esquinas de un rectángulo real (ej. una habitación), en orden, dando toda la vuelta." },
  { valor: "calibrar", label: "Calibrar", ayuda: "Hacé click en dos puntos cuya distancia real conozcas." },
  { valor: "calibrar-perimetro", label: "Calibrar por perímetro", ayuda: "Trazá el contorno exterior completo (3+ puntos) y declará su perímetro real total." },
  { valor: "pared", label: "Trazar pared", ayuda: "Click para ir agregando puntos. Volvé al punto de inicio para cerrar un ambiente." },
  { valor: "espesor", label: "Medir espesor", ayuda: "Marcá 2 puntos a los dos lados de una pared ya trazada — se mide el espesor real y se guarda en la pared más cercana." },
  { valor: "conductor", label: "Trazar conductor", ayuda: "Click para ir agregando el recorrido de un conductor. No hace falta cerrarlo — terminalo con el botón." },
  { valor: "ambiente", label: "Generar ambiente", ayuda: "Completá el nombre y la medida abajo, y hacé click en el plano donde va el CENTRO del ambiente." },
  { valor: "mover-ambiente", label: "Mover ambiente", ayuda: "Arrastrá un ambiente ya trazado (manual o generado) para reposicionarlo, manteniendo su forma y medida exactas." },
  { valor: "equipo", label: "Colocar equipo", ayuda: "Elegí el tipo abajo y hacé click en el plano donde va ubicado." },
  { valor: "eliminar", label: "Borrar", ayuda: "Click sobre un nodo, una pared/conductor o un equipo para eliminarlo." },
];

// Mismo mapa categoría->color que usa PlanoCanvas.jsx — para el punto
// de color junto a cada opción del <select> de tipo de equipo.
const COLOR_POR_CATEGORIA = { fuente: colores.ok, medicion_proteccion: colores.warn, distribucion: colores.copper, control: colores.copperDim, carga: colores.textDim };

export default function PlanoInteligente({
  planoImagen,
  cargarImagenPlano,
  quitarImagenPlano,
  planoCalibracion,
  calibrarPlano,
  calibrarPlanoPorPerimetro,
  nodosPlano,
  segmentosPlano,
  agregarNodoPlano,
  agregarSegmentoPlano,
  eliminarNodoPlano,
  eliminarSegmentoPlano,
  editarSegmentoPlano,
  habitacionesPlano,
  cerrarHabitacionPlano,
  eliminarHabitacionPlano,
  renombrarHabitacionPlano,
  generarHabitacionPlano,
  moverHabitacionPlano,
  rutasConductorPlano,
  cerrarRutaConductorPlano,
  eliminarRutaConductorPlano,
  renombrarRutaConductorPlano,
  marcadoresEquipoPlano,
  agregarMarcadorEquipoPlano,
  editarMarcadorEquipoPlano,
  eliminarMarcadorEquipoPlano,
  corregirPerspectivaPlano,
  exportarDXFPlano,
  tableros = [],
  equipos = [],
  circuitos = [],
  fuentesEnergia = [],
  transformadores = [],
}) {
  const [modo, setModo] = useState("mover");
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");
  // Asistencia de bordes (Fase 2) — "pega" cada click de trazado al
  // borde más fuerte cercano en la imagen, ver PlanoCanvas.jsx /
  // modules/plano/deteccionBordes.js. Preferencia de herramienta, NO
  // se persiste (no es un dato del proyecto, es solo cómo trabaja
  // ahora mismo quien está trazando).
  const [asistenciaBordes, setAsistenciaBordes] = useState(true);

  // Calibración: null, [puntoA], o [puntoA, puntoB] (ahí se muestra el
  // formulario de distancia real antes de confirmar).
  const [puntosCalibracion, setPuntosCalibracion] = useState([]);
  const [distanciaRealInput, setDistanciaRealInput] = useState("");

  // Calibración alternativa por perímetro (usuario, 2026-11-20): el
  // instalador traza un contorno de N puntos (no un grafo persistido,
  // efímero — igual criterio que puntosCalibracion) y, con 3 o más,
  // puede declarar el perímetro real total en vez de una distancia
  // puntual entre 2 esquinas.
  const [puntosContornoCalibracion, setPuntosContornoCalibracion] = useState([]);
  const [perimetroRealInput, setPerimetroRealInput] = useState("");

  // Medir espesor de pared (usuario, 2026-11-20): 2 clicks a los dos
  // lados del ancho visible de una pared YA trazada — la distancia
  // entre esos 2 puntos, convertida a metros con la escala actual, se
  // guarda como espesorM de la pared más cercana al punto medio de
  // esos 2 clicks (nunca se adivina CUÁL pared si no hay ninguna cerca).
  const [puntosEspesor, setPuntosEspesor] = useState([]);

  // Corrección de perspectiva — 4 puntos (esquinas del rectángulo real
  // en la foto), en orden; al completar los 4 se pide ancho/alto real.
  const [puntosPerspectiva, setPuntosPerspectiva] = useState([]);
  const [anchoRealInput, setAnchoRealInput] = useState("");
  const [altoRealInput, setAltoRealInput] = useState("");
  const [corrigiendoPerspectiva, setCorrigiendoPerspectiva] = useState(false);

  // Trazo de pared (o de conductor, mismo mecanismo — ver modo
  // "conductor") en curso — lista ORDENADA de ids de nodo. Se resetea
  // al cambiar de modo o al cerrar/terminar el trazo.
  const [trazoActual, setTrazoActual] = useState([]);

  // Modo "equipo" — tipo/nombre/entidad elegidos ANTES de hacer click
  // en el plano (el click solo define la UBICACIÓN); mismo catálogo
  // que el diagrama unifilar (ver PlanoMediator.componentesPorCategoria).
  const categoriasEquipo = App.plano.componentesPorCategoria();
  const primeraCategoriaEquipo = Object.keys(categoriasEquipo)[0];
  const [tipoEquipoSeleccionado, setTipoEquipoSeleccionado] = useState(categoriasEquipo[primeraCategoriaEquipo]?.[0]?.id ?? "");
  const [nombreEquipoNuevo, setNombreEquipoNuevo] = useState("");
  const [entidadEquipoNuevo, setEntidadEquipoNuevo] = useState("");

  // Modo "ambiente" — generador por dimensión conocida (pedido
  // explícito del usuario: "etiqueta + perímetro 12x8m" → un polígono
  // de ese tamaño exacto, en vez de trazarlo a mano). nombre/ancho/alto
  // se completan ANTES de hacer click (el click solo define el CENTRO
  // donde aparece), mismo criterio que el modo "equipo".
  const [nombreAmbienteNuevo, setNombreAmbienteNuevo] = useState("");
  const [anchoAmbienteInput, setAnchoAmbienteInput] = useState("");
  const [altoAmbienteInput, setAltoAmbienteInput] = useState("");

  function etiquetaEntidadEquipo(tipoEquipo, entidad) {
    const comp = App.plano.obtenerComponente(tipoEquipo);
    if (comp?.entidadVinculada === "equipo") {
      const circuito = circuitos.find((c) => c.id === entidad.circuitoId);
      const tablero = circuito ? tableros.find((t) => t.id === circuito.tableroId) : null;
      const contexto = [circuito?.nombre, tablero?.nombre].filter(Boolean).join(" · ");
      return contexto ? `${entidad.nombre || "Equipo sin nombre"} (${contexto})` : entidad.nombre || "Equipo sin nombre";
    }
    return entidad.nombre || "(sin nombre)";
  }

  function mostrarAviso(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(""), 5000);
  }

  function cambiarModo(nuevoModo) {
    setModo(nuevoModo);
    setPuntosCalibracion([]);
    setDistanciaRealInput("");
    setPuntosContornoCalibracion([]);
    setPerimetroRealInput("");
    setPuntosEspesor([]);
    setPuntosPerspectiva([]);
    setAnchoRealInput("");
    setAltoRealInput("");
    setTrazoActual([]);
    setEntidadEquipoNuevo("");
  }

  async function alSeleccionarArchivo(e) {
    const archivo = e.target.files[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo después
    if (!archivo) return;
    setCargando(true);
    try {
      await cargarImagenPlano(archivo);
      cambiarModo("mover");
    } catch (err) {
      mostrarAviso(err.message || "No se pudo cargar la imagen.");
    } finally {
      setCargando(false);
    }
  }

  function alClickImagen(puntoImagen) {
    if (modo === "perspectiva") {
      if (puntosPerspectiva.length < 4) {
        setPuntosPerspectiva([...puntosPerspectiva, puntoImagen]);
      }
      return;
    }

    if (modo === "calibrar") {
      if (puntosCalibracion.length < 2) {
        setPuntosCalibracion([...puntosCalibracion, puntoImagen]);
      }
      return;
    }

    if (modo === "calibrar-perimetro") {
      setPuntosContornoCalibracion([...puntosContornoCalibracion, puntoImagen]);
      return;
    }

    if (modo === "espesor") {
      if (puntosEspesor.length < 1) {
        setPuntosEspesor([puntoImagen]);
        return;
      }
      const escala = planoCalibracion?.escalaMetrosPorPixel;
      const puntoA = puntosEspesor[0];
      setPuntosEspesor([]);
      if (!escala) {
        mostrarAviso("Calibrá el plano primero.");
        return;
      }
      const espesorM = Math.hypot(puntoImagen.x - puntoA.x, puntoImagen.y - puntoA.y) * escala;
      const puntoMedioImagen = { x: (puntoImagen.x + puntoA.x) / 2, y: (puntoImagen.y + puntoA.y) / 2 };
      const puntoMedioModelo = App.plano.imagenAModelo(puntoMedioImagen, escala);
      const segmento = segmentoMasCercano(puntoMedioModelo, nodosPlano, segmentosPlano);
      if (!segmento) {
        mostrarAviso("No hay ninguna pared cerca de esos 2 puntos — no se guardó nada.");
        return;
      }
      if (segmento.tipo !== "pared") {
        mostrarAviso(`El segmento más cercano es un "${segmento.tipo}", no una pared — no se guardó nada.`);
        return;
      }
      editarSegmentoPlano(segmento.id, { espesorM });
      mostrarAviso(`Espesor guardado: ${(espesorM * 100).toFixed(1)} cm.`);
      return;
    }

    if (modo === "pared") {
      const nodo = agregarNodoPlano(puntoImagen);
      if (!nodo) return; // sin calibrar todavía
      if (trazoActual.length === 0) {
        setTrazoActual([nodo.id]);
        return;
      }
      const nodoAnteriorId = trazoActual[trazoActual.length - 1];
      if (nodo.id === nodoAnteriorId) return; // click repetido sobre el mismo punto
      agregarSegmentoPlano(nodoAnteriorId, nodo.id);

      if (nodo.id === trazoActual[0] && trazoActual.length >= 3) {
        // El trazo volvió a su propio inicio — se cierra como habitación.
        const nombre = window.prompt("Nombre del ambiente (opcional):", "") ?? "";
        cerrarHabitacionPlano(trazoActual, nombre);
        setTrazoActual([]);
        mostrarAviso("Ambiente cerrado — área y perímetro calculados.");
        return;
      }
      setTrazoActual([...trazoActual, nodo.id]);
      return;
    }

    if (modo === "conductor") {
      const nodo = agregarNodoPlano(puntoImagen);
      if (!nodo) return; // sin calibrar todavía
      if (trazoActual.length === 0) {
        setTrazoActual([nodo.id]);
        return;
      }
      const nodoAnteriorId = trazoActual[trazoActual.length - 1];
      if (nodo.id === nodoAnteriorId) return; // click repetido sobre el mismo punto
      agregarSegmentoPlano(nodoAnteriorId, nodo.id, "conductor");
      setTrazoActual([...trazoActual, nodo.id]);
      return;
    }

    if (modo === "ambiente") {
      const ancho = parseFloat(anchoAmbienteInput);
      const alto = parseFloat(altoAmbienteInput);
      if (!(ancho > 0) || !(alto > 0)) {
        mostrarAviso("Completá un ancho y un alto mayores a 0 antes de hacer click.");
        return;
      }
      const habitacion = generarHabitacionPlano(puntoImagen, nombreAmbienteNuevo, ancho, alto);
      if (!habitacion) return; // sin calibrar todavía
      mostrarAviso(`"${habitacion.nombre}" generado — ${habitacion.areaM2.toFixed(2)} m². Podés reposicionarlo con "Mover ambiente".`);
      return;
    }

    if (modo === "equipo") {
      if (!tipoEquipoSeleccionado) return;
      agregarMarcadorEquipoPlano(puntoImagen, tipoEquipoSeleccionado, entidadEquipoNuevo || null, nombreEquipoNuevo);
      return;
    }

    if (modo === "eliminar") {
      const escala = planoCalibracion?.escalaMetrosPorPixel ?? 1;
      const puntoModelo = App.plano.imagenAModelo(puntoImagen, escala);
      const nodoCercano = App.plano.nodoCercano(puntoModelo, nodosPlano, escala * 12); // ~12px de tolerancia en cualquier zoom
      if (nodoCercano) {
        eliminarNodoPlano(nodoCercano.id);
        return;
      }
      // Si no hay nodo cerca, probar con el segmento más cercano.
      const segmentoCercano = segmentoMasCercano(puntoModelo, nodosPlano, segmentosPlano);
      if (segmentoCercano) eliminarSegmentoPlano(segmentoCercano.id);
    }
  }

  function alClickMarcador(marcador) {
    if (modo !== "eliminar") return;
    eliminarMarcadorEquipoPlano(marcador.id);
  }

  function terminarRutaConductor() {
    if (trazoActual.length < 2) {
      setTrazoActual([]);
      return;
    }
    const nombre = window.prompt("Nombre del conductor/ruta (opcional):", "") ?? "";
    const ruta = cerrarRutaConductorPlano(trazoActual, nombre);
    setTrazoActual([]);
    if (ruta) mostrarAviso(`Ruta registrada — longitud ${ruta.longitudM.toFixed(2)} m.`);
  }

  function terminarTrazo() {
    setTrazoActual([]);
  }

  async function confirmarPerspectiva(e) {
    e.preventDefault();
    setCorrigiendoPerspectiva(true);
    try {
      const resultado = await corregirPerspectivaPlano(puntosPerspectiva, parseFloat(anchoRealInput), parseFloat(altoRealInput));
      if (!resultado.ok) {
        mostrarAviso(resultado.motivo);
        return;
      }
      mostrarAviso("Perspectiva corregida — el plano ya quedó calibrado, podés trazar directo.");
      cambiarModo("pared");
    } finally {
      setCorrigiendoPerspectiva(false);
    }
  }

  function confirmarCalibracionPerimetro(e) {
    e.preventDefault();
    const perimetro = parseFloat(perimetroRealInput);
    const resultado = calibrarPlanoPorPerimetro(puntosContornoCalibracion, perimetro);
    if (!resultado.ok) {
      mostrarAviso(resultado.motivo);
      return;
    }
    mostrarAviso(`Calibrado por perímetro: ${resultado.calibracion.escalaMetrosPorPixel.toFixed(5)} m por píxel de imagen.`);
    cambiarModo("pared");
  }

  function confirmarCalibracion(e) {
    e.preventDefault();
    const distancia = parseFloat(distanciaRealInput);
    const resultado = calibrarPlano(puntosCalibracion[0], puntosCalibracion[1], distancia);
    if (!resultado.ok) {
      mostrarAviso(resultado.motivo);
      return;
    }
    mostrarAviso(`Calibrado: ${resultado.calibracion.escalaMetrosPorPixel.toFixed(5)} m por píxel de imagen.`);
    setPuntosCalibracion([]);
    setDistanciaRealInput("");
    cambiarModo("pared");
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, alignItems: "start" }}>
      <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Plano inteligente
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <label
              style={{ padding: "6px 12px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.copper, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
            >
              {cargando ? "Cargando…" : planoImagen ? "↻ Cambiar plano" : "↑ Cargar plano (imagen o PDF)"}
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={alSeleccionarArchivo} disabled={cargando} />
            </label>
            {segmentosPlano.length > 0 && (
              <button
                type="button"
                onClick={exportarDXFPlano}
                style={{ padding: "6px 12px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.copper, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
                title="Exporta las paredes y ambientes trazados como archivo .dxf, para abrir en AutoCAD/LibreCAD/QCAD"
              >
                ⬇ Exportar DXF
              </button>
            )}
            {planoImagen && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("¿Quitar el plano y todo lo trazado sobre él?")) {
                    quitarImagenPlano();
                    cambiarModo("mover");
                  }
                }}
                style={{ padding: "6px 12px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.error, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
              >
                × Quitar
              </button>
            )}
          </div>
        </div>

        {aviso && (
          <div style={{ fontSize: 12, color: colores.warn, marginBottom: 10, padding: "6px 10px", border: `1px solid ${colores.warn}`, borderRadius: 3 }}>
            {aviso}
          </div>
        )}

        {planoImagen?.paginasTotal > 1 && (
          <div style={{ fontSize: 11, color: colores.textDim, marginBottom: 10 }}>
            Este PDF tiene {planoImagen.paginasTotal} páginas — por ahora se usa solo la primera.
          </div>
        )}

        {planoImagen && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              {MODOS.map((m) => (
                <BotonPill key={m.valor} activo={modo === m.valor} onClick={() => cambiarModo(m.valor)}>
                  {m.label}
                </BotonPill>
              ))}
            </div>
            <div style={{ fontSize: 11, color: colores.textDim, marginBottom: 10, lineHeight: 1.4 }}>
              {MODOS.find((m) => m.valor === modo)?.ayuda}
              {modo === "perspectiva" && puntosPerspectiva.length > 0 && puntosPerspectiva.length < 4 && ` (van ${puntosPerspectiva.length} de 4)`}
              {(modo === "pared" || modo === "conductor" || modo === "ambiente") && !planoCalibracion && " — primero calibrá la escala."}
              {modo === "pared" && trazoActual.length > 0 && (
                <>
                  {" "}·{" "}
                  <button type="button" onClick={terminarTrazo} style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 11 }}>
                    Terminar este trazo sin cerrar
                  </button>
                </>
              )}
              {modo === "conductor" && trazoActual.length > 0 && (
                <>
                  {" "}·{" "}
                  <button type="button" onClick={terminarRutaConductor} style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 11 }}>
                    Terminar ruta ({trazoActual.length} punto{trazoActual.length === 1 ? "" : "s"})
                  </button>
                </>
              )}
              {(modo === "calibrar-perimetro" || ((modo === "pared" || modo === "conductor" || modo === "espesor") && planoCalibracion)) && (
                <>
                  {" "}·{" "}
                  <label style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={asistenciaBordes} onChange={(e) => setAsistenciaBordes(e.target.checked)} style={{ marginRight: 4 }} />
                    Asistencia de bordes (pega el click al filo más cercano)
                  </label>
                </>
              )}
            </div>

            {modo === "equipo" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                <select
                  value={tipoEquipoSeleccionado}
                  onChange={(e) => {
                    setTipoEquipoSeleccionado(e.target.value);
                    setEntidadEquipoNuevo("");
                  }}
                  style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12 }}
                >
                  {Object.entries(categoriasEquipo).map(([cat, items]) => (
                    <optgroup key={cat} label={cat}>
                      {items.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input
                  value={nombreEquipoNuevo}
                  onChange={(e) => setNombreEquipoNuevo(e.target.value)}
                  placeholder="Nombre (opcional)"
                  style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12, width: 140 }}
                />
                {App.plano.obtenerComponente(tipoEquipoSeleccionado)?.entidadVinculada && (
                  <select
                    value={entidadEquipoNuevo}
                    onChange={(e) => setEntidadEquipoNuevo(e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12, maxWidth: 220 }}
                  >
                    <option value="">— Vincular a (opcional) —</option>
                    {App.plano
                      .candidatosEntidadEquipo(tipoEquipoSeleccionado, { tableros, equipos, fuentesEnergia, transformadores, marcadores: marcadoresEquipoPlano })
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {etiquetaEntidadEquipo(tipoEquipoSeleccionado, c)}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}

            {modo === "ambiente" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                <input
                  value={nombreAmbienteNuevo}
                  onChange={(e) => setNombreAmbienteNuevo(e.target.value)}
                  placeholder="Nombre (ej. Habitación #1)"
                  style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12, width: 170 }}
                />
                <input
                  type="number"
                  step="0.01"
                  value={anchoAmbienteInput}
                  onChange={(e) => setAnchoAmbienteInput(e.target.value)}
                  placeholder="Ancho (m)"
                  style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12, width: 90 }}
                />
                <span style={{ color: colores.textDim, fontSize: 12 }}>×</span>
                <input
                  type="number"
                  step="0.01"
                  value={altoAmbienteInput}
                  onChange={(e) => setAltoAmbienteInput(e.target.value)}
                  placeholder="Alto (m)"
                  style={{ padding: "6px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 12, width: 90 }}
                />
              </div>
            )}
          </>
        )}

        <PlanoCanvas
          imagen={planoImagen}
          nodos={nodosPlano}
          segmentos={segmentosPlano}
          marcadoresEquipo={marcadoresEquipoPlano}
          habitaciones={habitacionesPlano}
          escalaMetrosPorPixel={planoCalibracion?.escalaMetrosPorPixel ?? null}
          puntosGuiaPendientes={
            modo === "perspectiva"
              ? puntosPerspectiva
              : modo === "calibrar-perimetro"
                ? puntosContornoCalibracion
                : modo === "espesor"
                  ? puntosEspesor
                  : puntosCalibracion
          }
          nodoIdsTrazoActual={trazoActual}
          modo={modo}
          onArrastrarHabitacion={moverHabitacionPlano}
          asistenciaBordes={asistenciaBordes}
          onClickImagen={alClickImagen}
          onClickMarcador={alClickMarcador}
        />

        {modo === "perspectiva" && puntosPerspectiva.length === 4 && (
          <form onSubmit={confirmarPerspectiva} style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Ancho real del rectángulo (m):</div>
              <input style={{ ...inputStyle(), width: 110 }} type="number" step="0.01" autoFocus value={anchoRealInput} onChange={(e) => setAnchoRealInput(e.target.value)} placeholder="Ej: 4" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Alto real del rectángulo (m):</div>
              <input style={{ ...inputStyle(), width: 110 }} type="number" step="0.01" value={altoRealInput} onChange={(e) => setAltoRealInput(e.target.value)} placeholder="Ej: 3" />
            </div>
            <button
              type="submit"
              disabled={!anchoRealInput || !altoRealInput || corrigiendoPerspectiva}
              style={{
                padding: "8px 16px",
                borderRadius: 3,
                border: "none",
                background: anchoRealInput && altoRealInput && !corrigiendoPerspectiva ? colores.copper : colores.border,
                color: "#171512",
                fontWeight: 700,
                fontSize: 12.5,
                cursor: anchoRealInput && altoRealInput && !corrigiendoPerspectiva ? "pointer" : "not-allowed",
              }}
            >
              {corrigiendoPerspectiva ? "Corrigiendo…" : "Corregir perspectiva"}
            </button>
            <button
              type="button"
              onClick={() => setPuntosPerspectiva([])}
              style={{ padding: "8px 12px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontSize: 12.5, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </form>
        )}

        {modo === "calibrar" && puntosCalibracion.length === 2 && (
          <form onSubmit={confirmarCalibracion} style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Distancia real entre esos dos puntos (metros):</div>
              <input
                style={inputStyle()}
                type="number"
                step="0.01"
                autoFocus
                value={distanciaRealInput}
                onChange={(e) => setDistanciaRealInput(e.target.value)}
                placeholder="Ej: 5"
              />
            </div>
            <button
              type="submit"
              disabled={!distanciaRealInput}
              style={{ padding: "8px 16px", borderRadius: 3, border: "none", background: distanciaRealInput ? colores.copper : colores.border, color: "#171512", fontWeight: 700, fontSize: 12.5, cursor: distanciaRealInput ? "pointer" : "not-allowed" }}
            >
              Calibrar
            </button>
            <button
              type="button"
              onClick={() => setPuntosCalibracion([])}
              style={{ padding: "8px 12px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontSize: 12.5, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </form>
        )}

        {modo === "calibrar-perimetro" && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10.5, color: colores.textDim, marginBottom: 8 }}>
              {puntosContornoCalibracion.length} punto{puntosContornoCalibracion.length !== 1 ? "s" : ""} trazado{puntosContornoCalibracion.length !== 1 ? "s" : ""}
              {puntosContornoCalibracion.length < 3 && " — agregá al menos 3 para declarar el perímetro."}
            </div>
            {puntosContornoCalibracion.length >= 3 && (
              <form onSubmit={confirmarCalibracionPerimetro} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Perímetro real de ese contorno (metros):</div>
                  <input
                    style={inputStyle()}
                    type="number"
                    step="0.01"
                    autoFocus
                    value={perimetroRealInput}
                    onChange={(e) => setPerimetroRealInput(e.target.value)}
                    placeholder="Ej: 60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!perimetroRealInput}
                  style={{ padding: "8px 16px", borderRadius: 3, border: "none", background: perimetroRealInput ? colores.copper : colores.border, color: "#171512", fontWeight: 700, fontSize: 12.5, cursor: perimetroRealInput ? "pointer" : "not-allowed" }}
                >
                  Calibrar
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => setPuntosContornoCalibracion([])}
              style={{ marginTop: 8, padding: "6px 12px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontSize: 11.5, cursor: "pointer" }}
            >
              Reiniciar trazo
            </button>
          </div>
        )}

        {modo === "espesor" && (
          <div style={{ fontSize: 10.5, color: colores.textDim, marginTop: 10 }}>
            {puntosEspesor.length === 0 ? "Click en un lado de la pared." : "Click en el otro lado de la pared."}
          </div>
        )}

        {planoCalibracion && (
          <div style={{ fontSize: 10.5, color: colores.textDim, marginTop: 10 }}>
            {planoCalibracion.metodo === "perimetro" ? (
              <>
                Calibrado por perímetro: {planoCalibracion.perimetroRealM}m real
              </>
            ) : (
              <>
                Calibrado: {planoCalibracion.distanciaRealM}m = {Math.round(planoCalibracion.distanciaRealM / planoCalibracion.escalaMetrosPorPixel)}px de imagen
              </>
            )}
            {" "}({planoCalibracion.escalaMetrosPorPixel.toFixed(5)} m/px).{" "}
            <button type="button" onClick={() => cambiarModo("calibrar")} style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 10.5 }}>Recalibrar</button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
          <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            Ambientes ({habitacionesPlano.length})
          </div>
          {habitacionesPlano.length === 0 ? (
            <div style={{ fontSize: 12, color: colores.textDim, lineHeight: 1.4 }}>
              Cerrá un trazo de pared (volvé al punto de inicio) para que aparezca acá, con su área y perímetro ya calculados.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {habitacionesPlano.map((h) => (
                <div key={h.id} style={{ border: `1px solid ${colores.border}`, borderRadius: 3, padding: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <input
                      style={{ ...inputStyle(), flex: 1, padding: "4px 6px", fontSize: 12 }}
                      value={h.nombre}
                      onChange={(e) => renombrarHabitacionPlano(h.id, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => eliminarHabitacionPlano(h.id)}
                      style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 14 }}
                      aria-label={`Eliminar ${h.nombre}`}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ fontFamily: fuentes.mono, fontSize: 11.5, color: colores.textDim }}>
                    {h.areaM2.toFixed(2)} m² · perímetro {h.perimetroM.toFixed(2)} m
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
          <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            Rutas de conductor ({rutasConductorPlano.length})
          </div>
          {rutasConductorPlano.length === 0 ? (
            <div style={{ fontSize: 12, color: colores.textDim, lineHeight: 1.4 }}>
              Trazá el recorrido de un conductor ("Trazar conductor") y terminalo para que aparezca acá, con su longitud ya calculada.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rutasConductorPlano.map((r) => (
                <div key={r.id} style={{ border: `1px solid ${colores.border}`, borderRadius: 3, padding: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <input
                      style={{ ...inputStyle(), flex: 1, padding: "4px 6px", fontSize: 12 }}
                      value={r.nombre}
                      onChange={(e) => renombrarRutaConductorPlano(r.id, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => eliminarRutaConductorPlano(r.id)}
                      style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 14 }}
                      aria-label={`Eliminar ${r.nombre}`}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ fontFamily: fuentes.mono, fontSize: 11.5, color: colores.textDim }}>longitud {r.longitudM.toFixed(2)} m</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
          <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            Equipos en el plano ({marcadoresEquipoPlano.length})
          </div>
          {marcadoresEquipoPlano.length === 0 ? (
            <div style={{ fontSize: 12, color: colores.textDim, lineHeight: 1.4 }}>
              Elegí "Colocar equipo", el tipo que corresponda, y hacé click en su ubicación dentro del plano.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {marcadoresEquipoPlano.map((m) => {
                const comp = App.plano.obtenerComponente(m.tipo);
                const entidad = App.plano.resolverEntidadEquipo(m, { tableros, equipos, fuentesEnergia, transformadores });
                const candidatos = App.plano.candidatosEntidadEquipo(m.tipo, { tableros, equipos, fuentesEnergia, transformadores, marcadores: marcadoresEquipoPlano, marcadorId: m.id });
                return (
                  <div key={m.id} style={{ border: `1px solid ${colores.border}`, borderRadius: 3, padding: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLOR_POR_CATEGORIA[comp?.categoria] ?? colores.border, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 12, color: colores.textMain }}>{comp?.nombre ?? m.tipo}</div>
                      <button
                        type="button"
                        onClick={() => eliminarMarcadorEquipoPlano(m.id)}
                        style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 14 }}
                        aria-label={`Eliminar ${comp?.nombre ?? m.tipo}`}
                      >
                        ×
                      </button>
                    </div>
                    <input
                      style={{ ...inputStyle(), width: "100%", padding: "4px 6px", fontSize: 11.5, marginBottom: comp?.entidadVinculada ? 4 : 0 }}
                      value={m.nombre}
                      placeholder="Nombre (opcional)"
                      onChange={(e) => editarMarcadorEquipoPlano(m.id, { nombre: e.target.value })}
                    />
                    {comp?.entidadVinculada && (
                      <select
                        value={m.entidadId ?? ""}
                        onChange={(e) => editarMarcadorEquipoPlano(m.id, { entidadId: e.target.value || null })}
                        style={{ width: "100%", padding: "4px 6px", borderRadius: 3, border: `1px solid ${colores.border}`, background: colores.bg, color: colores.textMain, fontSize: 11.5 }}
                      >
                        <option value="">— Sin vincular —</option>
                        {entidad && !candidatos.some((c) => c.id === entidad.id) && (
                          <option value={entidad.id}>{etiquetaEntidadEquipo(m.tipo, entidad)}</option>
                        )}
                        {candidatos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {etiquetaEntidadEquipo(m.tipo, c)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Segmento más cercano a un punto (modelo, metros) — distancia punto-a-segmento mínima. */
function segmentoMasCercano(puntoModelo, nodos, segmentos) {
  let mejor = null;
  let menorDistancia = Infinity;
  for (const seg of segmentos) {
    const a = nodos.find((n) => n.id === seg.nodoAId)?.punto;
    const b = nodos.find((n) => n.id === seg.nodoBId)?.punto;
    if (!a || !b) continue;
    const d = distanciaPuntoSegmento(puntoModelo, a, b);
    if (d < menorDistancia) {
      menorDistancia = d;
      mejor = seg;
    }
  }
  // Tolerancia fija en metros (30cm) — independiente del zoom, igual
  // criterio que RADIO_SNAP_METROS en modules/plano/index.js.
  return menorDistancia <= 0.3 ? mejor : null;
}

function distanciaPuntoSegmento(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;
  if (largo2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo2;
  t = Math.max(0, Math.min(1, t));
  const proyX = a.x + t * dx;
  const proyY = a.y + t * dy;
  return Math.hypot(p.x - proyX, p.y - proyY);
}
