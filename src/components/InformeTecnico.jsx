import React, { useMemo } from "react";
import { colores } from "../styles/colores";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";
import { TIPOS_FUENTE_UI } from "./PanelTableros";
import { ContenidoSvgDiagrama, cajaEnvolvente, PALETA_IMPRESION } from "./DiagramaSvgContenido.jsx";

// Memoria técnica / informe — 5ta pestaña, el lugar que ya estaba
// anotado como pendiente en App.jsx desde que se armó el layout por
// pestañas ("resumen y generación de fichas o informe técnico").
//
// GENERACIÓN DEL PDF (decidido con el usuario, 2026-11-19): vista
// imprimible + "Guardar como PDF" del navegador, NO una librería nueva
// — coherente con que la app no manda nada a ningún servidor ni carga
// nada externo (ver colores.js, Privacidad en PiePagina.jsx). El CSS
// @media print (en App.jsx) oculta todo menos #informe-memoria-tecnica
// al imprimir, sin importar qué pestaña esté activa en pantalla.
//
// Estilo DELIBERADAMENTE claro (fondo blanco, texto oscuro) aunque el
// resto de la app sea oscura — es una vista previa de "papel", y
// imprimir un fondo oscuro desperdicia tinta y se ve poco profesional.
//
// ALCANCE v1 (acordado con el usuario): encabezado, tabla de
// circuitos, resumen de tableros/alimentadores, fuentes de
// energía/transformadores, advertencias de integridad, aviso de
// responsabilidad.
//
// DIAGRAMA UNIFILAR EMBEBIDO (usuario, 2026-11-20): se agregó
// reutilizando el MISMO contenido SVG del editor interactivo
// (DiagramaSvgContenido.jsx, extraído de DiagramaUnifilar.jsx para que
// ninguno de los dos dibuje su propia copia) — no es una captura de
// pantalla ni una librería nueva, es el SVG real, de solo lectura (sin
// manejadores de mouse) y con la paleta CLARA (PALETA_IMPRESION) en vez
// de la oscura del editor, mismo motivo que el resto de esta vista:
// imprimir fondo oscuro desperdicia tinta y se ve poco profesional. El
// tamaño del lienzo se calcula en vivo (cajaEnvolvente) a partir de la
// posición de los nodos, para que nada quede cortado sin importar
// cuántos haya.

const COLOR_TEXTO = "#1a1a1a";
const COLOR_TEXTO_DIM = "#555";
const COLOR_BORDE = "#ccc";
const COLOR_OK = "#2e7d32";
const COLOR_ADVERTENCIA = "#b26a00";
const COLOR_ERROR = "#c62828";

function formatoNumero(n, decimales = 2) {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(decimales) : "—";
}

function celda(contenido, extra = {}) {
  return <td style={{ padding: "5px 8px", borderBottom: `1px solid ${COLOR_BORDE}`, fontSize: 11.5, ...extra }}>{contenido}</td>;
}

function Th({ children, alinearDerecha }) {
  return (
    <th
      style={{
        padding: "6px 8px",
        borderBottom: `2px solid ${COLOR_TEXTO}`,
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        textAlign: alinearDerecha ? "right" : "left",
        color: COLOR_TEXTO_DIM,
      }}
    >
      {children}
    </th>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div style={{ marginTop: 22 }}>
      <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.04em", color: COLOR_TEXTO, borderBottom: `1px solid ${COLOR_TEXTO}`, paddingBottom: 4, marginBottom: 10 }}>
        {titulo}
      </h2>
      {children}
    </div>
  );
}

