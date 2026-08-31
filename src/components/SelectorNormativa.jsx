import React, { useState, useEffect } from "react";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";

// Catálogo vía NormativaMediator (no import directo de módulos de normativa)
const LISTA_NORMATIVAS = App.normativa.listar().map((meta) => App.normativa.obtener(meta.id));
import { colores, fuentes } from "../styles/colores";

// Agrupa por familia manteniendo el orden de LISTA_NORMATIVAS (NEC, CIEN, IEC...)
function agruparPorFamilia(lista) {
  const familias = [];
  const mapa = new Map();
  for (const n of lista) {
    if (!mapa.has(n.familia)) {
      mapa.set(n.familia, []);
      familias.push(n.familia);
    }
    mapa.get(n.familia).push(n);
  }
  return familias.map((familia) => ({ familia, opciones: mapa.get(familia) }));
}

const estiloBotonPrincipal = (activo) => ({
  flex: 1,
  padding: "8px 6px",
  borderRadius: 3,
  border: `1px solid ${activo ? colores.copper : colores.border}`,
  background: activo ? colores.copper : "transparent",
  color: activo ? "#171512" : colores.textMain,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  textAlign: "left",
});

const estiloBotonSecundario = (habilitado) => ({
  flex: 1,
  padding: "8px 6px",
  borderRadius: 3,
  border: `1px solid ${colores.border}`,
  background: "transparent",
  color: habilitado ? colores.textMain : colores.textDim,
  fontWeight: 700,
  fontSize: 12,
  cursor: habilitado ? "pointer" : "not-allowed",
  opacity: habilitado ? 1 : 0.5,
  textAlign: "left",
});

