import { colores, fuentes } from "../styles/colores.ts";
import MenuOpciones from "./MenuOpciones";

interface HeaderProps {
  umbralDesbalanceFasesPct: number;
  setUmbralDesbalanceFasesPct: (valor: number | string) => void;
}

export default function Header({ umbralDesbalanceFasesPct, setUmbralDesbalanceFasesPct }: HeaderProps) {
  return (
    <div style={{ position: "relative", borderBottom: `1px solid ${colores.border}`, padding: "20px 24px" }}>
      <div style={{ position: "absolute", top: 16, right: 24 }}>
        <MenuOpciones
          umbralDesbalanceFasesPct={umbralDesbalanceFasesPct}
          setUmbralDesbalanceFasesPct={setUmbralDesbalanceFasesPct}
        />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", paddingRight: 44 }}>
        <h1
          style={{
            fontFamily: fuentes.condensada,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: "0.02em",
            margin: 0,
            color: colores.textMain,
          }}
        >
          DEC
        </h1>
        <span style={{ color: colores.copper, fontFamily: fuentes.mono, fontSize: 12 }}>v0.5 · factor de demanda NEC</span>
      </div>
      <p style={{ color: colores.textDim, fontSize: 13, marginTop: 6, maxWidth: 640 }}>
        Dimensionamiento sobre carga de demanda normativa (Art. 220/430). Continuidad por equipo. Simultaneidad de campo solo informativa.
      </p>
      <p style={{ color: colores.warn, fontSize: 12, marginTop: 4, marginBottom: 0, maxWidth: 640 }}>
        Resultados orientativos: deben ser verificados por un profesional habilitado antes de ejecutar la instalación.
      </p>
    </div>
  );
}
