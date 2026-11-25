import React, { useState } from "react";
import { colores, fuentes } from "../styles/colores";
import { esArchivoPDF } from "../shared/utils/pdfARaster.js";
import { extraerTextoPDF } from "../shared/utils/pdfATexto.js";
import { extraerDeTexto, CONFIG_IA_LOCAL_DEFECTO, ErrorIALocal } from "../modules/iaLocal/ollamaClient.ts";
import { validarExtraccion } from "../modules/iaLocal/esquema.ts";
import { adaptarParaImportar } from "../modules/iaLocal/adaptador.ts";

// Importar un proyecto real (memoria técnica / cálculo eléctrico en
// PDF, no generado por DEC) usando una IA corriendo LOCAL en la propia
// máquina del usuario — pedido explícito, 2026-11-22/23: el usuario
// probó la app con PDFs reales de ejemplo y confirmó que quería que
// DEC reconociera esos documentos, no solo reabrir sus propios
// archivos guardados (ver persistencia/pdf.ts para ESE otro caso). Se
// descartó una IA en la nube a propósito — el texto del documento
// nunca sale de la máquina del usuario (ver ollamaClient.ts).
//
// SIEMPRE pide confirmación antes de cargar nada (preferencia explícita
// del usuario, elegida entre varias opciones) — mismo principio que
// "Importación de equipos por texto": acá además se puede destildar
// circuito por circuito antes de importar.
//
// Requiere que la propia app corra por HTTP (ej. "npm run dev"), no el
// sitio HTTPS publicado — ver nota larga en ollamaClient.ts sobre
// contenido mixto.

const CLAVE_URL = "dec-ia-local-url";
const CLAVE_MODELO = "dec-ia-local-modelo";

function leerGuardado(clave, porDefecto) {
  try {
    return localStorage.getItem(clave) || porDefecto;
  } catch {
    return porDefecto;
  }
}

function guardarEnLocalStorage(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // localStorage puede fallar (modo privado, cuota) — no es crítico acá
  }
}

