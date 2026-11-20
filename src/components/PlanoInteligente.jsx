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
  { valor: "calibrar", label: "Calibrar", ayuda: "Hacé click en dos puntos cuya distancia real conozcas." },
  { valor: "pared", label: "Trazar pared", ayuda: "Click para ir agregando puntos. Volvé al punto de inicio para cerrar un ambiente." },
  { valor: "eliminar", label: "Borrar", ayuda: "Click sobre un nodo o una pared para eliminarlo." },
];

export default function PlanoInteligente({
  planoImagen,
  cargarImagenPlano,
  quitarImagenPlano,
  planoCalibracion,
  calibrarPlano,
  nodosPlano,
  segmentosPlano,
  agregarNodoPlano,
  agregarSegmentoPlano,
  eliminarNodoPlano,
  eliminarSegmentoPlano,
  habitacionesPlano,
  cerrarHabitacionPlano,
  eliminarHabitacionPlano,
  renombrarHabitacionPlano,
}) {
  const [modo, setModo] = useState("mover");
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");

  // Calibración: null, [puntoA], o [puntoA, puntoB] (ahí se muestra el
  // formulario de distancia real antes de confirmar).
  const [puntosCalibracion, setPuntosCalibracion] = useState([]);
  const [distanciaRealInput, setDistanciaRealInput] = useState("");

  // Trazo de pared en curso — lista ORDENADA de ids de nodo. Se resetea
  // al cambiar de modo o al cerrar/terminar el trazo.
  const [trazoActual, setTrazoActual] = useState([]);

  function mostrarAviso(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(""), 5000);
  }

  function cambiarModo(nuevoModo) {
    setModo(nuevoModo);
    setPuntosCalibracion([]);
    setDistanciaRealInput("");
    setTrazoActual([]);
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
    if (modo === "calibrar") {
      if (puntosCalibracion.length < 2) {
        setPuntosCalibracion([...puntosCalibracion, puntoImagen]);
      }
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

  function terminarTrazo() {
    setTrazoActual([]);
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
            Plano inteligente — Fase 1
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <label
              style={{ padding: "6px 12px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.copper, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
            >
              {cargando ? "Cargando…" : planoImagen ? "↻ Cambiar plano" : "↑ Cargar plano (imagen)"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={alSeleccionarArchivo} disabled={cargando} />
            </label>
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
              {modo === "pared" && !planoCalibracion && " — primero calibrá la escala."}
              {modo === "pared" && trazoActual.length > 0 && (
                <>
                  {" "}·{" "}
                  <button type="button" onClick={terminarTrazo} style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 11 }}>
                    Terminar este trazo sin cerrar
                  </button>
                </>
              )}
            </div>
          </>
        )}

        <PlanoCanvas
          imagen={planoImagen}
          nodos={nodosPlano}
          segmentos={segmentosPlano}
          escalaMetrosPorPixel={planoCalibracion?.escalaMetrosPorPixel ?? null}
          puntosCalibracionPendientes={puntosCalibracion}
          nodoIdsTrazoActual={trazoActual}
          modo={modo}
          onClickImagen={alClickImagen}
        />

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

        {planoCalibracion && (
          <div style={{ fontSize: 10.5, color: colores.textDim, marginTop: 10 }}>
            Calibrado: {planoCalibracion.distanciaRealM}m = {Math.round(planoCalibracion.distanciaRealM / planoCalibracion.escalaMetrosPorPixel)}px de imagen
            ({planoCalibracion.escalaMetrosPorPixel.toFixed(5)} m/px). <button type="button" onClick={() => cambiarModo("calibrar")} style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 10.5 }}>Recalibrar</button>
          </div>
        )}
      </div>

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
