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
import { generarResumenCalculos, generarMemoriaTecnica } from "../../modules/documento/index.js";
import { DataProvider } from "../services/DataProvider.js";
import { Logger } from "../services/Logger.js";
import { NormativaMediator } from "./NormativaMediator.js";
import { OrigenMediator } from "./OrigenMediator.js";
import { ValidacionMediator } from "./ValidacionMediator.js";

/** Etiqueta legible del origen de un tablero (tablero padre / fuente de energía / transformador / acometida / referencia rota). */
function etiquetaOrigen(tablero, tableros, fuentesEnergia, transformadores) {
  if (!tablero.tableroPadreId) return "Acometida / poste";
  const resuelto = OrigenMediator.resolver(tablero.tableroPadreId, tableros, fuentesEnergia, transformadores);
  if (resuelto.tipo === "tablero") return resuelto.tablero.nombre;
  if (resuelto.tipo === "transformador") return `${resuelto.transformador.nombre} (Transformador)`;
  if (resuelto.tipo === OrigenMediator.TIPOS_FUENTE_ENERGIA.BATERIA) return `${resuelto.fuente.nombre} (Batería)`;
  if (resuelto.tipo === OrigenMediator.TIPOS_FUENTE_ENERGIA.GENERADOR) return `${resuelto.fuente.nombre} (Generador)`;
  return `Origen desconocido (referencia rota: ${tablero.tableroPadreId})`;
}

export const DocumentoMediator = {
  resumenCalculos(resultados) {
    const r = resultados ?? DataProvider.getResultados();
    Logger.debug("DocumentoMediator.resumenCalculos", { n: r.length });
    return generarResumenCalculos(r);
  },

  /**
   * Arma el modelo de datos de la memoria técnica. Todo lo pesado
   * (alimentadores agregados por tablero, listaIntegridad) debe venir
   * YA CALCULADO en `overrides` — mismo motivo que
   * TableroMediator.calcularAlimentador documenta: el snapshot de
   * DataProvider se sincroniza en un useEffect que corre DESPUÉS del
   * render, así que llamarlo con datos recién cambiados sin pasarlos
   * explícitos puede leer un render atrás.
   */
  memoriaTecnica(overrides = {}) {
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
      overrides.listaIntegridad ?? ValidacionMediator.listaIntegridad(proyecto, circuitos, equipos, tableros, fuentesEnergia);

    const origenPorTablero = {};
    for (const t of tableros) {
      origenPorTablero[t.id] = etiquetaOrigen(t, tableros, fuentesEnergia, transformadores);
    }

    Logger.debug("DocumentoMediator.memoriaTecnica", { circuitos: circuitos.length, tableros: tableros.length });

    return generarMemoriaTecnica({
      proyecto,
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
      listaIntegridad,
    });
  },
};