const estiloOpcionLista = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "7px 10px",
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${colores.border}`,
  color: colores.textMain,
  fontSize: 12,
  cursor: "pointer",
};

export default function SelectorNormativa({ normativaActiva, setNormativaActiva, circuitos = [] }) {
  const grupos = agruparPorFamilia(LISTA_NORMATIVAS);
  const normativaActivaObj = LISTA_NORMATIVAS.find((n) => n.id === normativaActiva);

  // Selección PENDIENTE (todavía no aplicada) — arranca igual a la activa.
  const [familiaPendiente, setFamiliaPendiente] = useState(normativaActivaObj?.familia);
  const [idPendiente, setIdPendiente] = useState(normativaActiva);

  const [abiertoFamilia, setAbiertoFamilia] = useState(false);
  const [abiertoVariante, setAbiertoVariante] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  // Si la normativa activa cambia desde afuera (ej. se abrió un proyecto
  // guardado), la selección pendiente se resincroniza.
  useEffect(() => {
    const activa = LISTA_NORMATIVAS.find((n) => n.id === normativaActiva);
    setFamiliaPendiente(activa?.familia);
    setIdPendiente(normativaActiva);
    setConfirmando(false);
    setAbiertoFamilia(false);
    setAbiertoVariante(false);
  }, [normativaActiva]);

  const grupoPendiente = grupos.find((g) => g.familia === familiaPendiente);
  const tieneVariantes = (grupoPendiente?.opciones.length ?? 0) > 1;
  const normativaPendienteObj = LISTA_NORMATIVAS.find((n) => n.id === idPendiente);
  const hayCambioPendiente = idPendiente !== normativaActiva;

  function elegirFamilia(familia) {
    const opciones = grupos.find((g) => g.familia === familia)?.opciones ?? [];
    setFamiliaPendiente(familia);
    setIdPendiente(opciones[0]?.id); // por defecto, la primera variante de esa familia
    setAbiertoFamilia(false);
    setConfirmando(false);
  }

  function elegirVariante(id) {
    setIdPendiente(id);
    setAbiertoVariante(false);
    setConfirmando(false);
  }

  function alValidar() {
    if (!hayCambioPendiente) return; // nada que aplicar
    if (circuitos.length > 0) {
      setConfirmando(true);
    } else {
      setNormativaActiva(idPendiente);
    }
  }

  function confirmarCambio() {
    setNormativaActiva(idPendiente);
    setConfirmando(false);
  }

  function cancelarCambio() {
    setFamiliaPendiente(normativaActivaObj?.familia);
    setIdPendiente(normativaActiva);
    setConfirmando(false);
  }

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 14 }}>
      <div style={{ fontSize: 11, color: colores.textDim, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
        Normativa
      </div>

      <div style={{ display: "flex", gap: 8, position: "relative" }}>
        {/* Botón 1 — Normativa (familia) */}
        <div style={{ flex: 1, position: "relative" }}>
          <button
            style={estiloBotonPrincipal(false)}
            onClick={() => {
              setAbiertoFamilia((v) => !v);
              setAbiertoVariante(false);
            }}
          >
            {familiaPendiente ?? "Normativa"} ▾
          </button>
          {abiertoFamilia && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                background: colores.bg,
                border: `1px solid ${colores.copper}`,
                borderRadius: 3,
                zIndex: 20,
                overflow: "hidden",
              }}
            >
              {grupos.map((g) => (
                <button key={g.familia} style={estiloOpcionLista} onClick={() => elegirFamilia(g.familia)}>
                  {g.familia}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Botón 2 — Variante regional (solo si la familia tiene más de una) */}
        <div style={{ flex: 1, position: "relative" }}>
          <button
            style={estiloBotonSecundario(tieneVariantes)}
            disabled={!tieneVariantes}
            onClick={() => {
              if (!tieneVariantes) return;
              setAbiertoVariante((v) => !v);
              setAbiertoFamilia(false);
            }}
          >
            {tieneVariantes ? `${normativaPendienteObj?.region ?? "Variante"} ▾` : "— sin variantes —"}
          </button>
          {abiertoVariante && tieneVariantes && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                background: colores.bg,
                border: `1px solid ${colores.copper}`,
                borderRadius: 3,
                zIndex: 20,
                overflow: "hidden",
              }}
            >
              {grupoPendiente.opciones.map((n) => (
                <button key={n.id} style={estiloOpcionLista} onClick={() => elegirVariante(n.id)}>
                  {n.region ?? n.nombre}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Botón 3 — Validar (confirma y guarda para el proyecto) */}
        <button
          style={{
            ...estiloBotonPrincipal(!hayCambioPendiente),
            flex: "0 0 90px",
            textAlign: "center",
            background: hayCambioPendiente ? colores.warn : colores.border,
            color: hayCambioPendiente ? "#171512" : colores.textDim,
            border: `1px solid ${hayCambioPendiente ? colores.warn : colores.border}`,
            cursor: hayCambioPendiente ? "pointer" : "default",
          }}
          onClick={alValidar}
        >
          {hayCambioPendiente ? "Validar" : "Aplicada ✓"}
        </button>
      </div>

      {/* Banner de confirmación cuando ya hay circuitos calculados */}
      {confirmando && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            border: `1px solid ${colores.warn}`,
            borderRadius: 3,
            background: "rgba(217,164,65,0.08)",
          }}
        >
          <div style={{ color: colores.warn, fontSize: 12, lineHeight: 1.4, marginBottom: 8 }}>
            ⚠ {circuitos.length} circuito{circuitos.length !== 1 ? "s" : ""} ser{circuitos.length !== 1 ? "án" : "á"}{" "}
            recalculado{circuitos.length !== 1 ? "s" : ""} con {normativaPendienteObj?.nombre}. ¿Continuar?
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ flex: 1, padding: "6px 0", borderRadius: 3, border: "none", background: colores.warn, color: "#171512", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
              onClick={confirmarCambio}
            >
              Continuar y recalcular
            </button>
            <button
              style={{ flex: 1, padding: "6px 0", borderRadius: 3, border: `1px solid ${colores.border}`, background: "transparent", color: colores.textDim, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
              onClick={cancelarCambio}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Nota de validación de la normativa ACTIVA (no la pendiente) */}
      {normativaActivaObj && !normativaActivaObj.validado && !confirmando && (
        <div style={{ color: colores.warn, fontSize: 11, lineHeight: 1.4, marginTop: 10 }}>
          ⚠ {normativaActivaObj.notaValidacion}
        </div>
      )}
    </div>
  );
}
