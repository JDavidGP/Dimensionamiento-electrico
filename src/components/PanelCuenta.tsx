import { useState, type CSSProperties, type FormEvent } from "react";
import { colores, fuentes } from "../styles/colores.ts";
import Campo, { inputStyle } from "./Campo.tsx";
import type { useCuenta } from "../hooks/useCuenta.ts";

type RetornoCuenta = ReturnType<typeof useCuenta>;

type PanelCuentaProps = Pick<
  RetornoCuenta,
  | "baseUrl"
  | "setBaseUrl"
  | "token"
  | "usuario"
  | "cargando"
  | "error"
  | "proyectosRemotos"
  | "proyectoRemotoVinculadoId"
  | "registrarCuenta"
  | "iniciarSesionCuenta"
  | "cerrarSesion"
  | "refrescarProyectosRemotos"
  | "borrarProyectoEnNube"
> & {
  nombreProyectoActual: string;
  onGuardarEnNube: (nombre: string) => void;
  onAbrirDesdeNube: (id: string) => void;
};

const parrafo: CSSProperties = { color: colores.textDim, fontSize: 12.5, lineHeight: 1.5, margin: "0 0 12px 0" };
const botonPrimario: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 3,
  border: "none",
  background: colores.copper,
  color: colores.textSobreAcento,
  fontWeight: 700,
  fontSize: 12.5,
  cursor: "pointer",
};
const botonSecundario: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 3,
  border: `1px solid ${colores.border}`,
  background: "transparent",
  color: colores.textMain,
  fontSize: 12.5,
  cursor: "pointer",
};

export default function PanelCuenta({
  baseUrl,
  setBaseUrl,
  token,
  usuario,
  cargando,
  error,
  proyectosRemotos,
  proyectoRemotoVinculadoId,
  registrarCuenta,
  iniciarSesionCuenta,
  cerrarSesion,
  refrescarProyectosRemotos,
  borrarProyectoEnNube,
  nombreProyectoActual,
  onGuardarEnNube,
  onAbrirDesdeNube,
}: PanelCuentaProps) {
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    if (modo === "login") iniciarSesionCuenta(email, password);
    else registrarCuenta(email, password, nombre);
  }

  if (!token || !usuario) {
    return (
      <div>
        <Campo label="URL del backend">
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={inputStyle()} placeholder="http://localhost:3001" />
        </Campo>
        <p style={parrafo}>
          Guardá proyectos en el servidor propio en vez de (o además de) archivos locales — habilita abrir el mismo
          proyecto desde otro dispositivo. El cálculo sigue pasando siempre en este navegador.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={() => setModo("login")} style={modo === "login" ? botonPrimario : botonSecundario}>
            Iniciar sesión
          </button>
          <button type="button" onClick={() => setModo("registro")} style={modo === "registro" ? botonPrimario : botonSecundario}>
            Crear cuenta
          </button>
        </div>

        <form onSubmit={alEnviar}>
          <Campo label="Correo">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle()} />
          </Campo>
          {modo === "registro" && (
            <Campo label="Nombre">
              <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle()} />
            </Campo>
          )}
          <Campo label="Contraseña">
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle()} />
          </Campo>
          {error && <p style={{ ...parrafo, color: colores.error }}>{error}</p>}
          <button type="submit" disabled={cargando} style={{ ...botonPrimario, width: "100%" }}>
            {cargando ? "Un momento…" : modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <p style={parrafo}>
        Conectado como <strong style={{ color: colores.textMain }}>{usuario.nombre}</strong> ({usuario.email}) a{" "}
        <span style={{ fontFamily: fuentes.mono }}>{baseUrl}</span>.
      </p>

      <button type="button" onClick={() => onGuardarEnNube(nombreProyectoActual)} disabled={cargando} style={{ ...botonPrimario, width: "100%", marginBottom: 8 }}>
        {cargando ? "Guardando…" : proyectoRemotoVinculadoId ? "Actualizar en la nube" : "Guardar en la nube"}
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "16px 0 8px" }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: colores.copper }}>Mis proyectos</span>
        <button type="button" onClick={refrescarProyectosRemotos} disabled={cargando} style={{ background: "none", border: "none", color: colores.textDim, fontSize: 11, cursor: "pointer" }}>
          Actualizar lista
        </button>
      </div>

      {proyectosRemotos.length === 0 ? (
        <p style={parrafo}>Todavía no guardaste ningún proyecto en la nube.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {proyectosRemotos.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "8px 10px",
                border: `1px solid ${p.id === proyectoRemotoVinculadoId ? colores.copper : colores.border}`,
                borderRadius: 3,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: colores.textMain, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</div>
                <div style={{ fontSize: 10.5, color: colores.textDim }}>{new Date(p.actualizadoEn).toLocaleString()}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button type="button" onClick={() => onAbrirDesdeNube(p.id)} disabled={cargando} style={{ ...botonSecundario, padding: "4px 10px", fontSize: 11.5 }}>
                  Abrir
                </button>
                <button
                  type="button"
                  onClick={() => window.confirm(`¿Borrar "${p.nombre}" de la nube? No se puede deshacer.`) && borrarProyectoEnNube(p.id)}
                  disabled={cargando}
                  style={{ ...botonSecundario, padding: "4px 10px", fontSize: 11.5, color: colores.error, borderColor: colores.error }}
                >
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p style={{ ...parrafo, color: colores.error }}>{error}</p>}

      <button type="button" onClick={cerrarSesion} style={{ ...botonSecundario, width: "100%" }}>
        Cerrar sesión
      </button>
    </div>
  );
}
