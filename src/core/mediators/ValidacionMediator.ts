/**
 * ValidacionMediator
 * Dependencias: MotorCalculoMediator, NormativaMediator, DataProvider.
 * Módulos: consistencia del proyecto, formularios, advertencias eléctricas.
 */
import {
  obtenerListaIntegridad,
  obtenerDetalleElectrico,
  resumenIntegridad,
  validarCircuito,
  formularioACircuito,
  circuitoAFormulario,
  validarEquipo,
  formularioAEquipo,
  equipoAFormulario,
  ESTADOS,
} from "../../modules/validacion/index.ts";
import type { Circuito, Equipo, Tablero, FuenteEnergia, Transformador, Diferencial, NodoDiagrama, MarcadorEquipoPlano, RutaConductorPlano, Proyecto, ResultadoCalculoLaxo } from "../../modules/validacion/tipos.ts";
import { NormativaMediator } from "./NormativaMediator.ts";
import { DataProvider } from "../services/DataProvider.ts";

type ArgsIntegridad = [
  proyecto: Proyecto | null | undefined,
  circuitos: Circuito[] | undefined,
  equipos: Equipo[] | undefined,
  tableros: Tablero[] | undefined,
  fuentesEnergia: FuenteEnergia[] | undefined,
  nodosDiagrama: NodoDiagrama[] | undefined,
  transformadores: Transformador[] | undefined,
  marcadoresEquipoPlano: MarcadorEquipoPlano[] | undefined,
  diferenciales: Diferencial[] | undefined,
  rutasConductorPlano: RutaConductorPlano[] | undefined,
];

interface OpcionesDetalleElectrico {
  proyecto?: Proyecto | null;
  circuitos?: Circuito[];
  equipos?: Equipo[];
  normativaId?: string | null;
  resultadoCalculo?: ResultadoCalculoLaxo;
}

export const ValidacionMediator = {
  ESTADOS,

  listaIntegridad(...[proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores, marcadoresEquipoPlano, diferenciales, rutasConductorPlano]: ArgsIntegridad) {
    return obtenerListaIntegridad(
      proyecto ?? DataProvider.getProyecto(),
      circuitos ?? DataProvider.getCircuitos(),
      equipos ?? DataProvider.getEquipos(),
      tableros ?? DataProvider.getTableros(),
      fuentesEnergia ?? DataProvider.getFuentesEnergia(),
      nodosDiagrama ?? DataProvider.getNodosDiagrama(),
      transformadores ?? DataProvider.getTransformadores(),
      marcadoresEquipoPlano ?? [],
      diferenciales ?? DataProvider.getDiferenciales(),
      rutasConductorPlano ?? []
    );
  },

  resumen(...[proyecto, circuitos, equipos, tableros, fuentesEnergia, nodosDiagrama, transformadores, marcadoresEquipoPlano, diferenciales, rutasConductorPlano]: ArgsIntegridad) {
    return resumenIntegridad(
      proyecto ?? DataProvider.getProyecto(),
      circuitos ?? DataProvider.getCircuitos(),
      equipos ?? DataProvider.getEquipos(),
      tableros ?? DataProvider.getTableros(),
      fuentesEnergia ?? DataProvider.getFuentesEnergia(),
      nodosDiagrama ?? DataProvider.getNodosDiagrama(),
      transformadores ?? DataProvider.getTransformadores(),
      marcadoresEquipoPlano ?? [],
      diferenciales ?? DataProvider.getDiferenciales(),
      rutasConductorPlano ?? []
    );
  },

  detalleElectrico(id: string, opts: OpcionesDetalleElectrico = {}) {
    const proyecto = opts.proyecto ?? DataProvider.getProyecto();
    const circuitos = opts.circuitos ?? DataProvider.getCircuitos();
    const equipos = opts.equipos ?? DataProvider.getEquipos();
    const normativaId = opts.normativaId ?? DataProvider.getNormativaActivaId();
    const resultadoCalculo =
      opts.resultadoCalculo ?? DataProvider.getResultado(id) ?? undefined;

    return obtenerDetalleElectrico(id, proyecto, circuitos, equipos, {
      resultadoCalculo,
      normativaEngine: {
        verificarCircuito: (circuito: Circuito, ctx: { corriente: number; breaker: number | string | null; calibre: string | null; equipos: Equipo[] }) =>
          NormativaMediator.verificarCircuito(normativaId, circuito, ctx),
      },
    });
  },

  // --- Validación de formularios (entrada de UI) ---
  validarFormularioCircuito: validarCircuito,
  formularioACircuito,
  circuitoAFormulario,
  validarFormularioEquipo: validarEquipo,
  formularioAEquipo,
  equipoAFormulario,
};
