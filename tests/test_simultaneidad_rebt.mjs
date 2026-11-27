import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

function assert(cond, msg) {
  if (!cond) {
    console.error("FALLO:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

// ============ 1. Tabla de coeficientes — exactitud total contra el documento oficial ============
const esperado = {
  1: 1, 2: 2, 3: 3, 4: 3.8, 5: 4.6, 6: 5.4, 7: 6.2, 8: 7, 9: 7.8, 10: 8.5,
  11: 9.2, 12: 9.9, 13: 10.6, 14: 11.3, 15: 11.9, 16: 12.5, 17: 13.1,
  18: 13.7, 19: 14.3, 20: 14.8, 21: 15.3,
};
let tablaOk = true;
for (const [n, c] of Object.entries(esperado)) {
  if (App.motor.coeficienteSimultaneidad(Number(n)) !== c) tablaOk = false;
}
assert(tablaOk, "Tabla 1 completa (n=1..21) coincide con el documento oficial verificado");
assert(App.motor.coeficienteSimultaneidad(22) === 15.3 + 0.5, "n=22 usa la fórmula 15,3+(n-21)·0,5");
assert(App.motor.coeficienteSimultaneidad(30) === 15.3 + 9 * 0.5, "n=30 usa la fórmula correctamente");
assert(App.motor.coeficienteSimultaneidad(0) === null, "n=0 inválido -> null, no inventa");
assert(App.motor.coeficienteSimultaneidad(1.5) === null, "n no entero -> null");

// ============ 2. Grados de electrificación ============
assert(App.motor.GRADOS_ELECTRIFICACION.BASICA.potenciaMinimaW === 5750, "Básica = 5750W (verificado)");
assert(App.motor.GRADOS_ELECTRIFICACION.ELEVADA.potenciaMinimaW === 9200, "Elevada = 9200W (verificado)");

// ============ 3. calcularCargaSimultaneaViviendas ============
// Ejemplo EXACTO del documento oficial (Guía-BT-10 p.4): 12 viviendas de
// 100m² (básica, 5750W) + 2 viviendas de 200m² (elevada, 9200W) = 14
// viviendas -> coeficiente 11,3 -> 70,544 kW
const potencias = [...Array(12).fill(5750), ...Array(2).fill(9200)];
const resultado = App.motor.calcularCargaSimultaneaViviendas(potencias);
assert(resultado.ok, "calcularCargaSimultaneaViviendas ok con el ejemplo oficial");
assert(resultado.n === 14, "n=14");
assert(resultado.coeficiente === 11.3, "coeficiente=11.3 para 14 viviendas");
assert(Math.abs(resultado.cargaW - 70544) < 1, `cargaW ≈ 70544W como en el ejemplo oficial (obtuvo ${resultado.cargaW})`);

const vacio = App.motor.calcularCargaSimultaneaViviendas([]);
assert(!vacio.ok, "lista vacía -> no ok, no inventa un resultado");

console.log("\n--- Módulo puro verificado. Ahora integración con TableroMediator. ---\n");

// ============ 4. Integración: tablero padre con modo REBT activo ============
const padre = App.tablero.crear({
  nombre: "Edificio Las Flores",
  tensionAlimentacion: "400",
  fases: "tri",
  longitudAlimentador: "20",
  materialAlimentador: "cobre",
  simultaneidadREBT: { activa: true, gradoPorDefecto: "basica" },
});

// 3 viviendas hijas, TODAS sin circuitos todavía (caso "no se conoce la demanda real")
const hijo1 = App.tablero.crear({ nombre: "Depto 1", tensionAlimentacion: "230", fases: "mono", tableroPadreId: padre.id });
const hijo2 = App.tablero.crear({ nombre: "Depto 2", tensionAlimentacion: "230", fases: "mono", tableroPadreId: padre.id });
const hijo3 = App.tablero.crear({ nombre: "Depto 3 (elevada)", tensionAlimentacion: "230", fases: "mono", tableroPadreId: padre.id, gradoElectrificacion: "elevada" });

const tableros = [padre, hijo1, hijo2, hijo3];
const circuitos = [];
const resultados = [];
const normativaId = "IEC_ES";

const alimPadre = App.tablero.calcularAlimentadorAgregado(padre.id, { tableros, circuitos, resultados, normativaId });

assert(alimPadre.ok, `El alimentador del padre calcula OK aunque sus 3 hijos no tengan circuitos (error: ${JSON.stringify(alimPadre)})`);
if (alimPadre.ok) {
  // n=3 -> coeficiente 3; potencias: 5750, 5750, 9200 -> media = 6900 -> carga = 20700W
  assert(alimPadre.simultaneidadREBT?.n === 3, "n=3 viviendas detectadas");
  assert(alimPadre.simultaneidadREBT?.coeficiente === 3, "coeficiente=3 para 3 viviendas");
  const mediaEsperada = (5750 + 5750 + 9200) / 3;
  assert(Math.abs(alimPadre.simultaneidadREBT.mediaW - mediaEsperada) < 0.01, "media ponderando grados básica/elevada por hijo");
  assert(Math.abs(alimPadre.simultaneidadREBT.cargaW - mediaEsperada * 3) < 0.01, "cargaW = media × coeficiente");
  assert(Math.abs(alimPadre.potenciaTotalW - alimPadre.simultaneidadREBT.cargaW) < 0.01, "potenciaTotalW del alimentador = la carga REBT (no la suma simple de 5750+5750+9200=20700 vs individual)");
}

// ============ 5. Comportamiento SIN activar (default): debe seguir bloqueando igual que siempre ============
const padreNormal = App.tablero.crear({ nombre: "Edificio normal", tensionAlimentacion: "400", fases: "tri", longitudAlimentador: "20", materialAlimentador: "cobre" });
const hijoNormal = App.tablero.crear({ nombre: "Subtablero sin circuitos", tensionAlimentacion: "230", fases: "mono", tableroPadreId: padreNormal.id });
const tablerosNormales = [padreNormal, hijoNormal];
const alimNormal = App.tablero.calcularAlimentadorAgregado(padreNormal.id, { tableros: tablerosNormales, circuitos: [], resultados: [], normativaId });
assert(!alimNormal.ok && alimNormal.pendiente, "SIN simultaneidadREBT activo, un hijo sin circuitos SIGUE bloqueando al padre (comportamiento preexistente intacto)");

console.log("\nTodas las pruebas completadas.");
