import { useState } from "react";
import { colores, fuentes } from "../styles/colores.ts";
import { ApplicationMediator as App } from "../core/ApplicationMediator.ts";
import type { Circuito, Equipo } from "../modules/validacion/tipos.ts";

interface CalcularIluminacionGeneralProps {
  normativaActiva: string;
  onCrear: (areaM2: number) => { circuito: Circuito; equipo: Equipo; va: number } | null;
}

// Calcular iluminación general (NEC Tabla 220.12) — usuario, 2026-11-23,
// tras preguntar para qué sirve realmente el área construida (m²) de un
// plano: NEC exige una carga de alumbrado general OBLIGATORIA basada en
// el área de la vivienda (3 VA/pie² = 33 VA/m², Tabla 220.12),
// independiente de cuántos focos haya instalados — es el primer
// renglón de cualquier memoria de cálculo NEC residencial. Antes había
// que calcular esto a mano y cargarlo como un circuito más; acá se
// calcula solo y crea el circuito + equipo (con tipoEquipoNEC
// ILUMINACION_GENERAL, que ya activa la demanda escalonada real de
// Art. 220.42 — no es un cálculo aparte).
//
// Solo se muestra si la normativa activa define cargaIluminacionGeneralVaPorM2
// (NEC/CIEN) — REBT (IEC_ES) no tiene este campo, ahí el área es solo
// UN criterio entre varios para elegir el grado de electrificación a
// mano, no alimenta una fórmula de VA directa.
export default function CalcularIluminacionGeneral({ normativaActiva, onCrear }: CalcularIluminacionGeneralProps) {
  const [abierto, setAbierto] = useState(false);
  const [areaInput, setAreaInput] = useState("");
  const [aviso, setAviso] = useState("");

  const normativa = App.normativa.obtener(normativaActiva);
  const vaPorM2 = normativa.cargaIluminacionGeneralVaPorM2;
  if (!vaPorM2) return null;

  const areaM2 = parseFloat(areaInput);
  const vaCalculados = areaM2 > 0 ? Math.round(areaM2 * vaPorM2) : null;
  const cargaValida = vaCalculados != null && vaCalculados > 0;

  function crear() {
    const resultado = onCrear(areaM2);
    if (!resultado) return;
    setAviso(`Circuito "Iluminación general" creado — ${resultado.va} VA (${areaM2} m² × ${vaPorM2} VA/m²). Asignale un tablero como a cualquier circuito nuevo.`);
    setAreaInput("");
    setTimeout(() => setAviso(""), 6000);
  }

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: abierto ? 18 : "10px 18px" }}>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        style={{ background: "none", border: "none", color: colores.copper, fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}
      >
        <span style={{ fontSize: 10 }}>{abierto ? "▾" : "▸"}</span>
        Calcular iluminación general ({normativa.familia} Tabla 220.12)
      </button>

      {abierto && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11.5, color: colores.textDim, lineHeight: 1.5, marginBottom: 10 }}>
            {normativa.familia} exige una carga de alumbrado general de {vaPorM2} VA por m² de área construida (Tabla
            220.12) — independiente de cuántos focos tenga instalados realmente. Ingresá el área construida que
            alimenta este proyecto y se crea el circuito con esa carga ya calculada.
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: colores.textDim, marginBottom: 4 }}>Área construida (m²)</div>
              <input
                style={{ width: "100%", padding: "8px 10px", background: colores.bg, border: `1px solid ${colores.border}`, borderRadius: 3, color: colores.textMain, fontSize: 13, boxSizing: "border-box" }}
                type="number"
                step="0.01"
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                placeholder="Ej: 109.50"
              />
            </div>
            <button
              type="button"
              onClick={crear}
              disabled={!cargaValida}
              style={{
                padding: "8px 14px",
                borderRadius: 3,
                border: "none",
                background: cargaValida ? colores.copper : colores.border,
                color: cargaValida ? colores.textSobreAcento : colores.textDim,
                fontWeight: 700,
                fontSize: 12,
                cursor: cargaValida ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
              }}
            >
              + Crear circuito de iluminación
            </button>
          </div>

          {vaCalculados != null && vaCalculados > 0 && (
            <div style={{ fontSize: 12, color: colores.textMain, marginTop: 8, fontFamily: fuentes.mono }}>
              = {vaCalculados} VA ({areaM2} m² × {vaPorM2} VA/m²)
            </div>
          )}

          {aviso && <div style={{ fontSize: 12, color: colores.ok, marginTop: 10 }}>{aviso}</div>}
        </div>
      )}
    </div>
  );
}
