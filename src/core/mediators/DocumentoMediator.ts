/**
 * DocumentoMediator
 * Responsabilidad: dominio Documento — memoria técnica / informe.
 * Arma un modelo de datos plano a partir de lo YA calculado por otros
 * dominios (circuitos/resultados vía Motor, tableros/alimentadores vía
 * TableroMediator, origen vía OrigenMediator, integridad vía
 * ValidacionMediator) — NUNCA llama al Motor directamente (ver
 * ARCHITECTURE.md §11, "Documento | Motor (directo) — prohibido").
 * Cruzar hacia Origen/Normativa/Validación SÍ está permitido a nivel
 * mediador (mismo patrón que DiagramaMediator → OrigenMediator).
 *
 * NO muta el proyecto — solo lectura/transformación, igual criterio
 * que el resto de los mediadores de dominio.
 */
import { generarMemoriaTecnica } from "../../modules/documento/index.ts";
import type { DatosMemoriaTecnica } from "../../modules/documento/tipos.ts";
import { DataProvider } from "../services/DataProvider.ts";
import { Logger } from "../services/Logger.ts";
import { NormativaMediator } from "./NormativaMediator.ts";
import { OrigenMediator } from "./OrigenMediator.ts";
import { ValidacionMediator } from "./ValidacionMediator.ts";
import type { Tablero, FuenteEnergia, Transformador } from "../services/DataProvider.ts";

/** Etiqueta legible del origen de un tablero (tablero padre / fuente de energía / transformador / acometida / referencia rota). */
function etiquetaOrigen(tablero: Tablero, tableros: Tablero[], fuentesEnergia: FuenteEnergia[], transformadores: Transformador[]): string {
  if (!tablero.tableroPadreId) return "Red eléctrica local (acometida / poste)";
  const resuelto = OrigenMediator.resolver(tablero.tableroPadreId, tableros, fuentesEnergia, transformadores);
  if (resuelto.tipo === "tablero") return resuelto.tablero.nombre ?? "";
  if (resuelto.tipo === "transformador") return `${resuelto.transformador.nombre ?? ""} (Transformador)`;
  if (resuelto.tipo === OrigenMediator.TIPOS_FUENTE_ENERGIA.RED_LOCAL) return `${resuelto.fuente.nombre ?? ""} (Red local)`;
  if (resuelto.tipo === OrigenMediator.TIPOS_FUENTE_ENERGIA.BATERIA) return `${resuelto.fuente.nombre ?? ""} (Batería)`;
  if (resuelto.tipo === OrigenMediator.TIPOS_FUENTE_ENERGIA.GENERADOR) return `${resuelto.fuente.nombre ?? ""} (Generador)`;
  return `Origen desconocido (referencia rota: ${tablero.tableroPadreId})`;
}

interface OverridesMemoriaTecnica extends Omit<DatosMemoriaTecnica, "normativa" | "tableros" | "fuentesEnergia" | "transformadores"> {
  normativaActiva?: string | null;
  // Más estrictos que DatosMemoriaTecnica (que los declara con id
  // opcional / sin tipar — ver modules/documento/tipos.ts): acá
  // siempre son tableros/fuentes/transformadores YA guardados en el
  // proyecto en curso (mismo tipo que expone DataProvider), nunca uno
  // a medio crear.
  tableros?: Tablero[];
  fuentesEnergia?: FuenteEnergia[];
  transformadores?: Transformador[];
}

export const DocumentoMediator = {
  /**
   * Arma el modelo de datos de la memoria técnica. Todo lo pesado
   * (alimentadores agregados por tablero, listaIntegridad) debe venir
   * YA CALCULADO en `overrides` — mismo motivo que
   * TableroMediator.calcularAlimentadorAgregado documenta: el snapshot
   * de DataProvider se sincroniza en un useEffect que corre DESPUÉS del
   * render, así que llamarlo con datos recién cambiados sin pasarlos
   * explícitos puede leer un render atrás.
   */
  memoriaTecnica(overrides: OverridesMemoriaTecnica = {}) {
    const proyecto = overrides.proyecto ?? DataProvider.getProyecto();
    const normativaId = overrides.normativaActiva ?? DataProvider.getNormativaActivaId();
    const normativaObj = NormativaMediator.obtener(normativaId);
    const tipoInstalacion = overrides.tipoInstalacion ?? null;
    const circuitos = overrides.circuitos ?? DataProvider.getCircuitos();
    const equipos = overrides.equipos ?? DataProvider.getEquipos();
    const resultados = overrides.resultados ?? DataProvider.getResultados();
    const tableros = overrides.tableros ?? DataProvider.getTableros();
    const fuentesEnergia = overrides.fuentesEnergia ?? DataProvider.getFuentesEnergia();
    const transformadores = overrides.transformadores ?? DataProvider.getTransformadores();
    const alimentadores = overrides.alimentadores ?? {};
    const listaIntegridad =
      overrides.listaIntegridad ?? ValidacionMediator.listaIntegridad(proyecto, circuitos, equipos, tableros, fuentesEnergia, undefined, undefined, undefined, undefined, undefined);

    const origenPorTablero: Record<string, string> = {};
    for (const t of tableros) {
      origenPorTablero[t.id] = etiquetaOrigen(t, tableros, fuentesEnergia, transformadores);
    }

    Logger.debug("DocumentoMediator.memoriaTecnica", { circuitos: circuitos.length, tableros: tableros.length });

    // `proyecto`/`listaIntegridad` cruzan acá de la forma ESTRICTA
    // (modules/validacion/tipos.ts: Proyecto/Entrada) a la forma LAXA
    // que generarMemoriaTecnica declara a propósito (modules/documento/
    // tipos.ts: índice `[clave: string]: unknown`), porque ese módulo
    // puro no depende de validacion (ver ARCHITECTURE.md §11) — este
    // mediador SÍ puede cruzar ambos dominios, así que el cast es el
    // punto de unión correcto, no uno inventado para silenciar un error.
    return generarMemoriaTecnica({
      proyecto: proyecto as DatosMemoriaTecnica["proyecto"],
      normativa: normativaObj ? { id: normativaObj.id, nombre: normativaObj.nombre } : { id: normativaId, nombre: normativaId ?? "Sin normativa" },
      tipoInstalacion,
      circuitos,
      equipos,
      resultados,
      tableros,
      alimentadores,
      origenPorTablero,
      fuentesEnergia,
      transformadores,
      listaIntegridad: listaIntegridad as DatosMemoriaTecnica["listaIntegridad"],
    });
  },
};
