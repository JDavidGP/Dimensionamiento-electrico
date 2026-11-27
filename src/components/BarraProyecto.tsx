import { colores } from "../styles/colores.ts";
import { inputStyle } from "./Campo.tsx";
import type { ProyectoMeta } from "../modules/persistencia/tipos.ts";

interface BarraProyectoProps {
  proyecto: ProyectoMeta;
  setProyecto: (proyecto: ProyectoMeta) => void;
  avisoArchivo: string;
  onGuardar: () => void;
  onGuardarJson?: () => void;
  onAbrir: (archivo: File) => void;
  onNuevo: () => void;
}

export default function BarraProyecto({ proyecto, setProyecto, avisoArchivo, onGuardar, onGuardarJson, onAbrir, onNuevo }: BarraProyectoProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
      <input
        value={proyecto.nombre}
        onChange={(e) => setProyecto({ ...proyecto, nombre: e.target.value })}
        style={{ ...inputStyle(), maxWidth: 280, fontWeight: 600 }}
        placeholder="Nombre del proyecto"
      />
      <button
        onClick={onGuardar}
        title="Guarda una ficha en PDF con los datos completos del proyecto incrustados — abrila de vuelta en 'Abrir' para seguir trabajando."
        style={{ padding: "8px 14px", background: colores.copper, color: colores.textSobreAcento, border: "none", borderRadius: 3, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
      >
        ↓ Guardar (.pdf)
      </button>
      {onGuardarJson && (
        <button
          onClick={onGuardarJson}
          title="Guardar como .json (formato de versiones anteriores)"
          style={{ padding: "8px 14px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontWeight: 600, fontSize: 12, cursor: "pointer" }}
        >
          .json
        </button>
      )}
      <label
        style={{ padding: "8px 14px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
      >
        ↑ Abrir
        <input
          type="file"
          accept=".pdf,.json,application/pdf,application/json"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && onAbrir(e.target.files[0])}
        />
      </label>
      <button
        onClick={onNuevo}
        style={{ padding: "8px 14px", background: "transparent", color: colores.textDim, border: `1px solid ${colores.border}`, borderRadius: 3, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
      >
        + Nuevo
      </button>
      {avisoArchivo && <span style={{ color: colores.ok, fontSize: 12 }}>{avisoArchivo}</span>}
    </div>
  );
}
