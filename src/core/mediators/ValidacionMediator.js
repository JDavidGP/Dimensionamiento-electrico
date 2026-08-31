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
} from "../../modules/validacion/index.js";
import { NormativaMediator } from "./NormativaMediator.js";
import { DataProvider } from "../services/DataProvider.js";

export const ValidacionMediator = {
  ESTADOS,

  listaIntegridad(proyecto, circuitos, equipos, tableros) {
    return obtenerListaIntegridad(
      proyecto ?? DataProvider.getProyecto(),
      circuitos ?? DataProvider.getCircuitos(),
      equipos ?? DataProvider.getEquipos(),
      tableros ?? DataProvider.getTableros()
    );
  },

  resumen(proyecto, circuitos, equipos, tableros) {
    return resumenIntegridad(
      proyecto ?? DataProvider.getProyecto(),
      circuitos ?? DataProvider.getCircuitos(),
      equipos ?? DataProvider.getEquipos(),
      tableros ?? DataProvider.getTableros()
    );
  },

  detalleElectrico(id, opts = {}) {
    const proyecto = opts.proyecto ?? DataProvider.getProyecto();
    const circuitos = opts.circuitos ?? DataProvider.getCircuitos();
    const equipos = opts.equipos ?? DataProvider.getEquipos();
    const normativaId = opts.normativaId ?? DataProvider.getNormativaActivaId();
    const resultadoCalculo =
      opts.resultadoCalculo ?? DataProvider.getResultado(id);

    return obtenerDetalleElectrico(id, proyecto, circuitos, equipos, {
      resultadoCalculo,
      normativaEngine: {
        verificarCircuito: (circuito, ctx) =>
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
