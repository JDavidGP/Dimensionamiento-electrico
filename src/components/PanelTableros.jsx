import React, { useState } from "react";
import { colores, fuentes } from "../styles/colores";
import Campo, { inputStyle } from "./Campo";
import { lineasDisponiblesDeTablero, lineasRequeridas, siguienteSeleccionLineas } from "../shared/utils/lineasFases";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";
import { TIPOS_INSTALACION } from "../shared/constants/constantes.js";

const FASES = [
  { valor: "mono", label: "Mono" },
  { valor: "bi", label: "Bi" },
  { valor: "tri", label: "Tri" },
];

// tensionManual es puramente de este formulario (no se guarda en el
// tablero) — decide si, al cambiar las fases del alimentador, la
// tensión se auto-actualiza al estándar de la normativa activa o se
// deja como la dejó el instalador. Mismo criterio que voltajeManual en
// FormularioCircuito.jsx, pero sin persistirlo: al editar un tablero
// existente alcanza con derivarlo comparando su tensión contra los
// valores estándar (ver abrirEdicion).
const FORM_VACIO = {
  nombre: "",
  // Sistema de etiquetado (ver modules/etiquetado/index.js) — código
  // corto (ej. "TD1", autosugerido al abrir "+ Nuevo tablero", ver
  // abrirCreacion más abajo) y función, descriptivos, distintos de
  // `notas` (memo libre de la fuente de energía).
  etiqueta: "",
  funcion: "",
  tensionAlimentacion: "",
  tensionManual: false,
  fases: "mono",
  capacidadKW: "",
  tableroPadreId: "", // "" = acometida/poste (sin padre); puede ser otro tablero o una fuente de energía
  // Fuente de energía SECUNDARIA/AUXILIAR (rol) — "" = Ninguna,
  // "acometida" = red eléctrica local, o el id de una fuente de
  // energía (Batería/Generador) ya creada. Pedido explícito del
  // usuario: que los 3 roles (principal/secundaria/auxiliar) se elijan
  // juntos, acá en el mismo formulario, en vez de que secundaria/
  // auxiliar solo se pudieran configurar DESPUÉS de crear el tablero
  // (como vivía antes en BloqueConmutacion, separado). El rol PRINCIPAL
  // sigue siendo tableroPadreId — sin cambios, es lo único que usan los
  // cálculos (ver modules/origen/conmutacion.js para por qué
  // secundaria/auxiliar siguen siendo puramente documentales).
  fuenteSecundariaId: "",
  fuenteAuxiliarId: "",
  modoConmutacion: App.origen.MODOS_CONMUTACION.FALLA_AUTOMATICA,
  horarioPrincipalInicio: "",
  horarioPrincipalFin: "",
  longitudAlimentador: "",
  materialAlimentador: "cobre",
  notas: "",
};

// Mini-formulario inline para crear un Transformador — solo los campos
// mínimos para darle identidad como origen (nombre + fases + tensiones
// para que calcularCorrientesNominales pueda calcular algo si hace
// falta más adelante); capacidadKVA/conexiones/%Z quedan sin UI
// todavía, "nos hace falta datos para desarrollar ese apartado"
// (usuario, 2026-11-19) — se completan directo en el archivo JSON por
// ahora si hace falta, igual criterio que varios campos "sin UI
// todavía" ya documentados en el resto de la app.
const FORM_TRANSFORMADOR_VACIO = { nombre: "", fases: "tri", tensionPrimariaV: "", tensionSecundariaV: "" };

// Exportadas para que PanelFuentesEnergia.jsx (lista propia de fuentes
// de energía, con su CRUD completo) use las mismas etiquetas — nunca
// un segundo mapeo que se pueda desincronizar del de acá.
export const TIPOS_FUENTE_UI = [
  { valor: "red_local", label: "Red local" },
  { valor: "bateria", label: "Batería" },
  { valor: "generador", label: "Generador" },
];

