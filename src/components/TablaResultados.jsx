import React from "react";
import { colores, fuentes } from "../styles/colores";
import { lineasDisponiblesDeTablero, lineasRequeridas, siguienteSeleccionLineas } from "../shared/utils/lineasFases";

function redondearMostrar(valor) {
  return Math.round(valor * 10) / 10;
}

// Combina severidad eléctrica ("ok"/error de r) con severidad de
// integridad referencial (entrada de listaIntegridad para este
// circuito) — el peor de los dos gana el color del punto.
function estadoCombinado(r, entradaIntegridad) {
  const rango = { ok: 0, warn: 1, error: 2 };
  const elEctrico = !r?.ok ? "error" : r?.advertencias?.length ? "warn" : "ok";
  const integridad = entradaIntegridad
    ? entradaIntegridad.estado === "error"
      ? "error"
      : entradaIntegridad.estado === "advertencia"
        ? "warn"
        : "ok"
    : "ok";
  return rango[integridad] > rango[elEctrico] ? integridad : elEctrico;
}

// Asignación de línea(s) (L1/L2/L3) del circuito dentro de su tablero
// — para balance de fases (ver TableroMediator.balanceFasesDeTablero).
// Solo tiene sentido si el tablero tiene más de una línea (bi/tri); un
// tablero mono no tiene nada que elegir, así que el llamador ni
// renderiza esto en ese caso.
function SelectorLineasCircuito({ circuito, tablero, onAsignarLineas }) {
  const disponibles = lineasDisponiblesDeTablero(tablero.fases);
  const requeridas = lineasRequeridas(circuito.fases, disponibles);
  const actuales = circuito.lineas ?? [];
  const completo = actuales.length === requeridas;

  if (circuito.fases === "tri" && requeridas === disponibles.length) {
    // Trifásico: usa las 3 líneas, no hay elección real — un botón para
    // confirmarlo en vez de 3 clicks que no cambian nada entre sí.
    const yaAsignado = disponibles.every((l) => actuales.includes(l)) && actuales.length === disponibles.length;
    return (
      <div style={{ fontSize: 11.5, color: colores.textDim, display: "flex", alignItems: "center", gap: 8 }}>
        <span>Trifásico — usa las {disponibles.length} líneas del tablero ({disponibles.join(", ")}):</span>
        {yaAsignado ? (
          <span style={{ color: colores.ok, fontWeight: 600 }}>✓ asignado</span>
        ) : (
          <button
            type="button"
            onClick={() => onAsignarLineas(circuito.id, disponibles)}
            style={{ padding: "2px 8px", borderRadius: 3, border: `1px solid ${colores.copper}`, background: "transparent", color: colores.copper, fontSize: 11, cursor: "pointer" }}
          >
            Asignar
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontSize: 11.5, color: colores.textDim, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span>Línea(s) ({circuito.fases}, requiere {requeridas}):</span>
      {disponibles.map((linea) => {
        const seleccionada = actuales.includes(linea);
        const alcanzoMaximoSinEstaSeleccionada = !seleccionada && actuales.length >= requeridas && requeridas > 1;
        return (
          <button
            key={linea}
            type="button"
            disabled={alcanzoMaximoSinEstaSeleccionada}
            onClick={() => onAsignarLineas(circuito.id, siguienteSeleccionLineas(actuales, linea, requeridas))}
            title={alcanzoMaximoSinEstaSeleccionada ? `Ya hay ${requeridas} línea(s) seleccionada(s) — quitá una antes de agregar ${linea}` : undefined}
            style={{
              padding: "2px 9px",
              borderRadius: 3,
              border: `1px solid ${seleccionada ? colores.copper : colores.border}`,
              background: seleccionada ? colores.copper : "transparent",
              color: seleccionada ? colores.textSobreAcento : alcanzoMaximoSinEstaSeleccionada ? colores.border : colores.textDim,
              fontWeight: 600,
              fontSize: 11,
              cursor: alcanzoMaximoSinEstaSeleccionada ? "not-allowed" : "pointer",
            }}
          >
            {linea}
          </button>
        );
      })}
      <span style={{ color: completo ? colores.ok : colores.warn }}>
        {actuales.length}/{requeridas}
      </span>
    </div>
  );
}

export default function TablaResultados({
  circuitos,
  resultados,
  equiposDe,
  circuitoActivoId,
  onSeleccionarCircuito,
  onEditarCircuito,
  onEliminarCircuito,
  onEditarEquipo,
  onEliminarEquipo,
  tableros = [],
  onAsignarTablero,
  onAsignarLineas,
  listaIntegridad = [],
}) {
  if (circuitos.length === 0) {
    return (
      <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 24, textAlign: "center", color: colores.textDim, fontSize: 13 }}>
        Crea tu primer circuito para empezar.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {circuitos.map((circuito) => {
        const r = resultados.find((res) => res.id === circuito.id);
        const equipos = equiposDe(circuito.id);
        const activo = circuitoActivoId === circuito.id;
        const entradaIntegridad = listaIntegridad.find((e) => e.tipo === "circuito" && e.id === circuito.id);
        const estado = estadoCombinado(r, entradaIntegridad);
        const colorEstado = colores[estado];

        return (
          <div
            key={circuito.id}
            style={{
              background: colores.panel,
              border: `1px solid ${activo ? colores.copper : colores.border}`,
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            {/* Encabezado del circuito */}
            <div
              onClick={() => onSeleccionarCircuito(activo ? null : circuito.id)}
              style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: activo ? colores.copperFondo : "transparent" }}
            >
              <span style={{ color: colores.textDim, fontSize: 11, width: 12, flexShrink: 0, textAlign: "center" }}>{activo ? "▾" : "▸"}</span>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: colorEstado,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: colores.textMain }}>
                  {circuito.nombre || "(sin nombre)"}{" "}
                  <span style={{ fontSize: 11, color: colores.textDim, fontWeight: 400 }}>
                    · {circuito.tipo} · {equipos.length} equipo{equipos.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {r?.ok && (
                  <div style={{ fontFamily: fuentes.mono, fontSize: 12, color: colores.textDim, marginTop: 2 }}>
                    {redondearMostrar(r.potenciaTotal)}W · I={r.corriente.toFixed(2)}A · {r.seccion} {r.unidadSeccion} · ΔV={r.caidaPct.toFixed(2)}% ·{" "}
                    <span style={{ color: r.breaker ? colores.copper : colores.error, fontWeight: 700 }}>{r.breaker ? `${r.breaker}A` : "sin breaker seguro"}</span>
                  </div>
                )}
                {r && !r.ok && <div style={{ fontSize: 12, color: colores.error, marginTop: 2 }}>{r.error}</div>}
              </div>
              {onAsignarTablero && (
                <select
                  value={circuito.tableroId ?? ""}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onAsignarTablero(circuito.id, e.target.value || null)}
                  style={{
                    background: colores.bg,
                    border: `1px solid ${colores.border}`,
                    borderRadius: 3,
                    color: circuito.tableroId ? colores.textMain : colores.textDim,
                    fontSize: 11,
                    padding: "4px 6px",
                    maxWidth: 120,
                  }}
                  aria-label={`Tablero de ${circuito.nombre}`}
                >
                  <option value="">— sin tablero —</option>
                  {tableros.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditarCircuito(circuito.id);
                }}
                style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 14 }}
                aria-label={`Editar circuito ${circuito.nombre}`}
              >
                ✎
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEliminarCircuito(circuito.id);
                }}
                style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 16 }}
                aria-label={`Eliminar circuito ${circuito.nombre}`}
              >
                ×
              </button>
            </div>

            {/* Detalle: advertencias + equipos, solo si está activo (acordeón) */}
            {activo && (
              <>
                {onAsignarLineas && (() => {
                  const tableroDelCircuito = tableros.find((t) => t.id === circuito.tableroId);
                  if (!tableroDelCircuito || tableroDelCircuito.fases === "mono") return null;
                  return (
                    <div style={{ padding: "0 14px 10px 14px" }}>
                      <SelectorLineasCircuito circuito={circuito} tablero={tableroDelCircuito} onAsignarLineas={onAsignarLineas} />
                    </div>
                  );
                })()}

                {(r?.advertencias?.length > 0 || entradaIntegridad?.problemas?.length > 0) && (
                  <div style={{ padding: "0 14px 10px 14px" }}>
                    {r?.advertencias?.map((a, i) => (
                      <div key={`e${i}`} style={{ color: colores.warn, fontSize: 11.5, display: "flex", gap: 6, alignItems: "flex-start" }}>
                        <span>⚠</span> <span>{a}</span>
                      </div>
                    ))}
                    {entradaIntegridad?.problemas?.map((p, i) => (
                      <div
                        key={`i${i}`}
                        style={{ color: entradaIntegridad.estado === "error" ? colores.error : colores.warn, fontSize: 11.5, display: "flex", gap: 6, alignItems: "flex-start" }}
                        title="Integridad de datos, no cálculo eléctrico"
                      >
                        <span>🗂</span> <span>{p}</span>
                      </div>
                    ))}
                  </div>
                )}

                {equipos.length > 0 && (
                  <div style={{ borderTop: `1px solid ${colores.border}` }}>
                    {equipos.map((eq) => (
                      <div
                        key={eq.id}
                        style={{ padding: "8px 14px 8px 30px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${colores.border}`, fontSize: 12.5 }}
                      >
                        <span style={{ flex: 1, color: colores.textMain }}>{eq.nombre}</span>
                        <span style={{ fontFamily: fuentes.mono, color: colores.textDim }}>
                          {eq.cantidad}× {eq.modoEntrada === "corriente" ? `${eq.valor}A` : `${eq.valor}W`}
                        </span>
                        <span style={{ fontFamily: fuentes.mono, color: colores.textDim, fontSize: 11 }}>cosφ {eq.cosPhi}</span>
                        <button onClick={() => onEditarEquipo(eq.id)} style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 13 }} aria-label={`Editar ${eq.nombre}`}>
                          ✎
                        </button>
                        <button onClick={() => onEliminarEquipo(eq.id)} style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 15 }} aria-label={`Eliminar ${eq.nombre}`}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