export default function ImportarProyectoPDF({ onConfirmar, normativaActiva }) {
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [baseUrl, setBaseUrl] = useState(() => leerGuardado(CLAVE_URL, CONFIG_IA_LOCAL_DEFECTO.baseUrl));
  const [modelo, setModelo] = useState(() => leerGuardado(CLAVE_MODELO, CONFIG_IA_LOCAL_DEFECTO.modelo));
  const [cargando, setCargando] = useState(false);
  const [mensajeCargando, setMensajeCargando] = useState("");
  const [error, setError] = useState("");
  const [avisos, setAvisos] = useState([]);
  const [truncado, setTruncado] = useState(false);
  const [resultado, setResultado] = useState(null); // TableroParaImportar[] | null
  const [avisoFinal, setAvisoFinal] = useState("");

  function actualizarUrl(valor) {
    setBaseUrl(valor);
    guardarEnLocalStorage(CLAVE_URL, valor);
  }

  function actualizarModelo(valor) {
    setModelo(valor);
    guardarEnLocalStorage(CLAVE_MODELO, valor);
  }

  async function analizar() {
    if (!archivo) return;
    setError("");
    setResultado(null);
    setAvisoFinal("");
    // Bug reportado por el usuario (captura real, 2026-11-25): analizar
    // un documento CORTO justo después de uno largo mostraba el aviso
    // "el documento es largo" de la corrida ANTERIOR, pegado mientras
    // la nueva corrida todavía estaba en curso — truncado/avisos solo
    // se limpiaban al TERMINAR un análisis con éxito, nunca al EMPEZAR
    // uno nuevo (a diferencia de error/resultado/avisoFinal, que sí).
    setTruncado(false);
    setAvisos([]);
    setCargando(true);
    try {
      setMensajeCargando("Leyendo el PDF…");
      const { texto, paginasLeidas, paginasTotal } = await extraerTextoPDF(archivo);
      if (!texto.trim()) {
        setError("No se pudo extraer texto de este PDF — si es un documento escaneado (imagen), todavía no se puede leer así.");
        return;
      }

      setMensajeCargando(`Analizando con ${modelo}… esto puede tardar hasta un minuto.`);
      const { json, truncado: seTrunco } = await extraerDeTexto(texto, { baseUrl, modelo });

      const { tableros, avisos: avisosValidacion } = validarExtraccion(json);
      const adaptados = adaptarParaImportar(tableros, normativaActiva);

      setResultado(adaptados.map((t) => ({ ...t, incluir: true })));
      setTruncado(seTrunco || paginasLeidas < paginasTotal);
      setAvisos(avisosValidacion);
    } catch (e) {
      if (e instanceof ErrorIALocal) {
        setError(e.message);
      } else {
        setError(`Error inesperado: ${e.message || e}`);
      }
    } finally {
      setCargando(false);
      setMensajeCargando("");
    }
  }

  function alternarCircuito(indiceTablero, indiceCircuito) {
    setResultado((prev) =>
      prev.map((t, i) =>
        i !== indiceTablero
          ? t
          : {
              ...t,
              circuitos: t.circuitos.map((c, j) => (j !== indiceCircuito ? c : { ...c, incluir: !c.incluir })),
            }
      )
    );
  }

  function confirmar() {
    const totalCircuitos = resultado.reduce((acc, t) => acc + t.circuitos.filter((c) => c.incluir && c.valido).length, 0);
    const conteo = onConfirmar(resultado);
    setAvisoFinal(`Importado${conteo.tableros === 1 ? "" : "s"}: ${conteo.tableros} tablero${conteo.tableros === 1 ? "" : "s"}, ${conteo.circuitos} circuito${conteo.circuitos === 1 ? "" : "s"}.`);
    setResultado(null);
    setArchivo(null);
    void totalCircuitos;
    setTimeout(() => setAvisoFinal(""), 6000);
  }

  const totalCircuitosIncluidos = resultado ? resultado.reduce((acc, t) => acc + t.circuitos.filter((c) => c.incluir && c.valido).length, 0) : 0;

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: abierto ? 18 : "10px 18px" }}>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}
      >
        <span style={{ fontSize: 10 }}>{abierto ? "▾" : "▸"}</span>
        ¿Tenés una memoria técnica en PDF? Importar con IA local (experimental)
      </button>

      {abierto && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11.5, color: colores.textDim, lineHeight: 1.5 }}>
            Analiza el texto de un PDF (memoria técnica, cálculo eléctrico, etc. — no necesita ser un archivo generado por
            DEC) usando una IA que corre en TU computadora (Ollama) — el documento nunca se manda a ningún servidor.
            Requiere tener Ollama corriendo local y DEC abierto en modo desarrollo (no el sitio publicado). Siempre se
            muestra una vista previa antes de cargar nada.
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={baseUrl}
              onChange={(e) => actualizarUrl(e.target.value)}
              placeholder="URL de Ollama"
              style={{ flex: "1 1 220px", padding: "6px 8px", background: colores.bg, border: `1px solid ${colores.border}`, borderRadius: 3, color: colores.textMain, fontSize: 11.5, fontFamily: fuentes.mono }}
            />
            <input
              value={modelo}
              onChange={(e) => actualizarModelo(e.target.value)}
              placeholder="Modelo"
              style={{ flex: "0 1 160px", padding: "6px 8px", background: colores.bg, border: `1px solid ${colores.border}`, borderRadius: 3, color: colores.textMain, fontSize: 11.5, fontFamily: fuentes.mono }}
            />
          </div>

          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && esArchivoPDF(f)) {
                setArchivo(f);
                setError("");
                setResultado(null);
              }
            }}
            style={{ fontSize: 11.5, color: colores.textMain }}
          />

          <div>
            <button
              type="button"
              onClick={analizar}
              disabled={!archivo || cargando}
              style={{
                padding: "7px 14px",
                borderRadius: 3,
                border: "none",
                background: archivo && !cargando ? colores.copper : colores.border,
                color: archivo && !cargando ? colores.textSobreAcento : colores.textDim,
                fontWeight: 700,
                fontSize: 12,
                cursor: archivo && !cargando ? "pointer" : "not-allowed",
              }}
            >
              Analizar con IA local
            </button>
          </div>

          {cargando && <div style={{ fontSize: 12, color: colores.textDim }}>{mensajeCargando}</div>}

          {avisoFinal && <div style={{ fontSize: 12, color: colores.ok }}>{avisoFinal}</div>}

          {error && (
            <div style={{ fontSize: 12, color: colores.error, background: colores.errorFondo, border: `1px solid ${colores.error}44`, borderRadius: 3, padding: 10 }}>
              {error}
            </div>
          )}

          {truncado && !error && (
            <div style={{ fontSize: 11.5, color: colores.warn }}>
              El documento es largo — se analizó solo una parte (el principio). Puede que falten tableros/circuitos de páginas finales.
            </div>
          )}

          {avisos.length > 0 && (
            <div style={{ fontSize: 11.5, color: colores.warn }}>
              {avisos.map((a, i) => (
                <div key={i}>⚠ {a}</div>
              ))}
            </div>
          )}

          {resultado && resultado.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {resultado.map((t, i) => (
                <div key={i} style={{ border: `1px solid ${colores.border}`, borderRadius: 4, padding: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: colores.textMain, marginBottom: 6 }}>
                    {t.nombre} — {t.datos.tensionAlimentacion}V · {t.datos.fases}
                    {t.datos.longitudAlimentador ? ` · ${t.datos.longitudAlimentador}m de alimentador` : ""}
                  </div>
                  {t.circuitos.length === 0 && <div style={{ fontSize: 11.5, color: colores.textDim }}>Sin circuitos reconocidos.</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {t.circuitos.map((c, j) => (
                      <label
                        key={j}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start",
                          fontSize: 11.5,
                          padding: "4px 8px",
                          borderRadius: 3,
                          background: !c.valido ? colores.errorFondo : c.advertencias.length > 0 ? colores.copperFondo : colores.okFondo,
                          cursor: c.valido ? "pointer" : "default",
                        }}
                      >
                        <input type="checkbox" checked={c.incluir} disabled={!c.valido} onChange={() => alternarCircuito(i, j)} style={{ marginTop: 2 }} />
                        <div>
                          <div style={{ color: colores.textMain }}>
                            {c.descripcion} — {c.form.voltaje}V · {c.form.fases}
                            {c.equipoForm ? ` · ${c.equipoForm.valor}${c.equipoForm.modoEntrada === "corriente" ? "A" : "W"}` : ""}
                            {c.breakerDocumentoA != null ? ` · breaker ${c.breakerDocumentoA}A (según documento)` : ""}
                          </div>
                          {!c.valido && <div style={{ color: colores.error }}>✗ {c.errorValidacion}</div>}
                          {c.advertencias.map((a, k) => (
                            <div key={k} style={{ color: colores.warn }}>
                              ⚠ {a}
                            </div>
                          ))}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <button
                  type="button"
                  onClick={confirmar}
                  disabled={totalCircuitosIncluidos === 0}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 3,
                    border: "none",
                    background: totalCircuitosIncluidos > 0 ? colores.ok : colores.border,
                    color: totalCircuitosIncluidos > 0 ? "#171512" : colores.textDim,
                    fontWeight: 700,
                    fontSize: 12.5,
                    cursor: totalCircuitosIncluidos > 0 ? "pointer" : "not-allowed",
                  }}
                >
                  Importar {resultado.length} tablero{resultado.length === 1 ? "" : "s"}, {totalCircuitosIncluidos} circuito{totalCircuitosIncluidos === 1 ? "" : "s"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