export function BotonPill({ activo, onClick, children, flex = 1 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex,
        padding: "7px 0",
        borderRadius: 3,
        border: `1px solid ${activo ? colores.copper : colores.border}`,
        background: activo ? colores.copper : "transparent",
        color: activo ? colores.textSobreAcento : colores.textDim,
        fontWeight: 600,
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// Bloque de resultado del alimentador (tramo troncal) de un tablero,
// tal como lo devuelve TableroMediator.calcularAlimentador. Cubre los
// tres estados posibles: pendiente (falta dato), error (no hay calibre
// que cumpla) y ok (dimensionado).
function BloqueAlimentador({ resultado }) {
  if (!resultado) return null;

  if (resultado.pendiente) {
    return (
      <div style={{ fontSize: 11.5, color: colores.textDim, lineHeight: 1.4 }}>
        Alimentador pendiente: {resultado.motivo}
      </div>
    );
  }

  if (!resultado.ok) {
    return (
      <div style={{ fontSize: 11.5, color: colores.error, lineHeight: 1.4 }}>
        ⚠ {resultado.error}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: fuentes.mono, fontSize: 11.5, color: colores.textMain, lineHeight: 1.6 }}>
      <div>
        Calibre: <strong>{resultado.seccion} {resultado.unidadSeccion}</strong> ({resultado.areaMm2.toFixed(2)} mm²) · Breaker: <strong>{resultado.breaker}A</strong>
      </div>
      <div style={{ color: colores.textDim }}>
        {resultado.corrienteDiseno.toFixed(2)}A diseño · caída {resultado.caidaPct.toFixed(2)}% · {resultado.cantidadCircuitos} circuito(s) agregados
      </div>
      {resultado.advertencias?.map((a, i) => (
        <div key={i} style={{ color: colores.warn }}>⚠ {a}</div>
      ))}
    </div>
  );
}

// Cortocircuito en los bornes de un tablero (TableroMediator.cortocircuitoDesdeTablero)
// — usuario, 2026-11-21, documento "tabla completa X/R aceite/seco":
// solo APLICA cuando la cadena ascendente de este tablero termina en
// un transformador propio (el único origen con impedancia de fuente
// conocida hoy) — para cualquier otro origen (acometida, batería,
// generador) no se inventa un dato, el bloque simplemente no aparece.
function BloqueCortocircuito({ resultado }) {
  if (!resultado || !resultado.aplica) return null;

  if (!resultado.ok) {
    return (
      <div style={{ fontSize: 11.5, color: colores.textDim, lineHeight: 1.4 }}>
        Cortocircuito (transformador propio) pendiente: {resultado.motivo}
      </div>
    );
  }

  return (
    <div style={{ fontSize: 11.5, color: colores.textMain, lineHeight: 1.4 }}>
      Icc en este tablero (vía transformador propio): <strong>{(resultado.iccA / 1000).toFixed(1)} kA</strong> — verificar que el
      interruptor de este tablero tenga Icu ≥ ese valor.
      {resultado.xrDisponible === false && (
        <div style={{ color: colores.warn }}>
          ⚠ Sin X/R de placa del transformador (falta tipo de refrigeración y/o capacidad fuera de la tabla citada) — este valor usa un
          reparto R/X simplificado, menos preciso que con X/R real.
        </div>
      )}
    </div>
  );
}

// Asignación de línea(s) del alimentador de un SUBtablero respecto a
// las líneas de su tablero PADRE (mismo concepto que circuito.lineas,
// un nivel más arriba) — para que balance de fases pueda agregar la
// demanda de este subtablero hacia el padre por la línea correcta.
// Solo se renderiza si hay padre y el padre tiene más de una línea.
function SelectorLineasAlimentador({ tablero, padre, onEditarTablero }) {
  const disponibles = lineasDisponiblesDeTablero(padre.fases);
  const requeridas = lineasRequeridas(tablero.fases, disponibles);
  const actuales = tablero.lineasAlimentador ?? [];
  const completo = actuales.length === requeridas;

  function asignar(nuevas) {
    onEditarTablero(tablero.id, { lineasAlimentador: nuevas });
  }

  if (tablero.fases === "tri" && requeridas === disponibles.length) {
    const yaAsignado = actuales.length === disponibles.length && disponibles.every((l) => actuales.includes(l));
    return (
      <div style={{ fontSize: 11.5, color: colores.textDim, display: "flex", alignItems: "center", gap: 8 }}>
        <span>Alimentador trifásico — usa las {disponibles.length} líneas de "{padre.nombre}" ({disponibles.join(", ")}):</span>
        {yaAsignado ? (
          <span style={{ color: colores.ok, fontWeight: 600 }}>✓ asignado</span>
        ) : (
          <button
            type="button"
            onClick={() => asignar(disponibles)}
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
      <span>Línea(s) del alimentador en "{padre.nombre}" (requiere {requeridas}):</span>
      {disponibles.map((linea) => {
        const seleccionada = actuales.includes(linea);
        const alcanzoMaximoSinEstaSeleccionada = !seleccionada && actuales.length >= requeridas && requeridas > 1;
        return (
          <button
            key={linea}
            type="button"
            disabled={alcanzoMaximoSinEstaSeleccionada}
            onClick={() => asignar(siguienteSeleccionLineas(actuales, linea, requeridas))}
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

// Severidad visual del % de desbalance: verde hasta el 70% del umbral,
// ámbar entre ese 70% y el umbral (se acerca al límite sin haberlo
// cruzado todavía), rojo al superarlo. Es una gradación de UI, no una
// cifra normativa — el único corte que sí tiene fuente es `excede`
// (porcentajeDesbalance > limitePct, ver balanceFases.js).
function colorSeveridadBalance(pct, limite) {
  if (pct > limite) return colores.error;
  if (pct > limite * 0.7) return colores.warn;
  return colores.ok;
}

// Balance de fases de un tablero (TableroMediator.balanceFasesDeTablero),
// con detalle visual por color: barra por línea (ancho = corriente,
// color = severidad) y, si excede el umbral, una sugerencia de qué
// mover para mejorar el balance — nunca se aplica solo, es información
// para que el instalador decida.
const MODOS_CONMUTACION_UI = [
  { valor: "falla_automatica", label: "Automática ante falla" },
  { valor: "horario", label: "Por horario" },
  { valor: "manual", label: "Manual" },
];

function nombreOrigenConmutacion(id, fuentesEnergia) {
  if (!id) return "— Ninguna —";
  if (id === "acometida") return "Red eléctrica local";
  return fuentesEnergia.find((f) => f.id === id)?.nombre ?? "(fuente eliminada)";
}

// Etiqueta legible de la fuente de energía PRINCIPAL de un tablero —
// compartida entre "Alimenta desde:" (vista colapsada) y
// BloqueConmutacion (que ya no tiene su propio selector de "principal":
// ver la nota ahí sobre por qué se eliminó, para que no quede
// desincronizado de este mismo valor).
function etiquetaFuentePrincipal(padre, padreFuente, padreTransformador) {
  if (padre) return padre.nombre;
  if (padreFuente) {
    return `${padreFuente.nombre} (${TIPOS_FUENTE_UI.find((ti) => ti.valor === padreFuente.tipo)?.label})`;
  }
  if (padreTransformador) {
    return `${padreTransformador.nombre} (Transformador${padreTransformador.tensionPrimariaV && padreTransformador.tensionSecundariaV ? ` · ${padreTransformador.tensionPrimariaV}V→${padreTransformador.tensionSecundariaV}V` : ""})`;
  }
  return "Red eléctrica local (acometida / poste)";
}

// Distancia/material EFECTIVOS que usa el alimentador de este tablero
// — los propios si los declaró, si no los de la fuente de origen como
// respaldo (ver conRespaldoDeFuente en TableroMediator.js; acá solo se
// refleja en texto lo mismo que el motor ya está usando, no se
// recalcula nada).
function etiquetaDistanciaAlimentador(t, padreFuente) {
  if (t.longitudAlimentador > 0) return `${t.longitudAlimentador}m de ${t.materialAlimentador}`;
  if (padreFuente?.distanciaM > 0) return `${padreFuente.distanciaM}m de ${padreFuente.materialConductor} (de la fuente)`;
  return null;
}

// Fuentes de energía secundaria/auxiliar de un tablero — pedido
// explícito del usuario, confirmando las 3 opciones: red eléctrica
// local (acometida), autoconsumo con batería y auxiliar del generador.
// La fuente PRINCIPAL ya NO se elige acá: se deriva siempre de
// `tablero.tableroPadreId` (el selector "Fuente de energía" de arriba,
// en el formulario) — antes este bloque tenía su PROPIO selector de
// "Fuente principal" en `conmutacion.fuentePrincipalId`, independiente
// del de arriba, y podían desincronizarse (el usuario elegía una
// fuente distinta en cada lado sin darse cuenta). Se guarda siempre en
// sincro con tableroPadreId para que la memoria del proyecto no
// contradiga al resto de los cálculos. Puramente DOCUMENTAL en cuanto
// a secundaria/auxiliar (ver modules/origen/conmutacion.js): no
// recalcula nada, solo registra el esquema esperado en la memoria del
// proyecto. Mismo patrón de edición inline que SelectorLineasAlimentador:
// estado local propio, se guarda en el tablero recién al confirmar.
// Resumen de SOLO LECTURA de las fuentes de energía de un tablero
// (principal/secundaria/auxiliar) — pedido explícito del usuario:
// "colocar la opción de roles primero" — los 3 roles se eligen JUNTOS
// en el formulario del tablero (FORM_VACIO: tableroPadreId = principal,
// fuenteSecundariaId, fuenteAuxiliarId, modoConmutacion), no acá. Este
// bloque antes TENÍA su propio mini-formulario inline con guardar/
// cancelar — se quitó porque dejaba dos lugares distintos para elegir
// la fuente principal (acá y en el selector de arriba) que se podían
// desincronizar. "✎ Editar" abre el mismo formulario que el lápiz de
// la fila del tablero (abrirEdicion), un solo punto de edición.
function ResumenFuentesEnergia({ tablero, fuentesEnergia, nombreFuentePrincipal, onEditar }) {
  const conf = tablero.conmutacion;
  if (!conf?.activa) return null;

  return (
    <div>
      <div style={{ fontSize: 10.5, color: colores.textDim, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
        Fuentes de energía
      </div>
      <div style={{ fontSize: 11.5, color: colores.textMain, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>
          {MODOS_CONMUTACION_UI.find((m) => m.valor === conf.modo)?.label} —{" "}
          <strong>{nombreFuentePrincipal}</strong> (principal)
          {conf.fuenteSecundariaId && (
            <>
              {" ⇄ "}
              <strong>{nombreOrigenConmutacion(conf.fuenteSecundariaId, fuentesEnergia)}</strong> (secundaria)
            </>
          )}
          {conf.fuenteAuxiliarId && (
            <>
              {" + "}
              <strong>{nombreOrigenConmutacion(conf.fuenteAuxiliarId, fuentesEnergia)}</strong> (auxiliar)
            </>
          )}
          {conf.modo === "horario" && conf.horarioPrincipalInicio && conf.horarioPrincipalFin && (
            <span style={{ color: colores.textDim }}>
              {" "}
              · principal {conf.horarioPrincipalInicio}–{conf.horarioPrincipalFin}
            </span>
          )}
        </span>
        <button type="button" onClick={onEditar} style={{ background: "none", border: "none", color: colores.copper, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
          ✎ Editar
        </button>
      </div>
    </div>
  );
}

const GRADOS_ELECTRIFICACION_UI = [
  { valor: "basica", label: "Básica (5750W)" },
  { valor: "elevada", label: "Elevada (9200W)" },
];

// ITC-BT-15 apdo.3.b — usuario, 2026-11-21, documento "ITC-BT-15":
// determina el límite de caída de tensión de la derivación individual
// (ver limiteCaidaTensionDI_REBT en modules/motor/simultaneidadREBT.ts),
// que a su vez habilita la compensación ITC-BT-19 §2.2.2 contra el
// límite de instalación interior. Opcional — sin elegirlo, la
// compensación simplemente no se aplica (se sigue con el límite de
// instalación interior solo, como hasta ahora).
const ESQUEMAS_CONTADORES_UI = [
  { valor: "concentrados_mas_de_un_lugar", label: "Concentrados en más de un lugar (0,5%)" },
  { valor: "totalmente_concentrados", label: "Totalmente concentrados (1%)" },
];

/**
 * Edificio de viviendas REBT ITC-BT-10 (usuario, 2026-11-19): este
 * tablero es "la gestión de la conexión del edificio" — sus hijos
 * directos se tratan como viviendas (cada una sigue "gestionándose" a
 * sí misma con sus propios circuitos, sin cambios). Mismo patrón de
 * bloque que BloqueConmutacion. El cálculo real vive en
 * TableroMediator.calcularAlimentadorAgregado — ver
 * modules/motor/simultaneidadREBT.js para la Tabla 1 verificada contra
 * el texto oficial.
 */
function BloqueSimultaneidadREBT({ tablero, alimentador, onEditarTablero }) {
  const [editando, setEditando] = useState(false);
  const conf = tablero.simultaneidadREBT;
  const FORM_VACIO_SIMULTANEIDAD = { activa: false, gradoPorDefecto: "basica", esquemaContadores: "" };
  const [form, setForm] = useState(() => conf ?? FORM_VACIO_SIMULTANEIDAD);

  function abrirEdicion() {
    setForm(conf ?? FORM_VACIO_SIMULTANEIDAD);
    setEditando(true);
  }

  function guardar() {
    onEditarTablero(tablero.id, { simultaneidadREBT: { ...form, activa: true } });
    setEditando(false);
  }

  function desactivar() {
    onEditarTablero(tablero.id, { simultaneidadREBT: { ...form, activa: false } });
    setEditando(false);
  }

  const titulo = (
    <div style={{ fontSize: 10.5, color: colores.textDim, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
      Simultaneidad REBT (ITC-BT-10)
    </div>
  );

  const detalle = alimentador?.ok ? alimentador.simultaneidadREBT : null;

  if (!editando) {
    return (
      <div>
        {titulo}
        {conf?.activa ? (
          <div style={{ fontSize: 11.5, color: colores.textMain, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>
              Edificio de viviendas — grado por defecto <strong>{GRADOS_ELECTRIFICACION_UI.find((g) => g.valor === conf.gradoPorDefecto)?.label}</strong>
              {detalle && (
                <span style={{ color: colores.textDim }}>
                  {" "}
                  · {detalle.n} vivienda{detalle.n !== 1 ? "s" : ""} · coeficiente {detalle.coeficiente} · carga {(detalle.cargaW / 1000).toFixed(2)}kW
                </span>
              )}
              {conf.esquemaContadores ? (
                <span style={{ color: colores.textDim }}> · DI (ITC-BT-15): {ESQUEMAS_CONTADORES_UI.find((e) => e.valor === conf.esquemaContadores)?.label}</span>
              ) : (
                <span style={{ color: colores.textDim }}> · sin esquema de contadores (sin compensación ITC-BT-19 con la instalación interior)</span>
              )}
            </span>
            <button type="button" onClick={abrirEdicion} style={{ background: "none", border: "none", color: colores.copper, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
              ✎ Editar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={abrirEdicion}
            style={{ background: "none", border: "none", color: colores.copper, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}
          >
            + Activar simultaneidad de viviendas (edificio REBT)
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${colores.border}`, borderRadius: 4, padding: 10 }}>
      {titulo}
      <div style={{ fontSize: 10.5, color: colores.textDim, lineHeight: 1.4, marginBottom: 8 }}>
        Trata los tableros HIJOS directos de este tablero como viviendas de un mismo edificio (ITC-BT-10 §3.1): la
        demanda se calcula con la media de la potencia prevista de cada vivienda × el coeficiente de simultaneidad
        según su número, en vez de sumarlas al 100%.
      </div>
      <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>
        Grado de electrificación por defecto (para una vivienda que todavía no tiene circuitos propios):
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {GRADOS_ELECTRIFICACION_UI.map((g) => (
          <BotonPill key={g.valor} activo={form.gradoPorDefecto === g.valor} onClick={() => setForm({ ...form, gradoPorDefecto: g.valor })}>
            {g.label}
          </BotonPill>
        ))}
      </div>
      <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>
        Esquema de contadores (ITC-BT-15, opcional — habilita la compensación de caída de tensión con la instalación interior de ITC-BT-19 §2.2.2):
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {ESQUEMAS_CONTADORES_UI.map((e) => (
          <BotonPill
            key={e.valor}
            activo={form.esquemaContadores === e.valor}
            onClick={() => setForm({ ...form, esquemaContadores: e.valor === form.esquemaContadores ? "" : e.valor })}
          >
            {e.label}
          </BotonPill>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={guardar}
          style={{ flex: 1, padding: "6px 0", borderRadius: 3, border: "none", background: colores.copper, color: colores.textSobreAcento, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
        >
          Guardar
        </button>
        {conf?.activa && (
          <button
            type="button"
            onClick={desactivar}
            style={{ padding: "6px 10px", background: "transparent", color: colores.error, border: `1px solid ${colores.border}`, borderRadius: 3, fontSize: 11.5, cursor: "pointer" }}
          >
            Desactivar
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditando(false)}
          style={{ padding: "6px 10px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontSize: 11.5, cursor: "pointer" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Grado de electrificación de ESTE tablero cuando actúa como vivienda bajo el modo REBT de su padre — solo visible en ese caso. */
function SelectorGradoVivienda({ tablero, onEditarTablero }) {
  return (
    <div style={{ fontSize: 11, color: colores.textDim, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span>Grado de electrificación de esta vivienda (si todavía no tiene circuitos propios):</span>
      {GRADOS_ELECTRIFICACION_UI.map((g) => (
        <BotonPill key={g.valor} flex="0 0 auto" activo={tablero.gradoElectrificacion === g.valor} onClick={() => onEditarTablero(tablero.id, { gradoElectrificacion: g.valor })}>
          <span style={{ padding: "0 8px" }}>{g.label}</span>
        </BotonPill>
      ))}
      <BotonPill flex="0 0 auto" activo={!tablero.gradoElectrificacion} onClick={() => onEditarTablero(tablero.id, { gradoElectrificacion: null })}>
        <span style={{ padding: "0 8px" }}>Según el edificio</span>
      </BotonPill>
    </div>
  );
}

function BloqueBalanceFases({ balance }) {
  if (!balance || !balance.aplica) return null;

  if (!balance.ok) {
    return (
      <div style={{ fontSize: 11.5, color: colores.textDim, lineHeight: 1.4 }}>
        Balance de fases pendiente: {balance.motivo}
      </div>
    );
  }

  const { porLinea, porcentajeDesbalance, limitePct, excede, advertencias, contribuyentesPorLinea } = balance;
  const color = colorSeveridadBalance(porcentajeDesbalance, limitePct);
  const entradas = Object.entries(porLinea);
  const maxValor = Math.max(...entradas.map(([, v]) => v));
  const [lineaMax] = entradas.reduce((a, b) => (b[1] > a[1] ? b : a));
  const [lineaMin] = entradas.reduce((a, b) => (b[1] < a[1] ? b : a));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, color: colores.textDim, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Balance de fases
        </span>
        <span style={{ fontFamily: fuentes.mono, fontSize: 12, color, fontWeight: 700 }}>
          {porcentajeDesbalance.toFixed(1)}%
        </span>
        <span style={{ fontSize: 10.5, color: colores.textDim }}>(umbral {limitePct}%)</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
        {entradas.map(([linea, valor]) => {
          const barColor = linea === lineaMax ? color : linea === lineaMin ? colores.textDim : colores.copper;
          const ancho = maxValor > 0 ? (valor / maxValor) * 100 : 0;
          return (
            <div key={linea} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 20, fontFamily: fuentes.mono, fontSize: 10.5, color: colores.textDim }}>{linea}</span>
              <div style={{ flex: 1, height: 7, background: colores.bg, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${ancho}%`, height: "100%", background: barColor }} />
              </div>
              <span style={{ width: 54, textAlign: "right", fontFamily: fuentes.mono, fontSize: 10.5, color: colores.textMain }}>
                {valor.toFixed(1)}A
              </span>
            </div>
          );
        })}
      </div>

      {advertencias?.map((a, i) => (
        <div key={i} style={{ color: colores.warn, fontSize: 11, marginBottom: 4 }}>
          ⚠ {a}
        </div>
      ))}

      {excede && (
        <div
          style={{
            fontSize: 11,
            color: colores.textDim,
            background: colores.errorFondo,
            border: `1px solid ${colores.errorBorde}`,
            borderRadius: 4,
            padding: 8,
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          <div style={{ color: colores.error, fontWeight: 600, marginBottom: 4 }}>
            Sugerencia para mejorar el balance (a criterio del instalador):
          </div>
          <div>
            La línea <strong style={{ color: colores.textMain }}>{lineaMax}</strong> lleva {porLinea[lineaMax].toFixed(1)}A, la más
            cargada; <strong style={{ color: colores.textMain }}>{lineaMin}</strong> lleva solo {porLinea[lineaMin].toFixed(1)}A.
            Considerá reasignar alguno de estos de {lineaMax} hacia {lineaMin} u otra línea más descargada:
          </div>
          <ul style={{ margin: "4px 0 4px 18px", padding: 0 }}>
            {(contribuyentesPorLinea?.[lineaMax] ?? [])
              .slice()
              .sort((a, b) => b.corrienteA - a.corrienteA)
              .map((item) => (
                <li key={item.id}>
                  {item.nombre} ({item.tipo === "subtablero" ? "subtablero" : "circuito"}) — {item.corrienteA.toFixed(1)}A
                </li>
              ))}
          </ul>
          <div style={{ fontStyle: "italic" }}>
            La decisión final de qué mover —o si conviene hacerlo— queda a criterio del instalador/electricista responsable del
            proyecto.
          </div>
        </div>
      )}
    </div>
  );
}

// Mismo patrón de acordeón que TablaResultados: lista colapsada, clic
// despliega el detalle del tablero seleccionado (sus circuitos y su
// alimentador ya calculado). Fase 3 (dato relacional) + Fase 4
// (alimentador: longitud, material, fases, tableroPadreId) — cero
// gráfico, eso es Fase 6 (esquema unifilar).
//
// tableroPadreId ya se captura y se puede elegir de entre los tableros
// existentes, pero encadenarlo hacia arriba (subpaneles, jerarquía
// visual) es el siguiente paso, no esta sesión — acá solo se muestra
// de qué tablero depende, sin construir el árbol completo.
export default function PanelTableros({
  tableros,
  circuitos = [],
  resultados = [],
  circuitosDeTablero,
  circuitosSinTablero,
  alimentadores,
  balancesFases = {},
  crearTablero,
  editarTablero,
  eliminarTablero,
  listaIntegridad = [],
  normativaActiva,
  tipoInstalacion,
  fuentesEnergia = [],
  transformadores = [],
  crearTransformador,
}) {
  const [tableroActivoId, setTableroActivoId] = useState(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  // Cuando se crea desde el botón "+ Agregar subtablero" de un tablero
  // puntual, el padre queda resuelto de una (no hay que buscarlo en el
  // dropdown) — guardamos el objeto completo para mostrar su nombre sin
  // tener que volver a buscarlo por id.
  const [padreForzado, setPadreForzado] = useState(null);
  // Mini-formulario inline para Transformador — solo visible
  // cuando tipoInstalacion === TIPOS_INSTALACION.COMERCIAL_INDUSTRIAL (ver TIPOS_ORIGEN.
  // TRANSFORMADOR en modules/origen/index.js).
  const [nuevoTransformadorAbierto, setNuevoTransformadorAbierto] = useState(false);
  const [formTransformador, setFormTransformador] = useState(FORM_TRANSFORMADOR_VACIO);

  const normativa = App.normativa.obtener(normativaActiva);
  const voltajesEstandar = normativa.voltajesPorFase?.[form.fases] ?? [];

  const sinAsignar = circuitosSinTablero();

  // Tensión por defecto para una fase dada, según la normativa activa
  // — el primer valor estándar de esa fase, o "" si la normativa no
  // tiene ninguno definido (no se inventa un número).
  function tensionPorDefecto(fases) {
    const estandar = normativa.voltajesPorFase?.[fases] ?? [];
    return estandar[0] != null ? String(estandar[0]) : "";
  }

  function abrirCreacion() {
    setForm({ ...FORM_VACIO, tensionAlimentacion: tensionPorDefecto("mono"), etiqueta: App.etiquetado.sugerirTablero(tableros) });
    setEditandoId(null);
    setPadreForzado(null);
    setFormAbierto(true);
  }

  // Disparado desde el acordeón de un tablero ya existente: crea un
  // tablero nuevo con tableroPadreId ya resuelto a ESTE tablero — el
  // mismo formulario de siempre, solo que el campo "Tablero padre" no
  // hace falta buscarlo, ya se sabe de dónde cuelga.
  function abrirCreacionSubtablero(tableroPadre) {
    setForm({
      ...FORM_VACIO,
      tensionAlimentacion: tensionPorDefecto("mono"),
      tableroPadreId: tableroPadre.id,
      etiqueta: App.etiquetado.sugerirTablero(tableros),
    });
    setEditandoId(null);
    setPadreForzado(tableroPadre);
    setFormAbierto(true);
  }

  function abrirEdicion(t) {
    // tensionManual se deriva, no se guardó: si la tensión actual del
    // tablero coincide con alguno de los valores estándar de SU fase
    // bajo la normativa activa, se muestra como esa pill seleccionada;
    // si no coincide con ninguno (ej. viene de otra normativa, o se
    // cargó un proyecto hecho bajo otro estándar), se muestra como
    // "Manual" — nunca se le cambia el valor en silencio.
    const estandar = normativa.voltajesPorFase?.[t.fases] ?? [];
    const conf = t.conmutacion;
    setForm({
      nombre: t.nombre,
      etiqueta: t.etiqueta || "",
      funcion: t.funcion || "",
      tensionAlimentacion: String(t.tensionAlimentacion),
      tensionManual: !estandar.includes(Number(t.tensionAlimentacion)),
      fases: t.fases,
      capacidadKW: t.capacidadKW != null && t.capacidadKW !== "" ? String(t.capacidadKW) : "",
      tableroPadreId: t.tableroPadreId ?? "",
      fuenteSecundariaId: conf?.fuenteSecundariaId || "",
      fuenteAuxiliarId: conf?.fuenteAuxiliarId || "",
      modoConmutacion: conf?.modo || App.origen.MODOS_CONMUTACION.FALLA_AUTOMATICA,
      horarioPrincipalInicio: conf?.horarioPrincipalInicio || "",
      horarioPrincipalFin: conf?.horarioPrincipalFin || "",
      longitudAlimentador: t.longitudAlimentador ? String(t.longitudAlimentador) : "",
      materialAlimentador: t.materialAlimentador,
      notas: t.notas || "",
    });
    setEditandoId(t.id);
    setPadreForzado(null); // al editar, el padre sigue siendo elegible desde el dropdown
    setFormAbierto(true);
  }

  function cerrarForm() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setPadreForzado(null);
    setFormAbierto(false);
    setNuevoTransformadorAbierto(false);
    setFormTransformador(FORM_TRANSFORMADOR_VACIO);
  }

  function alGuardar(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    // Arma `conmutacion` acá, a partir de los 3 roles ya elegidos en
    // ESTE mismo formulario (ver nota larga en FORM_VACIO) — la
    // principal SIEMPRE espeja tableroPadreId, nunca se guarda un
    // valor independiente que se pueda desincronizar.
    const datos = {
      ...form,
      conmutacion: App.origen.normalizarConmutacion({
        activa: !!(form.fuenteSecundariaId || form.fuenteAuxiliarId),
        modo: form.modoConmutacion,
        fuentePrincipalId: form.tableroPadreId || "acometida",
        fuenteSecundariaId: form.fuenteSecundariaId,
        fuenteAuxiliarId: form.fuenteAuxiliarId,
        horarioPrincipalInicio: form.horarioPrincipalInicio,
        horarioPrincipalFin: form.horarioPrincipalFin,
      }),
    };
    if (editandoId) {
      editarTablero(editandoId, datos);
    } else {
      const t = crearTablero(datos);
      setTableroActivoId(t.id); // lo abre de una, para ver que se creó bien
    }
    cerrarForm();
  }

  function alEliminar(t) {
    eliminarTablero(t.id);
    if (tableroActivoId === t.id) setTableroActivoId(null);
    if (editandoId === t.id) cerrarForm();
  }

  // Un tablero no puede ser su propio padre — filtro trivial de UI.
  // Nada más (ni ancestros, ni ciclos): esa lógica es el siguiente paso.
  const opcionesPadre = tableros.filter((t) => t.id !== editandoId);

  // Mismas opciones que usaba BloqueConmutacion — Ninguna / Red local /
  // una fuente de energía ya creada (Batería/Generador). Secundaria y
  // auxiliar NO ofrecen tableros ni transformador (fuera de alcance,
  // mismo criterio que tenía el bloque de conmutación original).
  const opcionesSecundariaAuxiliar = [
    { valor: "", label: "— Ninguna —" },
    { valor: "acometida", label: "Red eléctrica local" },
    ...fuentesEnergia.map((f) => ({ valor: f.id, label: f.nombre })),
  ];

  // Sugiere (NUNCA fuerza) secundaria/auxiliar al elegir la fuente
  // PRINCIPAL — pedido explícito del usuario: "si el principal es la
  // red local, la secundaria debe ser por lógica el banco de
  // baterías" (y viceversa), y el generador suele quedar de auxiliar.
  // Solo rellena los campos que el usuario todavía no tocó ("") — una
  // vez que elige algo a mano, no se le vuelve a pisar.
  // `tipoConocido` es para cuando se acaba de CREAR un transformador
  // inline (mini-formulario "+ Nuevo transformador"): el objeto recién
  // creado todavía no está en el array correspondiente (llega en el
  // próximo render, vía el hook) así que buscarlo ahí no lo
  // encontraría — se pasa su tipo de una, ya se sabe.
  function alElegirPrincipal(nuevoPrincipalId, tipoConocido) {
    const fuentePrincipal = fuentesEnergia.find((f) => f.id === nuevoPrincipalId);
    const tipoPrincipal = tipoConocido ?? fuentePrincipal?.tipo;
    let sugerenciaSecundaria = form.fuenteSecundariaId;
    let sugerenciaAuxiliar = form.fuenteAuxiliarId;

    if (!sugerenciaSecundaria) {
      if (!nuevoPrincipalId) {
        const primeraBateria = fuentesEnergia.find((f) => f.tipo === "bateria");
        if (primeraBateria) sugerenciaSecundaria = primeraBateria.id;
      } else if (tipoPrincipal === "bateria") {
        sugerenciaSecundaria = "acometida";
      }
    }
    if (!sugerenciaAuxiliar) {
      const primerGenerador = fuentesEnergia.find((f) => f.tipo === "generador" && f.id !== nuevoPrincipalId && f.id !== sugerenciaSecundaria);
      if (primerGenerador) sugerenciaAuxiliar = primerGenerador.id;
    }

    setForm({ ...form, tableroPadreId: nuevoPrincipalId, fuenteSecundariaId: sugerenciaSecundaria, fuenteAuxiliarId: sugerenciaAuxiliar });
  }

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Tableros
        </div>
        {!formAbierto && (
          <button
            onClick={abrirCreacion}
            style={{ padding: "4px 10px", borderRadius: 3, border: "none", background: colores.copper, color: colores.textSobreAcento, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
          >
            + Nuevo tablero
          </button>
        )}
      </div>

      {formAbierto && (
        <form onSubmit={alGuardar} style={{ border: `1px solid ${colores.border}`, borderRadius: 4, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: colores.copper, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {editandoId ? "Editar tablero" : "Nuevo tablero"}
          </div>

          <Campo label="Nombre del tablero">
            <input
              style={inputStyle()}
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Ej: Tablero principal, Subpanel cocina"
            />
          </Campo>

          <div style={{ display: "grid", gridTemplateColumns: "0.6fr 1.4fr", gap: 10 }}>
            <Campo label="Etiqueta">
              <input style={inputStyle()} value={form.etiqueta} onChange={(e) => setForm({ ...form, etiqueta: e.target.value })} placeholder="Ej: TD1" />
            </Campo>
            <Campo label="Función (opcional)">
              <input style={inputStyle()} value={form.funcion} onChange={(e) => setForm({ ...form, funcion: e.target.value })} placeholder="Ej: Alimenta el área de producción" />
            </Campo>
          </div>

          <Campo label="Fases del alimentador">
            <div style={{ display: "flex", gap: 6 }}>
              {/* Residencial básico oculta "Tri" — mismo criterio que
                  fasesDisponibles en FormularioCircuito.jsx (se había
                  quedado sin aplicar acá; bug reportado por el usuario
                  vía captura, 2026-11-19 — confirmado ya corregido en
                  el circuito, pero no en el alimentador del tablero). */}
              {(tipoInstalacion === TIPOS_INSTALACION.RESIDENCIAL_BASICO ? FASES.filter((f) => f.valor !== "tri") : FASES).map((f) => (
                <BotonPill
                  key={f.valor}
                  activo={form.fases === f.valor}
                  onClick={() =>
                    setForm({
                      ...form,
                      fases: f.valor,
                      // Mismo criterio que cambiarFasesCircuito: si la
                      // tensión no fue puesta a mano, se sigue el
                      // estándar de la normativa para la fase nueva.
                      tensionAlimentacion: form.tensionManual ? form.tensionAlimentacion : tensionPorDefecto(f.valor),
                    })
                  }
                >
                  {f.label}
                </BotonPill>
              ))}
            </div>
          </Campo>

          <Campo label={`Tensión alimentación (${normativa.id})`}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {voltajesEstandar.map((v) => (
                <BotonPill
                  key={v}
                  flex="0 0 auto"
                  activo={!form.tensionManual && Number(form.tensionAlimentacion) === v}
                  onClick={() => setForm({ ...form, tensionAlimentacion: String(v), tensionManual: false })}
                >
                  <span style={{ padding: "0 10px" }}>{v}V</span>
                </BotonPill>
              ))}
              <BotonPill flex="0 0 auto" activo={form.tensionManual} onClick={() => setForm({ ...form, tensionManual: true })}>
                <span style={{ padding: "0 10px" }}>Manual</span>
              </BotonPill>
            </div>
            {form.tensionManual && (
              <input
                style={{ ...inputStyle(), marginTop: 8 }}
                type="number"
                placeholder="Tensión del alimentador (V)"
                value={form.tensionAlimentacion}
                onChange={(e) => setForm({ ...form, tensionAlimentacion: e.target.value })}
              />
            )}
          </Campo>

          <Campo label="Capacidad contratada (kW, opcional)">
            <input
              style={inputStyle()}
              type="number"
              step="0.01"
              value={form.capacidadKW}
              onChange={(e) => setForm({ ...form, capacidadKW: e.target.value })}
              placeholder="Ej: 5.75 (básica REBT), 9.2 (elevada REBT)"
            />
          </Campo>

          {padreForzado ? (
            <Campo label="Tablero padre">
              <div style={{ ...inputStyle(), display: "flex", alignItems: "center", color: colores.textMain, background: "transparent" }}>
                Cuelga de: <strong style={{ marginLeft: 4 }}>{padreForzado.nombre}</strong>
              </div>
            </Campo>
          ) : (
            <Campo label={`Fuente de energía — Principal (red local, tablero padre, batería, generador${tipoInstalacion === TIPOS_INSTALACION.COMERCIAL_INDUSTRIAL ? " o transformador" : ""})`}>
              <select
                style={inputStyle()}
                value={form.tableroPadreId}
                onChange={(e) => alElegirPrincipal(e.target.value)}
              >
                <option value="">— Red eléctrica local (acometida / poste) —</option>
                {opcionesPadre.length > 0 && (
                  <optgroup label="Tableros">
                    {opcionesPadre.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </optgroup>
                )}
                {fuentesEnergia.length > 0 && (
                  <optgroup label="Fuentes de energía">
                    {fuentesEnergia.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nombre} ({TIPOS_FUENTE_UI.find((t) => t.valor === f.tipo)?.label})
                      </option>
                    ))}
                  </optgroup>
                )}
                {/* Transformador: origen seleccionable SOLO en instalación industrial — ver
                    TIPOS_ORIGEN.TRANSFORMADOR en modules/origen/index.js. */}
                {tipoInstalacion === TIPOS_INSTALACION.COMERCIAL_INDUSTRIAL && transformadores.length > 0 && (
                  <optgroup label="Transformadores">
                    {transformadores.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre} ({t.fases}
                        {t.tensionPrimariaV && t.tensionSecundariaV ? ` · ${t.tensionPrimariaV}V→${t.tensionSecundariaV}V` : ""})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {/* Crear una fuente nueva (Batería/Generador) se hace en el
                  panel "Declarar fuente de energía" (PanelFuentesEnergia),
                  no acá — usuario, 2026-11-22: el mini-formulario inline
                  que vivía en este mismo lugar duplicaba esa acción y
                  confundía (dos lugares para "crear fuente"). Este
                  selector solo ELIGE entre las fuentes ya declaradas. */}

              {tipoInstalacion === TIPOS_INSTALACION.COMERCIAL_INDUSTRIAL && crearTransformador && (
                <div style={{ marginTop: 8 }}>
                  {nuevoTransformadorAbierto ? (
                    <div style={{ border: `1px solid ${colores.border}`, borderRadius: 3, padding: 8 }}>
                      <input
                        style={{ ...inputStyle(), marginBottom: 6 }}
                        value={formTransformador.nombre}
                        onChange={(e) => setFormTransformador({ ...formTransformador, nombre: e.target.value })}
                        placeholder="Ej: Transformador reductor 480V→240V"
                      />
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        {FASES.filter((f) => f.valor !== "bi").map((f) => (
                          <BotonPill key={f.valor} activo={formTransformador.fases === f.valor} onClick={() => setFormTransformador({ ...formTransformador, fases: f.valor })}>
                            {f.label}
                          </BotonPill>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                        <input
                          style={inputStyle()}
                          type="number"
                          value={formTransformador.tensionPrimariaV}
                          onChange={(e) => setFormTransformador({ ...formTransformador, tensionPrimariaV: e.target.value })}
                          placeholder="Tensión primaria (V)"
                        />
                        <input
                          style={inputStyle()}
                          type="number"
                          value={formTransformador.tensionSecundariaV}
                          onChange={(e) => setFormTransformador({ ...formTransformador, tensionSecundariaV: e.target.value })}
                          placeholder="Tensión secundaria (V)"
                        />
                      </div>
                      <div style={{ fontSize: 10.5, color: colores.textDim, marginBottom: 8 }}>
                        Capacidad (kVA), conexión Y/Δ y %Z todavía no tienen campo acá — se completan más adelante, cuando
                        haya un proyecto industrial real que los necesite.
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          disabled={!formTransformador.nombre.trim()}
                          onClick={() => {
                            const transformador = crearTransformador(formTransformador);
                            alElegirPrincipal(transformador.id, "transformador");
                            setFormTransformador(FORM_TRANSFORMADOR_VACIO);
                            setNuevoTransformadorAbierto(false);
                          }}
                          style={{
                            flex: 1,
                            padding: "6px 0",
                            borderRadius: 3,
                            border: "none",
                            background: formTransformador.nombre.trim() ? colores.copper : colores.border,
                            color: formTransformador.nombre.trim() ? colores.textSobreAcento : colores.textDim,
                            fontWeight: 700,
                            fontSize: 11.5,
                            cursor: formTransformador.nombre.trim() ? "pointer" : "not-allowed",
                          }}
                        >
                          + Crear y usar como origen
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormTransformador(FORM_TRANSFORMADOR_VACIO);
                            setNuevoTransformadorAbierto(false);
                          }}
                          style={{ padding: "6px 10px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontSize: 11.5, cursor: "pointer" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNuevoTransformadorAbierto(true)}
                      style={{ background: "none", border: "none", color: colores.copper, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}
                    >
                      + Nuevo transformador
                    </button>
                  )}
                </div>
              )}
            </Campo>
          )}

          {tipoInstalacion !== TIPOS_INSTALACION.RESIDENCIAL_BASICO ? (
          <>
          <Campo label="Fuente de energía — Secundaria (autoconsumo, opcional)">
            <select
              style={inputStyle()}
              value={form.fuenteSecundariaId}
              onChange={(e) => setForm({ ...form, fuenteSecundariaId: e.target.value })}
            >
              {opcionesSecundariaAuxiliar.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.label}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Fuente de energía — Auxiliar (ej. generador ante falla, opcional)">
            <select
              style={inputStyle()}
              value={form.fuenteAuxiliarId}
              onChange={(e) => setForm({ ...form, fuenteAuxiliarId: e.target.value })}
            >
              {opcionesSecundariaAuxiliar.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.label}
                </option>
              ))}
            </select>
          </Campo>

          {(form.fuenteSecundariaId || form.fuenteAuxiliarId) && (
            <Campo label="Modo de cambio entre fuentes">
              <div style={{ display: "flex", gap: 6, marginBottom: form.modoConmutacion === "horario" ? 8 : 0 }}>
                {MODOS_CONMUTACION_UI.map((m) => (
                  <BotonPill key={m.valor} activo={form.modoConmutacion === m.valor} onClick={() => setForm({ ...form, modoConmutacion: m.valor })}>
                    {m.label}
                  </BotonPill>
                ))}
              </div>
              {form.modoConmutacion === "horario" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Principal desde:</div>
                    <input
                      type="time"
                      style={inputStyle()}
                      value={form.horarioPrincipalInicio}
                      onChange={(e) => setForm({ ...form, horarioPrincipalInicio: e.target.value })}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Principal hasta:</div>
                    <input
                      type="time"
                      style={inputStyle()}
                      value={form.horarioPrincipalFin}
                      onChange={(e) => setForm({ ...form, horarioPrincipalFin: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </Campo>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Campo label="Distancia de la fuente de energía (m)">
              <input
                style={inputStyle()}
                type="number"
                value={form.longitudAlimentador}
                onChange={(e) => setForm({ ...form, longitudAlimentador: e.target.value })}
                placeholder="Desde la fuente de energía"
              />
            </Campo>
            <Campo label="Material del conductor">
              <div style={{ display: "flex", gap: 6 }}>
                {["cobre", "aluminio"].map((m) => (
                  <BotonPill key={m} activo={form.materialAlimentador === m} onClick={() => setForm({ ...form, materialAlimentador: m })}>
                    <span style={{ textTransform: "capitalize" }}>{m}</span>
                  </BotonPill>
                ))}
              </div>
            </Campo>
          </div>
          <div style={{ fontSize: 10.5, color: colores.textDim, lineHeight: 1.4, margin: "-4px 0 12px" }}>
            Distancia medida desde la fuente de energía (red local, batería, generador, tablero padre o transformador) hasta este tablero.
          </div>
          </>
          ) : (
            fuentesEnergia.some((f) => f.id === form.tableroPadreId) && (
              <div style={{ fontSize: 10.5, color: colores.textDim, lineHeight: 1.4, margin: "-4px 0 12px" }}>
                La distancia, el material del conductor y el rol (principal/secundaria/auxiliar) de esta fuente se configuran en la pestaña "Fuentes de energía".
              </div>
            )
          )}

          <Campo label="Notas (opcional)">
            <textarea
              style={{ ...inputStyle(), minHeight: 50, resize: "vertical", fontFamily: "inherit" }}
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Cualquier detalle útil para la memoria del proyecto — ej. ubicación del banco de baterías, marca/modelo del generador, horario esperado de conmutación…"
            />
          </Campo>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={!form.nombre.trim()}
              style={{
                flex: 1,
                padding: "9px 0",
                borderRadius: 3,
                border: "none",
                background: form.nombre.trim() ? colores.copper : colores.border,
                color: form.nombre.trim() ? colores.textSobreAcento : colores.textDim,
                fontWeight: 700,
                fontSize: 13,
                cursor: form.nombre.trim() ? "pointer" : "not-allowed",
              }}
            >
              {editandoId ? "Guardar cambios" : "+ Crear tablero"}
            </button>
            <button
              type="button"
              onClick={cerrarForm}
              style={{ padding: "9px 14px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {tableros.length === 0 ? (
        <div style={{ color: colores.textDim, fontSize: 12.5, textAlign: "center", padding: "10px 0" }}>
          Todavía no creaste ningún tablero.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {tableros.map((t) => {
            const circuitosDelTablero = circuitosDeTablero(t.id);
            // El origen puede ser otro tablero O una fuente de energía
            // (Batería/Generador) — se resuelven por separado porque
            // solo un tablero tiene `fases` (relevante para el
            // selector de líneas del alimentador más abajo).
            const origenResuelto = t.tableroPadreId ? App.origen.resolver(t.tableroPadreId, tableros, fuentesEnergia, transformadores) : { tipo: "acometida" };
            const padre = origenResuelto.tipo === "tablero" ? origenResuelto.tablero : null;
            const padreFuente =
              origenResuelto.tipo === App.origen.TIPOS_FUENTE_ENERGIA.RED_LOCAL ||
              origenResuelto.tipo === App.origen.TIPOS_FUENTE_ENERGIA.BATERIA ||
              origenResuelto.tipo === App.origen.TIPOS_FUENTE_ENERGIA.GENERADOR
                ? origenResuelto.fuente
                : null;
            const padreTransformador = origenResuelto.tipo === "transformador" ? origenResuelto.transformador : null;
            const activo = tableroActivoId === t.id;
            // Integridad de ESTE tablero (tableroPadreId inexistente,
            // auto-referencia, sin circuitos asociados) — mismo patrón
            // que TablaResultados.jsx ya usa para circuitos, hasta hoy
            // nunca conectado acá.
            const entradaIntegridad = listaIntegridad.find((e) => e.tipo === "tablero" && e.id === t.id);
            const colorEstado = entradaIntegridad
              ? entradaIntegridad.estado === "error"
                ? colores.error
                : entradaIntegridad.estado === "advertencia"
                  ? colores.warn
                  : colores.ok
              : colores.ok;
            return (
              <div
                key={t.id}
                style={{
                  border: `1px solid ${activo ? colores.copper : colores.border}`,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  onClick={() => setTableroActivoId(activo ? null : t.id)}
                  style={{
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    background: activo ? colores.copperFondo : "transparent",
                  }}
                >
                  <span style={{ color: colores.textDim, fontSize: 11, width: 12, textAlign: "center" }}>{activo ? "▾" : "▸"}</span>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: colorEstado, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: colores.textMain }}>{t.nombre}</div>
                    <div style={{ fontFamily: fuentes.mono, fontSize: 11, color: colores.textDim }}>
                      {t.tensionAlimentacion}V · {t.fases} · {circuitosDelTablero.length} circuito{circuitosDelTablero.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirEdicion(t);
                    }}
                    style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 13 }}
                    aria-label={`Editar tablero ${t.nombre}`}
                    title="Editar tablero"
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      alEliminar(t);
                    }}
                    style={{ background: "none", border: "none", color: colores.textDim, cursor: "pointer", fontSize: 15 }}
                    aria-label={`Eliminar tablero ${t.nombre}`}
                    title="Eliminar tablero (los circuitos quedan sin asignar, no se borran)"
                  >
                    ×
                  </button>
                </div>

                {activo && (
                  <div style={{ borderTop: `1px solid ${colores.border}`, padding: "10px 12px 12px 30px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {entradaIntegridad?.problemas?.length > 0 && (
                      <div>
                        {entradaIntegridad.problemas.map((p, i) => (
                          <div
                            key={i}
                            style={{ color: entradaIntegridad.estado === "error" ? colores.error : colores.warn, fontSize: 11.5, display: "flex", gap: 6, alignItems: "flex-start" }}
                            title="Integridad de datos, no cálculo eléctrico"
                          >
                            <span>🗂</span> <span>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ fontSize: 11.5, color: colores.textDim, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span>
                        Alimenta desde:{" "}
                        <strong style={{ color: colores.textMain }}>{etiquetaFuentePrincipal(padre, padreFuente, padreTransformador)}</strong>
                        {etiquetaDistanciaAlimentador(t, padreFuente) && ` · ${etiquetaDistanciaAlimentador(t, padreFuente)}`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirCreacionSubtablero(t);
                        }}
                        style={{ flexShrink: 0, padding: "3px 8px", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.copper, fontWeight: 700, fontSize: 11, cursor: "pointer" }}
                      >
                        + Subtablero
                      </button>
                    </div>

                    {padre?.simultaneidadREBT?.activa && <SelectorGradoVivienda tablero={t} onEditarTablero={editarTablero} />}

                    <BloqueAlimentador resultado={alimentadores?.[t.id]} />

                    <BloqueCortocircuito
                      resultado={App.tablero.cortocircuitoDesdeTablero(t.id, { tableros, circuitos, resultados, normativaId: normativaActiva, fuentesEnergia, transformadores })}
                    />

                    {padre && padre.fases !== "mono" && (
                      <SelectorLineasAlimentador tablero={t} padre={padre} onEditarTablero={editarTablero} />
                    )}

                    <BloqueBalanceFases balance={balancesFases?.[t.id]} />

                    <ResumenFuentesEnergia
                      tablero={t}
                      fuentesEnergia={fuentesEnergia}
                      nombreFuentePrincipal={etiquetaFuentePrincipal(padre, padreFuente, padreTransformador)}
                      onEditar={() => abrirEdicion(t)}
                    />

                    {normativaActiva === "IEC_ES" && (
                      <BloqueSimultaneidadREBT tablero={t} alimentador={alimentadores?.[t.id]} onEditarTablero={editarTablero} />
                    )}

                    <div>
                      <div style={{ fontSize: 10.5, color: colores.textDim, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                        Circuitos
                      </div>
                      {circuitosDelTablero.length === 0 ? (
                        <div style={{ fontSize: 12, color: colores.textDim }}>
                          Sin circuitos asignados — usá el selector de tablero en cada circuito de la lista.
                        </div>
                      ) : (
                        circuitosDelTablero.map((c) => (
                          <div key={c.id} style={{ fontSize: 12.5, color: colores.textMain, padding: "3px 0" }}>
                            {c.nombre || "(sin nombre)"}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sinAsignar.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${colores.border}` }}>
          <div style={{ fontSize: 11, color: colores.warn }}>
            ⚠ {sinAsignar.length} circuito{sinAsignar.length !== 1 ? "s" : ""} sin tablero asignado todavía.
          </div>
        </div>
      )}
    </div>
  );
}
