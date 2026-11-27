import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";
import { TIPOS_INSTALACION, TIPO_INSTALACION_POR_DEFECTO } from "../src/shared/constants/constantes.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

assert(
  Object.keys(TIPOS_INSTALACION).length === 3 &&
    TIPOS_INSTALACION.RESIDENCIAL_BASICO === "residencial_basico" &&
    TIPOS_INSTALACION.RESIDENCIAL_AVANZADO === "residencial_avanzado" &&
    TIPOS_INSTALACION.COMERCIAL_INDUSTRIAL === "comercial_industrial",
  "TIPOS_INSTALACION tiene los 3 valores esperados"
);
assert(TIPO_INSTALACION_POR_DEFECTO === TIPOS_INSTALACION.RESIDENCIAL_BASICO, "El default es RESIDENCIAL_BASICO");

// --- Migración del enum viejo (persistencia) ---
function basePersistencia(tipoInstalacion) {
  return {
    proyecto: { id: "p1", nombre: "Test" },
    normativaActiva: "NEC",
    tipoInstalacion,
    circuitos: [],
    equipos: [],
    tableros: [],
    fuentesEnergia: [],
    transformadores: [],
    nodosDiagrama: [],
    conexionesDiagrama: [],
  };
}

const serializadoViejoDomiciliaria = App.persistencia.serializar(basePersistencia("domiciliaria"));
const deserializadoDomiciliaria = App.persistencia.deserializar(serializadoViejoDomiciliaria);
assert(
  deserializadoDomiciliaria.tipoInstalacion === TIPOS_INSTALACION.RESIDENCIAL_BASICO,
  `archivo viejo "domiciliaria" migra a RESIDENCIAL_BASICO (obtuvo: ${deserializadoDomiciliaria.tipoInstalacion})`
);

const serializadoViejoIndustrial = App.persistencia.serializar(basePersistencia("industrial"));
const deserializadoIndustrial = App.persistencia.deserializar(serializadoViejoIndustrial);
assert(
  deserializadoIndustrial.tipoInstalacion === TIPOS_INSTALACION.COMERCIAL_INDUSTRIAL,
  `archivo viejo "industrial" migra a COMERCIAL_INDUSTRIAL (obtuvo: ${deserializadoIndustrial.tipoInstalacion})`
);

const serializadoNuevo = App.persistencia.serializar(basePersistencia(TIPOS_INSTALACION.RESIDENCIAL_AVANZADO));
const deserializadoNuevo = App.persistencia.deserializar(serializadoNuevo);
assert(
  deserializadoNuevo.tipoInstalacion === TIPOS_INSTALACION.RESIDENCIAL_AVANZADO,
  "un valor del enum NUEVO pasa sin tocarse"
);

const sinCampo = basePersistencia(undefined);
delete sinCampo.tipoInstalacion;
const deserializadoSinCampo = App.persistencia.deserializar(sinCampo);
assert(
  deserializadoSinCampo.tipoInstalacion === TIPO_INSTALACION_POR_DEFECTO,
  "archivo sin tipoInstalacion cae al default (RESIDENCIAL_BASICO)"
);

const valorDesconocido = basePersistencia("algo-que-no-existe");
const deserializadoDesconocido = App.persistencia.deserializar(valorDesconocido);
assert(
  deserializadoDesconocido.tipoInstalacion === TIPO_INSTALACION_POR_DEFECTO,
  "un valor desconocido (ni viejo ni nuevo) cae al default, no explota"
);

console.log("\nTodas las pruebas completadas.");