export default function InformeTecnico({
  proyecto,
  normativaActiva,
  tipoInstalacion,
  circuitos,
  equipos,
  resultados,
  tableros,
  alimentadores,
  fuentesEnergia,
  transformadores,
  listaIntegridad,
  nodosDiagrama = [],
  conexionesDiagrama = [],
}) {
  const informe = useMemo(
    () =>
      App.documento.memoriaTecnica({
        proyecto,
        normativaActiva,
        tipoInstalacion,
        circuitos,
        equipos,
        resultados,
        tableros,
        alimentadores,
        fuentesEnergia,
        transformadores,
        listaIntegridad,
      }),
    [proyecto, normativaActiva, tipoInstalacion, circuitos, equipos, resultados, tableros, alimentadores, fuentesEnergia, transformadores, listaIntegridad]
  );

  const fecha = new Date(informe.fechaGeneracion).toLocaleDateString("es", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div>
      <div
        id="informe-memoria-tecnica-boton-imprimir"
        style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}
      >
        <button
          type="button"
          onClick={() => window.print()}
          style={{ padding: "8px 16px", borderRadius: 3, border: "none", background: colores.copper, color: colores.textSobreAcento, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          🖨 Imprimir / Guardar como PDF
        </button>
      </div>

      <div
        id="informe-memoria-tecnica"
        style={{
          background: "#fff",
          color: COLOR_TEXTO,
          padding: 32,
          maxWidth: 820,
          margin: "0 auto",
          borderRadius: 4,
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          lineHeight: 1.4,
        }}
      >
        <h1 style={{ fontSize: 20, margin: "0 0 2px 0" }}>Memoria técnica — {informe.proyecto.nombre || "Proyecto sin nombre"}</h1>
        <div style={{ fontSize: 12, color: COLOR_TEXTO_DIM, marginBottom: 2 }}>Generado el {fecha}</div>
        <div style={{ fontSize: 12, color: COLOR_TEXTO_DIM }}>
          Normativa: <strong style={{ color: COLOR_TEXTO }}>{informe.normativa.nombre}</strong>
          {informe.tipoInstalacion && (
            <>
              {" · "}Tipo de instalación: <strong style={{ color: COLOR_TEXTO }}>{informe.tipoInstalacion.label}</strong>
            </>
          )}
        </div>

        <div style={{ marginTop: 14, padding: 10, border: `1px solid ${COLOR_BORDE}`, borderRadius: 3, fontSize: 10.5, color: COLOR_TEXTO_DIM, lineHeight: 1.5 }}>
          Los resultados de este informe son <strong>orientativos</strong> y sirven como apoyo al cálculo. No sustituyen la
          consulta del texto oficial de cada normativa (NEC, CIEN, REBT / UNE-HD 60364) ni el criterio de un profesional
          habilitado. Antes de ejecutar cualquier instalación, un técnico o ingeniero competente debe verificar los
          cálculos y la selección de conductores, protecciones y canalizaciones, y tener en cuenta las condiciones
          reales de la obra y los requisitos de la autoridad local.
        </div>

        <Seccion titulo="Totales">
          <div style={{ display: "flex", gap: 24, fontSize: 12.5 }}>
            <div>
              Circuitos: <strong>{informe.totales.circuitosOk}</strong> de {informe.totales.circuitosTotal} calculados
            </div>
            <div>
              Demanda total: <strong>{formatoNumero(informe.totales.potenciaTotalW, 0)} W</strong>
            </div>
            <div>
              Corriente total: <strong>{formatoNumero(informe.totales.corrienteTotalA)} A</strong>
            </div>
          </div>
        </Seccion>

        <Seccion titulo="Circuitos">
          {informe.circuitos.length === 0 ? (
            <div style={{ fontSize: 12, color: COLOR_TEXTO_DIM }}>Sin circuitos cargados todavía.</div>
          ) : (
            // overflowX:auto (usuario, 2026-11-26, "layout mobile") — con
            // 9 columnas, esta tabla nunca entra en un celular angosto;
            // sin este envoltorio quedaba recortada en silencio por el
            // overflow:hidden de cada panel de TabsViewPager, sin ninguna
            // forma de ver las columnas de la derecha (Breaker/Caída).
            // width:100% se quita del <table> (forzaba columnas angostas
            // de más en vez de dejarlo crecer y scrollear horizontal).
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table id="tabla-informe-circuitos" style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Circuito</Th>
                  <Th>Tipo</Th>
                  <Th>Fases</Th>
                  <Th>Equipos</Th>
                  <Th alinearDerecha>Potencia</Th>
                  <Th alinearDerecha>Corriente</Th>
                  <Th>Calibre</Th>
                  <Th alinearDerecha>Breaker</Th>
                  <Th alinearDerecha>Caída</Th>
                </tr>
              </thead>
              <tbody>
                {informe.circuitos.map((c) => (
                  <tr key={c.id}>
                    {celda(c.nombre)}
                    {celda(c.tipo)}
                    {celda(c.fases)}
                    {celda(c.cantidadEquipos)}
                    {celda(c.ok ? `${formatoNumero(c.potenciaW, 0)} W` : "—", { textAlign: "right" })}
                    {celda(c.ok ? `${formatoNumero(c.corrienteA)} A` : "—", { textAlign: "right" })}
                    {celda(c.ok ? `${c.seccion} ${c.unidadSeccion}` : "—")}
                    {celda(c.ok ? `${c.breaker}A` : "—", { textAlign: "right" })}
                    {celda(c.ok ? `${formatoNumero(c.caidaPct)}%` : "—", { textAlign: "right" })}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
          {informe.circuitos
            .filter((c) => !c.ok || c.advertencias.length > 0)
            .map((c) => (
              <div key={c.id} style={{ fontSize: 10.5, color: !c.ok ? COLOR_ERROR : COLOR_ADVERTENCIA, marginTop: 4 }}>
                {!c.ok ? `⚠ ${c.nombre}: ${c.error}` : c.advertencias.map((a, i) => <div key={i}>⚠ {c.nombre}: {a}</div>)}
              </div>
            ))}
        </Seccion>

        <Seccion titulo="Tableros">
          {informe.tableros.length === 0 ? (
            <div style={{ fontSize: 12, color: COLOR_TEXTO_DIM }}>Sin tableros cargados todavía.</div>
          ) : (
            // Mismo envoltorio que la tabla de Circuitos arriba — mismo motivo.
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table id="tabla-informe-tableros" style={{ width: "100%", minWidth: 500, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Tablero</Th>
                  <Th>Fuente</Th>
                  <Th>Tensión</Th>
                  <Th>Fases</Th>
                  <Th alinearDerecha>Potencia</Th>
                  <Th>Calibre</Th>
                  <Th alinearDerecha>Breaker</Th>
                  <Th alinearDerecha>Caída</Th>
                </tr>
              </thead>
              <tbody>
                {informe.tableros.map((t) => (
                  <tr key={t.id}>
                    {celda(t.nombre)}
                    {celda(t.origen)}
                    {celda(`${t.tensionAlimentacion}V`)}
                    {celda(t.fases)}
                    {celda(t.ok ? `${formatoNumero(t.potenciaW, 0)} W` : "—", { textAlign: "right" })}
                    {celda(t.ok ? `${t.seccion} ${t.unidadSeccion}` : "—")}
                    {celda(t.ok ? `${t.breaker}A` : "—", { textAlign: "right" })}
                    {celda(t.ok ? `${formatoNumero(t.caidaPct)}%` : "—", { textAlign: "right" })}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
          {informe.tableros
            .filter((t) => !t.ok)
            .map((t) => (
              <div key={t.id} style={{ fontSize: 10.5, color: COLOR_ADVERTENCIA, marginTop: 4 }}>
                ⚠ {t.nombre}: {t.motivo}
              </div>
            ))}
        </Seccion>

        <Seccion titulo="Materiales — metros de conductor por calibre">
          {informe.materiales.length === 0 ? (
            <div style={{ fontSize: 12, color: COLOR_TEXTO_DIM }}>
              Sin ningún circuito/tablero con calibre calculado Y distancia cargada todavía.
            </div>
          ) : (
            <>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <Th>Calibre</Th>
                    <Th alinearDerecha>Metros</Th>
                  </tr>
                </thead>
                <tbody>
                  {informe.materiales.map((m) => (
                    <tr key={`${m.seccion}|${m.unidadSeccion}`}>
                      {celda(`${m.seccion} ${m.unidadSeccion}`)}
                      {celda(`${formatoNumero(m.metrosTotal)} m`, { textAlign: "right" })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize: 10.5, color: COLOR_TEXTO_DIM, marginTop: 6 }}>
                Suma la "Distancia (m)"/"Longitud alimentador" de cada circuito/tablero YA calculado — ya incluye el
                extra de cruce de pared para cualquier ruta sincronizada desde el Plano con "Usar esta longitud".
                Metros lineales de conductor real, sin redondear a presentaciones de compra (rollos/tubos).
              </div>
            </>
          )}
        </Seccion>

        <Seccion titulo="Diagrama unifilar">
          {nodosDiagrama.length === 0 ? (
            <div style={{ fontSize: 12, color: COLOR_TEXTO_DIM }}>Sin diagrama unifilar cargado todavía.</div>
          ) : (
            (() => {
              const { ancho, alto } = cajaEnvolvente(nodosDiagrama);
              return (
                <svg
                  width="100%"
                  viewBox={`0 0 ${ancho} ${alto}`}
                  style={{ background: "#fff", border: `1px solid ${COLOR_BORDE}`, borderRadius: 4, display: "block", maxHeight: 480 }}
                >
                  <ContenidoSvgDiagrama
                    nodosDiagrama={nodosDiagrama}
                    conexionesDiagrama={conexionesDiagrama}
                    entidadesPorRef={{ tableros, equipos, fuentesEnergia, transformadores }}
                    paleta={PALETA_IMPRESION}
                  />
                </svg>
              );
            })()
          )}
        </Seccion>

        {(informe.fuentesEnergia.length > 0 || informe.transformadores.length > 0) && (
          <Seccion titulo="Fuentes de energía y transformadores">
            {informe.fuentesEnergia.map((f) => (
              <div key={f.id} style={{ fontSize: 12, marginBottom: 2 }}>
                {f.nombre} — {TIPOS_FUENTE_UI.find((t) => t.valor === f.tipo)?.label ?? f.tipo}
                {f.capacidadKW !== "" && f.capacidadKW != null ? ` (${f.capacidadKW} kW)` : ""}
              </div>
            ))}
            {informe.transformadores.map((t) => (
              <div key={t.id} style={{ fontSize: 12, marginBottom: 2 }}>
                {t.nombre} — Transformador
                {t.tensionPrimariaV && t.tensionSecundariaV ? ` (${t.tensionPrimariaV}V → ${t.tensionSecundariaV}V)` : ""}
              </div>
            ))}
          </Seccion>
        )}

        <Seccion titulo="Advertencias de integridad del proyecto">
          <div style={{ fontSize: 11.5, marginBottom: 8 }}>
            <span style={{ color: COLOR_OK }}>{informe.integridad.resumen.ok ?? 0} OK</span>
            {" · "}
            <span style={{ color: COLOR_ADVERTENCIA }}>{informe.integridad.resumen.advertencia ?? 0} advertencia(s)</span>
            {" · "}
            <span style={{ color: COLOR_ERROR }}>{informe.integridad.resumen.error ?? 0} error(es)</span>
          </div>
          {informe.integridad.entradas.length === 0 ? (
            <div style={{ fontSize: 12, color: COLOR_TEXTO_DIM }}>Sin advertencias pendientes.</div>
          ) : (
            informe.integridad.entradas.map((e) => (
              <div key={`${e.tipo}-${e.id}`} style={{ fontSize: 11, marginBottom: 3 }}>
                <strong>
                  {e.tipo} "{e.nombre}"
                </strong>
                : {e.problemas.join("; ")}
              </div>
            ))
          )}
        </Seccion>

        <div style={{ marginTop: 24, paddingTop: 10, borderTop: `1px solid ${COLOR_BORDE}`, fontSize: 10, color: COLOR_TEXTO_DIM }}>
          Generado con Dimensionamiento Eléctrico Completo — cálculos realizados localmente, sin enviar datos del
          proyecto a ningún servidor.
        </div>
      </div>
    </div>
  );
}
