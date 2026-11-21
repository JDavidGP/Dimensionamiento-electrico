/**
 * ImportacionMediator
 * Responsabilidad: dominio Importación de equipos por texto — un
 * atajo de ENTRADA al mismo modelo de siempre (tablero → circuito →
 * equipo), NUNCA un camino de cálculo distinto ni "inverso". Ver
 * modules/importacionEquipos/index.js para el porqué completo
 * (incluida la decisión, acordada con el usuario, de NO usar un
 * chatbot con IA real para esto).
 *
 * Resuelve el texto YA interpretado contra los circuitos REALES del
 * proyecto — por etiqueta, nunca crea un circuito/tablero nuevo — y
 * reusa, SIN modificarla, la MISMA validación/fábrica que ya usa el
 * formulario manual (ValidacionMediator.validarFormularioEquipo/
 * formularioAEquipo): así el rigor del cálculo queda intacto, un
 * equipo importado por texto es, para el motor, indistinguible de uno
 * tipeado a mano.
 *
 * NO muta el proyecto — solo interpreta/valida y arma el equipo
 * final; la escritura real la hace el hook, igual criterio que el
 * resto de los mediadores de dominio.
 */
import { interpretarTexto } from "../../modules/importacionEquipos/index.ts";
import { ValidacionMediator } from "./ValidacionMediator.js";

// Campos del formulario de equipo que el texto NO especifica —
// mismos defaults seguros que ya usa EQUIPO_VACIO (shared/data/
// plantillas.js), editables después a mano como cualquier equipo.
const CAMPOS_EQUIPO_POR_DEFECTO = {
  etiqueta: "",
  funcion: "",
  cosPhi: "1.0",
  tipoEquipoNEC: "CARGA_GENERAL",
  esCargaContinua: false,
  corrienteRotorBloqueado: "",
};

export const ImportacionMediator = {
  /**
   * Interpreta el texto y valida cada línea contra los circuitos
   * reales del proyecto — NO crea nada todavía (eso lo decide el
   * hook, con el usuario viendo esta previsualización primero). Cada
   * fila trae `ok` y, si es true, el `equipo` YA armado y validado
   * (listo para guardar tal cual, sin volver a interpretarlo) — si es
   * false, el `motivo` exacto del rechazo, nunca un dato inventado.
   */
  previsualizar(texto, circuitos = []) {
    const comandos = interpretarTexto(texto);

    return comandos.map((cmd) => {
      if (!cmd.ok) return cmd;

      const candidatos = circuitos.filter((c) => c.etiqueta === cmd.etiquetaCircuito);
      if (candidatos.length === 0) {
        return {
          numeroLinea: cmd.numeroLinea,
          ok: false,
          motivo: `No existe ningún circuito con la etiqueta "${cmd.etiquetaCircuito}" — creálo primero en "Circuitos y resultados".`,
        };
      }
      if (candidatos.length > 1) {
        return {
          numeroLinea: cmd.numeroLinea,
          ok: false,
          motivo: `Hay ${candidatos.length} circuitos con la etiqueta "${cmd.etiquetaCircuito}" — no se puede saber a cuál referís. Corregí las etiquetas para que sean únicas.`,
        };
      }
      const circuito = candidatos[0];

      const form = {
        ...CAMPOS_EQUIPO_POR_DEFECTO,
        nombre: cmd.nombre,
        cantidad: cmd.cantidad,
        modoEntrada: cmd.modoEntrada,
        valor: cmd.valor,
      };
      const error = ValidacionMediator.validarFormularioEquipo(form);
      if (error) {
        return { numeroLinea: cmd.numeroLinea, ok: false, motivo: error };
      }

      return {
        numeroLinea: cmd.numeroLinea,
        ok: true,
        etiquetaCircuito: cmd.etiquetaCircuito,
        nombreCircuito: circuito.nombre,
        nombre: cmd.nombre,
        equipo: ValidacionMediator.formularioAEquipo(form, circuito.id),
      };
    });
  },
};
