import React from "react";
import Campo, { inputStyle } from "./Campo";
import { colores, fuentes } from "../styles/colores";
import { ApplicationMediator as App } from "../core/ApplicationMediator.js";
import { TIPOS_INSTALACION, OPCIONES_REPRESENTACION_CIRCUITO } from "../shared/constants/constantes.ts";

const FASES = [
  { valor: "mono", label: "Mono" },
  { valor: "bi", label: "Bi" },
  { valor: "tri", label: "Tri" },
];

function BotonPill({ activo, onClick, children, flex = 1 }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex,
        padding: "8px 0",
        borderRadius: 3,
        border: `1px solid ${activo ? colores.copper : colores.border}`,
        background: activo ? colores.copper : "transparent",
        color: activo ? colores.textSobreAcento : colores.textDim,
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// Un Circuito es lo que tiene un breaker físico: voltaje, fases,
// material, distancia, y su TIPO (dedicado/mixto). Los equipos se
// agregan después, dentro del circuito ya creado.
export default function FormularioCircuito({ form, setForm, onGuardar, onCancelar, error, editando, normativaActiva, onCambiarFases, tipoInstalacion }) {
  const normativa = App.normativa.obtener(normativaActiva);
  const voltajesEstandar = normativa.voltajesPorFase[form.fases] ?? [];
  // Residencial básico oculta "Tri" (pedido explícito del usuario, ver la
  // nota larga en shared/constants/constantes.ts, TIPOS_INSTALACION) — NO
  // se le cambia la fase a un circuito que ya la tenía en tri si se
  // cambió el nivel después (no se inventa/corrige un dato del usuario en
  // silencio); el pill simplemente no aparece entre las opciones nuevas.
  // Además, la normativa activa puede acotar sus propias fases (ver
  // fasesDisponibles en tipos.ts — ej. REBT no ofrece "Bi", no existe
  // como red de distribución estándar actual, confirmado por el
  // usuario 2026-11-24); mismo criterio: solo oculta el pill, no toca
  // un circuito ya guardado con esa fase.
  const fasesPermitidasPorNormativa = normativa.fasesDisponibles ?? FASES.map((f) => f.valor);
  const fasesDisponibles = (tipoInstalacion === TIPOS_INSTALACION.RESIDENCIAL_BASICO ? FASES.filter((f) => f.valor !== "tri") : FASES).filter((f) =>
    fasesPermitidasPorNormativa.includes(f.valor)
  );

  function elegirVoltajeEstandar(v) {
    setForm({ ...form, voltaje: String(v), voltajeManual: false });
  }

  return (
    <div style={{ background: colores.panel, border: `1px solid ${colores.border}`, borderRadius: 4, padding: 18 }}>
      <h2
        style={{
          fontFamily: fuentes.condensada,
          fontWeight: 600,
          fontSize: 13,
          letterSpacing: "0.08em",
          color: colores.textDim,
          margin: "0 0 14px 0",
          textTransform: "uppercase",
        }}
      >
        {editando ? "Editar circuito" : "Nuevo circuito"}
      </h2>

      <Campo label="Nombre del circuito">
        <input style={inputStyle()} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Iluminación cocina" />
      </Campo>

      <div style={{ display: "grid", gridTemplateColumns: "0.6fr 1.4fr", gap: 10 }}>
        <Campo label="Etiqueta">
          <input style={inputStyle()} value={form.etiqueta} onChange={(e) => setForm({ ...form, etiqueta: e.target.value })} placeholder="Ej: TD1-C3" />
        </Campo>
        <Campo label="Función (opcional)">
          <input style={inputStyle()} value={form.funcion} onChange={(e) => setForm({ ...form, funcion: e.target.value })} placeholder="Ej: Ilumina pasillo principal" />
        </Campo>
      </div>

      <Campo label="Representar en">
        <select style={inputStyle()} value={form.representacion ?? "ambos"} onChange={(e) => setForm({ ...form, representacion: e.target.value })}>
          {OPCIONES_REPRESENTACION_CIRCUITO.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.label}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: colores.textDim, marginTop: 6, lineHeight: 1.4 }}>
          Solo ajusta qué advertencias de integridad aparecen — nunca impide vincular un nodo o un marcador igual si lo necesitás.
        </div>
      </Campo>

      <Campo label="Tipo de circuito">
        <div style={{ display: "flex", gap: 8 }}>
          <BotonPill activo={form.tipo === "dedicado"} onClick={() => setForm({ ...form, tipo: "dedicado" })}>
            Dedicado
          </BotonPill>
          <BotonPill activo={form.tipo === "mixto"} onClick={() => setForm({ ...form, tipo: "mixto" })}>
            Mixto
          </BotonPill>
        </div>
        <div style={{ fontSize: 11, color: colores.textDim, marginTop: 6, lineHeight: 1.4 }}>
          {form.tipo === "dedicado"
            ? "Un solo equipo (motores, A/C, bomba — norma CIEN/NEC lo exige para cargas grandes)."
            : "Varios equipos comparten el mismo breaker (alumbrado, tomacorrientes de uso general)."}
        </div>
      </Campo>

      <Campo label="Fases">
        <div style={{ display: "flex", gap: 8 }}>
          {fasesDisponibles.map((f) => (
            <BotonPill key={f.valor} activo={form.fases === f.valor} onClick={() => onCambiarFases(f.valor)}>
              {f.label}
            </BotonPill>
          ))}
        </div>
      </Campo>

      <Campo label={`Voltaje (${normativa.id})`}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {voltajesEstandar.map((v) => (
            <BotonPill key={v} flex="0 0 auto" activo={!form.voltajeManual && Number(form.voltaje) === v} onClick={() => elegirVoltajeEstandar(v)}>
              <span style={{ padding: "0 10px" }}>{v}V</span>
            </BotonPill>
          ))}
          <BotonPill flex="0 0 auto" activo={form.voltajeManual} onClick={() => setForm({ ...form, voltajeManual: true })}>
            <span style={{ padding: "0 10px" }}>Manual</span>
          </BotonPill>
        </div>
        {form.voltajeManual && (
          <input
            style={{ ...inputStyle(), marginTop: 8 }}
            type="number"
            placeholder="Voltaje del circuito (V)"
            value={form.voltaje}
            onChange={(e) => setForm({ ...form, voltaje: e.target.value })}
          />
        )}
      </Campo>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Campo label="Distancia (m)">
          <input style={inputStyle()} type="number" value={form.distancia} onChange={(e) => setForm({ ...form, distancia: e.target.value })} />
        </Campo>
        <Campo label="Temp. ambiente (°C)">
          <input style={inputStyle()} type="number" value={form.temp} onChange={(e) => setForm({ ...form, temp: e.target.value })} />
        </Campo>
      </div>

      <Campo label="Material del conductor">
        <div style={{ display: "flex", gap: 8 }}>
          {["cobre", "aluminio"].map((m) => (
            <BotonPill key={m} activo={form.material === m} onClick={() => setForm({ ...form, material: m })}>
              <span style={{ textTransform: "capitalize" }}>{m}</span>
            </BotonPill>
          ))}
        </div>
      </Campo>

      {/* AFCI — usuario, 2026-11-26: "sigamos con AFCI" (NEC 210.12(B)).
          A diferencia de GFCI (por tomacorriente), AFCI protege el
          CIRCUITO completo — por eso vive acá, no en el equipo. Dispara
          advertencia si algún equipo de este circuito cae en un ambiente
          de la lista (dormitorio/sala/comedor/pasillo/clóset/cocina/
          lavandería) y esto sigue sin marcar — ver advertenciasAFCI en
          useCircuitos.js. */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: colores.textDim, margin: "-8px 0 16px" }}>
        <input type="checkbox" checked={!!form.proteccionAFCI} onChange={(e) => setForm({ ...form, proteccionAFCI: e.target.checked })} />
        Protegido por AFCI
      </label>

      {error && <div style={{ color: colores.error, fontSize: 12, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onGuardar}
          style={{ flex: 1, padding: "10px 0", background: colores.copper, color: colores.textSobreAcento, border: "none", borderRadius: 3, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          {editando ? "Guardar cambios" : "+ Crear circuito"}
        </button>
        {editando && (
          <button onClick={onCancelar} style={{ padding: "10px 16px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
