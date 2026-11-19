import React from "react";
import Header from "./components/Header";
import BarraProyecto from "./components/BarraProyecto";
import FormularioCircuito from "./components/FormularioCircuito";
import FormularioEquipo from "./components/FormularioEquipo";
import Metrica from "./components/Metrica";
import TablaResultados from "./components/TablaResultados";
import PanelBreakers from "./components/PanelBreakers";
import PanelTableros from "./components/PanelTableros";
import PanelFuentesEnergia from "./components/PanelFuentesEnergia";
import SelectorNormativa from "./components/SelectorNormativa";
import DiagramaUnifilar from "./components/DiagramaUnifilar";
import TabsViewPager from "./components/TabsViewPager";
import PiePagina from "./components/PiePagina";
import { useCircuitos } from "./hooks/useCircuitos";
import { colores, fuentes } from "./styles/colores";

// Tab layout + ViewPager2 (pedido del usuario, retomado 2026-11-19):
// 4 pestañas, escalonadas por el ORDEN en que se van ingresando los
// datos — Normativa (lo primero que se configura) → Tableros (incluye
// fuentes de energía) → Circuitos y resultados (el grueso de la carga
// de datos + su feedback inmediato, por eso van juntos, no separados:
// la tabla de resultados reacciona en vivo mientras se cargan
// circuitos/equipos) → Diagrama unifilar. Una 5ta pestaña de "Resumen /
// informe técnico" queda pendiente para cuando exista esa función (ver
// "Memoria técnica / informe en PDF" en la hoja de ruta) — hoy no hay
// nada real que poner ahí, así que no se crea una pestaña vacía
// todavía; los totales/PanelBreakers que harían de "resumen" por ahora
// siguen en la pestaña de Circuitos y resultados. Ver TabsViewPager.jsx
// para el mecanismo de swipe.
export default function App() {
  const {
    proyecto,
    setProyecto,
    avisoArchivo,
    guardarProyecto,
    abrirProyecto,
    nuevoProyecto,
    circuitos,
    equipos,
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
    editarFuenteEnergia,
    eliminarFuenteEnergia,
    transformadores,
    crearTransformador,
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

      <TabsViewPager
        paneles={[
          {
            id: "normativa",
            label: "Normativa",
            contenido: (
              <div style={{ padding: "20px 24px", maxWidth: 560 }}>
                <SelectorNormativa
                  normativaActiva={normativaActiva}
                  setNormativaActiva={setNormativaActiva}
                  circuitos={circuitos}
                  tipoInstalacion={tipoInstalacion}
                  setTipoInstalacion={setTipoInstalacion}
                />
              </div>
            ),
          },
          {
            id: "tableros",
            label: "Tableros",
            contenido: (
              <div style={{ padding: "20px 24px", maxWidth: 640 }}>
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
                  tipoInstalacion={tipoInstalacion}
                  fuentesEnergia={fuentesEnergia}
                  crearFuenteEnergia={crearFuenteEnergia}
                  transformadores={transformadores}
                  crearTransformador={crearTransformador}
                />

                <div style={{ marginTop: 16 }}>
                  <PanelFuentesEnergia
                    fuentesEnergia={fuentesEnergia}
                    crearFuenteEnergia={crearFuenteEnergia}
                    editarFuenteEnergia={editarFuenteEnergia}
                    eliminarFuenteEnergia={eliminarFuenteEnergia}
                    listaIntegridad={listaIntegridad}
                  />
                </div>
              </div>
            ),
          },
          {
            id: "circuitos",
            label: "Circuitos y resultados",
            contenido: (
              <div style={{ padding: "20px 24px", display: "grid", gap: 20, gridTemplateColumns: "minmax(280px, 340px) 1fr", alignItems: "start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
            ),
          },
          {
            id: "diagrama",
            label: "Diagrama unifilar",
            contenido: (
              <div style={{ padding: "20px 24px" }}>
                <DiagramaUnifilar
                  nodosDiagrama={nodosDiagrama}
                  crearNodoDiagrama={crearNodoDiagrama}
                  editarNodoDiagrama={editarNodoDiagrama}
                  eliminarNodoDiagrama={eliminarNodoDiagrama}
                  conexionesDiagrama={conexionesDiagrama}
                  crearConexionDiagrama={crearConexionDiagrama}
                  eliminarConexionDiagrama={eliminarConexionDiagrama}
                  tableros={tableros}
                  equipos={equipos}
                  circuitos={circuitos}
                  fuentesEnergia={fuentesEnergia}
                  transformadores={transformadores}
                />
              </div>
            ),
          },
        ]}
      />

      <PiePagina />
    </div>
  );
}
