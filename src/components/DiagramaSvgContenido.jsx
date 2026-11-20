import React from "react";
import { colores, fuentes } from "../styles/colores";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";
import { SimboloDiagrama } from "./simbolosDiagrama.jsx";

// Contenido SVG puro del diagrama unifilar (defs + conexiones + nodos)
// — extraído de DiagramaUnifilar.jsx (usuario, 2026-11-20, al pedir que
// el diagrama se pueda embeber en la memoria técnica en PDF) para que
// el editor interactivo y la vista estática del informe DIBUJEN
// exactamente lo mismo, sin duplicar la lógica de trazado. El editor
// le pasa sus manejadores de mouse y su estado de selección/arrastre;
// la vista estática del informe lo usa tal cual, de solo lectura (sin
// props de interacción) — mismo criterio de "una sola fuente de
// verdad" que ya rige el resto de la app (ver ARCHITECTURE.md §9).
export const ANCHO_NODO = 120;
export const ALTO_NODO = 68;
export const TAMANO_SIMBOLO = 30;

const COLOR_POR_CATEGORIA = {
  fuente: colores.ok,
  medicion_proteccion: colores.warn,
  distribucion: colores.copper,
  control: colores.copperDim,
  carga: colores.textDim,
};

export function colorDeNodo(tipo) {
  const comp = App.diagrama.obtenerComponente(tipo);
  return COLOR_POR_CATEGORIA[comp?.categoria] ?? colores.border;
}

// Paleta de colores ESTRUCTURALES (fondo/borde/texto — no los de
// categoría de arriba, esos son semánticos y sirven igual sobre
// blanco). El editor interactivo usa la oscura de siempre; la vista
// estática embebida en la memoria técnica (InformeTecnico.jsx) usa la
// clara — mismo principio ya documentado ahí: "imprimir un fondo
// oscuro desperdicia tinta y se ve poco profesional".
export const PALETA_OSCURA = {
  fondoNodo: colores.panel,
  bordeDefecto: colores.border,
  textoPrincipal: colores.textMain,
  textoDim: colores.textDim,
  flecha: colores.textDim,
};
export const PALETA_IMPRESION = {
  fondoNodo: "#ffffff",
  bordeDefecto: "#999",
  textoPrincipal: "#1a1a1a",
  textoDim: "#666",
  flecha: "#666",
};

/** Caja envolvente de todos los nodos (+ margen) — para que una vista
 * estática (sin scroll ni pan) sepa qué viewBox usar y nada quede cortado. */
export function cajaEnvolvente(nodosDiagrama, margen = 20) {
  if (!nodosDiagrama || nodosDiagrama.length === 0) {
    return { ancho: ANCHO_NODO + margen * 2, alto: ALTO_NODO + margen * 2 };
  }
  const maxX = Math.max(...nodosDiagrama.map((n) => n.posicion.x + ANCHO_NODO));
  const maxY = Math.max(...nodosDiagrama.map((n) => n.posicion.y + ALTO_NODO));
  return { ancho: maxX + margen, alto: maxY + margen };
}

/**
 * @param {object[]} nodosDiagrama
 * @param {object[]} conexionesDiagrama
 * @param {{tableros, equipos, fuentesEnergia, transformadores}} entidadesPorRef
 * @param {(nodo) => {x:number,y:number}} [posicionDe] - por defecto, la posición guardada (el editor pasa la propia, con el arrastre en curso)
 * @param {(nodoId) => boolean} [esSeleccionado]
 * @param {(e, nodo) => void} [onMouseDownNodo] - ausente = nodos no interactivos (vista estática)
 * @param {(cx) => void} [onClickConexion]
 * @param {(nodo) => string} [cursorDeNodo]
 */
export function ContenidoSvgDiagrama({
  nodosDiagrama,
  conexionesDiagrama,
  entidadesPorRef,
  posicionDe = (nodo) => nodo.posicion,
  esSeleccionado = () => false,
  onMouseDownNodo,
  onClickConexion,
  cursorDeNodo = () => "default",
  paleta = PALETA_OSCURA,
}) {
  function nombreMostrado(nodo) {
    const entidad = App.diagrama.resolverEntidad(nodo, entidadesPorRef);
    return entidad?.nombre?.trim() || nodo.nombre;
  }

  return (
    <>
      <defs>
        <marker id="flecha-diagrama" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={paleta.flecha} />
        </marker>
      </defs>

      {conexionesDiagrama.map((cx) => {
        const origen = nodosDiagrama.find((n) => n.id === cx.nodoOrigenId);
        const destino = nodosDiagrama.find((n) => n.id === cx.nodoDestinoId);
        if (!origen || !destino) return null; // referencia rota — no debería pasar, pero no explota
        const p1 = posicionDe(origen);
        const p2 = posicionDe(destino);
        const x1 = p1.x + ANCHO_NODO / 2;
        const y1 = p1.y + ALTO_NODO;
        const x2 = p2.x + ANCHO_NODO / 2;
        const y2 = p2.y;
        return (
          <line
            key={cx.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={paleta.flecha}
            strokeWidth={1.5}
            markerEnd="url(#flecha-diagrama)"
            onClick={onClickConexion ? () => onClickConexion(cx) : undefined}
            style={{ cursor: onClickConexion ? "pointer" : "default" }}
          />
        );
      })}

      {nodosDiagrama.map((nodo) => {
        const pos = posicionDe(nodo);
        const comp = App.diagrama.obtenerComponente(nodo.tipo);
        const seleccionado = esSeleccionado(nodo.id);
        const entidad = App.diagrama.resolverEntidad(nodo, entidadesPorRef);
        const nombre = nombreMostrado(nodo);
        return (
          <g
            key={nodo.id}
            transform={`translate(${pos.x}, ${pos.y})`}
            onMouseDown={onMouseDownNodo ? (e) => onMouseDownNodo(e, nodo) : undefined}
            style={{ cursor: cursorDeNodo(nodo) }}
          >
            <rect
              width={ANCHO_NODO}
              height={ALTO_NODO}
              rx={4}
              fill={paleta.fondoNodo}
              stroke={seleccionado ? colores.copper : colorDeNodo(nodo.tipo)}
              strokeWidth={seleccionado ? 3 : 1.5}
            />
            <SimboloDiagrama
              tipo={nodo.tipo}
              x={(ANCHO_NODO - TAMANO_SIMBOLO) / 2}
              y={4}
              size={TAMANO_SIMBOLO}
              color={seleccionado ? colores.copper : colorDeNodo(nodo.tipo)}
            />
            <text x={ANCHO_NODO / 2} y={48} textAnchor="middle" fontSize={11} fontFamily={fuentes.display} fill={paleta.textoPrincipal}>
              {nombre.length > 16 ? `${nombre.slice(0, 15)}…` : nombre}
            </text>
            <text x={ANCHO_NODO / 2} y={60} textAnchor="middle" fontSize={8.5} fontFamily={fuentes.mono} fill={entidad ? colores.ok : paleta.textoDim}>
              {entidad ? `${comp?.nombre ?? nodo.tipo} · vinculado` : comp?.nombre ?? nodo.tipo}
            </text>
          </g>
        );
      })}
    </>
  );
}
