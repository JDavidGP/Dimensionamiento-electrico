import { useMemo, type ComponentType } from "react";
import { colores } from "../styles/colores.ts";
import { ApplicationMediator as App } from "../core/ApplicationMediator.ts";
// PlanoCanvas.jsx todavía no está migrado (pendiente en esta misma
// Fase 5) — forwardRef() sin anotar infiere RefAttributes<any> sin
// props propios. Cast temporal, se cae solo cuando ese archivo pase a .tsx.
import PlanoCanvasSinTipar from "./PlanoCanvas";
const PlanoCanvas = PlanoCanvasSinTipar as ComponentType<Record<string, unknown>>;
import type { NodoPlano, SegmentoPlano, HabitacionPlano, MarcadorEquipoPlano, CalibracionPlano } from "../modules/plano/tipos.ts";
import type { NodoDiagrama, ConexionDiagrama } from "../modules/diagrama/tipos.ts";
import type { ImagenPlano } from "../hooks/useCircuitos.ts";

interface VistaCombinadaEsquemasProps {
  planoImagen: ImagenPlano | null;
  planoCalibracion: CalibracionPlano | null;
  nodosPlano?: NodoPlano[];
  segmentosPlano?: SegmentoPlano[];
  habitacionesPlano?: HabitacionPlano[];
  marcadoresEquipoPlano?: MarcadorEquipoPlano[];
  nodosDiagrama?: NodoDiagrama[];
  conexionesDiagrama?: ConexionDiagrama[];
}

/**
 * "Diagrama unifilar y Plano" fusionados en una sola vista — usuario,
 * 2026-11-22: "continuemos con diagrama unifilar y planos como dos
 * lienzos separados" -> elección explícita "Superponer el diagrama
 * SOBRE el plano (recomendado)". Los modelos de datos NO se fusionan
 * (siguen siendo 2 grafos independientes, cada uno editable solo en su
 * propia pestaña); esta es solo una VISTA de solo lectura que dibuja
 * las conexiones del diagrama en la posición física real de cada
 * entidad, resuelta vía el entidadId que ya comparten un NodoDiagrama
 * y un MarcadorEquipoPlano (ver PlanoMediator.conexionesDiagramaEnPlano).
 *
 * No se duplican los símbolos: el marcador del plano YA dibuja el
 * símbolo de la entidad (mismo SimboloDiagrama que usa el diagrama) —
 * el valor nuevo de esta vista es solo la LÍNEA de conexión.
 */
export default function VistaCombinadaEsquemas({
  planoImagen,
  planoCalibracion,
  nodosPlano = [],
  segmentosPlano = [],
  habitacionesPlano = [],
  marcadoresEquipoPlano = [],
  nodosDiagrama = [],
  conexionesDiagrama = [],
}: VistaCombinadaEsquemasProps) {
  const resuelto = useMemo(
    () => App.plano.conexionesDiagramaEnPlano({ nodosDiagrama, conexionesDiagrama, marcadoresEquipoPlano }),
    [nodosDiagrama, conexionesDiagrama, marcadoresEquipoPlano]
  );

  if (!planoImagen) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: colores.textDim, fontSize: 13 }}>
        Cargá un plano en la pestaña "Plano" para ver esta vista combinada.
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 12.5, color: colores.textDim, margin: "0 0 10px" }}>
        Conexiones del diagrama unifilar dibujadas sobre el plano, en la posición física de cada equipo marcado.
        {resuelto.totalConexiones === 0
          ? " Todavía no hay conexiones en el diagrama unifilar."
          : resuelto.sinResolver > 0
          ? ` ${resuelto.conexiones.length} de ${resuelto.totalConexiones} conexiones ubicadas — ${
              resuelto.sinResolver === 1 ? "la otra conexión no se dibuja" : `las otras ${resuelto.sinResolver} no se dibujan`
            } porque alguno de sus equipos aún no tiene marcador en el plano.`
          : ` Las ${resuelto.conexiones.length} conexiones del diagrama están ubicadas.`}
      </p>
      <PlanoCanvas
        imagen={planoImagen}
        nodos={nodosPlano}
        segmentos={segmentosPlano}
        marcadoresEquipo={marcadoresEquipoPlano}
        habitaciones={habitacionesPlano}
        escalaMetrosPorPixel={planoCalibracion?.escalaMetrosPorPixel ?? null}
        conexionesDiagrama={resuelto.conexiones}
        modo="mover"
      />
    </div>
  );
}
