import React from "react";
import Header from "./components/Header";
import BarraProyecto from "./components/BarraProyecto";
import FormularioCircuito from "./components/FormularioCircuito";
import FormularioEquipo from "./components/FormularioEquipo";
import Metrica from "./components/Metrica";
import TablaResultados from "./components/TablaResultados";
import PanelBreakers from "./components/PanelBreakers";
import PanelTableros from "./components/PanelTableros";
import SelectorNormativa from "./components/SelectorNormativa";
import DiagramaUnifilar from "./components/DiagramaUnifilar";
import PiePagina from "./components/PiePagina";
import { useCircuitos } from "./hooks/useCircuitos";
import { colores, fuentes } from "./styles/colores";

// NOTA PARA MÁS ADELANTE (usuario, 2026-11-20, refinada el mismo día —
// explícitamente DESPUÉS de terminar el diagrama unifilar, no antes;
// no implementar sin que lo pida de nuevo): la columna izquierda
// (Normativa → Tableros → Circuito → Equipo) ya acumuló bastante —
// tipo de instalación, fuentes de energía, conmutación — y se está
// volviendo larga de recorrer con scroll.
//
// Diseño ya precisado por el usuario (antes solo era "tab layout /
// ViewPager2" sin más detalle):
//   - Un menú arriba, horizontal, que se desliza de izquierda a
//     derecha (tabs tipo ViewPager2 — swipe, no solo click).
//   - Escalonado por el ORDEN en que se van ingresando los datos: los
//     primeros datos que se cargan (normativa, tipo de instalación,
//     tablero...) van a la IZQUIERDA del todo; a la DERECHA del todo
//     va el resumen y la generación de fichas / informe técnico (ver
//     el pendiente ya existente "Memoria técnica / informe en PDF" en
//     la hoja de ruta — esa pestaña final sería su lugar natural en
//     este layout).
//   - Todavía sin decidir: cuántas pestañas exactas y qué entra en
//     cada una (ej. ¿tableros y fuentes de energía van juntos o
//     separados? ¿el diagrama unifilar es su propia pestaña?) — eso
//     se define cuando se retome esto.
export default function App() {
  const {
    proyecto,
    setProyecto,
    avisoArchivo,
    guardarProyecto,
    abrirProyecto,
    nuevoProyecto,
    circuitos,
    resultados,
    resultadosParaTabla,
    totales,
    normativaActiva,
    setNormativaActiva,
    tipoInstalacion,
    setTipoInstalacion,
    umbralDesbalanceFasesPct,
    setUmbralDesbalanceFasesPct,
    formCircuito,
    setFormCircuito,
    errorCircuito,
    editandoCircuitoId,
    circuitoActivoId,
    setCircuitoActivoId,
    cambiarFasesCircuito,
    guardarCircuito,
    iniciarEdicionCircuito,
    cancelarEdicionCircuito,
    eliminarCircuito,
    formEquipo,
    setFormEquipo,
    errorEquipo,
    editandoEquipoId,
    guardarEquipo,
    iniciarEdicionEquipo,
    cancelarEdicionEquipo,
    eliminarEquipo,
    equiposDe,
    tableros,
    crearTablero,
    editarTablero,
    eliminarTablero,
    asignarCircuitoATablero,
    asignarLineasCircuito,
    circuitosDeTablero,
    circuitosSinTablero,
    alimentadores,
    balancesFases,
    fuentesEnergia,
    crearFuenteEnergia,
    nodosDiagrama,
    crearNodoDiagrama,
    editarNodoDiagrama,
    eliminarNodoDiagrama,
    conexionesDiagrama,
    crearConexionDiagrama,
    eliminarConexionDiagrama,
    listaIntegridad,
  } = useCircuitos();

  const circuitoActivo = circuitos.find((c) => c.id === circuitoActivoId) ?? null;

  return (
    <div style={{ background: colores.bg, minHeight: "100vh", color: colores.textMain, fontFamily: fuentes.display }}>
      <style>{`
        input, select { font-family: inherit; }
        input:focus, select:focus, button:focus { outline: 2px solid ${colores.copper}; outline-offset: 1px; }
      `}</style>

      <Header
        umbralDesbalanceFasesPct={umbralDesbalanceFasesPct}
        setUmbralDesbalanceFasesPct={setUmbralDesbalanceFasesPct}
      />
      <div style={{ padding: "0 24px 20px 24px", borderBottom: `1px solid ${colores.border}` }}>
        <BarraProyecto proyecto={proyecto} setProyecto={setProyecto} avisoArchivo={avisoArchivo} onGuardar={guardarProyecto} onAbrir={abrirProyecto} onNuevo={nuevoProyecto} />
      </div>

      <div style={{ padding: "20px 24px", display: "grid", gap: 20, gridTemplateColumns: "minmax(280px, 340px) 1fr", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SelectorNormativa
            normativaActiva={normativaActiva}
            setNormativaActiva={setNormativaActiva}
            circuitos={circuitos}
            tipoInstalacion={tipoInstalacion}
            setTipoInstalacion={setTipoInstalacion}
          />

          <PanelTableros
            tableros={tableros}
            circuitosDeTablero={circuitosDeTablero}
            circuitosSinTablero={circuitosSinTablero}
            alimentadores={alimentadores}
            balancesFases={balancesFases}
            listaIntegridad={listaIntegridad}
            crearTablero={crearTablero}
            editarTablero={editarTablero}
            eliminarTablero={eliminarTablero}
            normativaActiva={normativaActiva}
            fuentesEnergia={fuentesEnergia}
            crearFuenteEnergia={crearFuenteEnergia}
          />

          <FormularioCircuito
            form={formCircuito}
            setForm={setFormCircuito}
            onGuardar={guardarCircuito}
            onCancelar={cancelarEdicionCircuito}
            error={errorCircuito}
            editando={!!editandoCircuitoId}
            normativaActiva={normativaActiva}
            onCambiarFases={cambiarFasesCircuito}
            cantidadEquiposCircuito={
              editandoCircuitoId
                ? equiposDe(editandoCircuitoId).length
                : circuitoActivo
                  ? equiposDe(circuitoActivo.id).length
                  : 0
            }
          />

          <FormularioEquipo
            form={formEquipo}
            setForm={setFormEquipo}
            onGuardar={guardarEquipo}
            onCancelar={cancelarEdicionEquipo}
            error={errorEquipo}
            editando={!!editandoEquipoId}
            circuitoActivo={circuitoActivo}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Metrica label="Circuitos" valor={circuitos.length} />
            <Metrica label="Demanda NEC" valor={`${totales.potenciaTotal.toFixed(0)} W`} />
            <Metrica label="Corriente diseño" valor={`${totales.corrienteTotal.toFixed(2)} A`} />
          </div>

          <TablaResultados
            circuitos={circuitos}
            resultados={resultadosParaTabla}
            equiposDe={equiposDe}
            circuitoActivoId={circuitoActivoId}
            onSeleccionarCircuito={setCircuitoActivoId}
            onEditarCircuito={iniciarEdicionCircuito}
            onEliminarCircuito={eliminarCircuito}
            onEditarEquipo={iniciarEdicionEquipo}
            onEliminarEquipo={eliminarEquipo}
            tableros={tableros}
            onAsignarTablero={asignarCircuitoATablero}
            onAsignarLineas={asignarLineasCircuito}
            listaIntegridad={listaIntegridad}
          />

          <PanelBreakers resultados={resultados} />
        </div>
      </div>

      <div style={{ padding: "0 24px 20px 24px" }}>
        <DiagramaUnifilar
          nodosDiagrama={nodosDiagrama}
          crearNodoDiagrama={crearNodoDiagrama}
          editarNodoDiagrama={editarNodoDiagrama}
          eliminarNodoDiagrama={eliminarNodoDiagrama}
          conexionesDiagrama={conexionesDiagrama}
          crearConexionDiagrama={crearConexionDiagrama}
          eliminarConexionDiagrama={eliminarConexionDiagrama}
        />
      </div>

      <PiePagina />
    </div>
  );
}
