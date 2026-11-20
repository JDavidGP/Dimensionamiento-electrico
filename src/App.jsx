import React, { useState } from "react";
import Header from "./components/Header";
import BarraProyecto from "./components/BarraProyecto";
import FormularioCircuito from "./components/FormularioCircuito";
import FormularioEquipo from "./components/FormularioEquipo";
import ImportarEquiposTexto from "./components/ImportarEquiposTexto";
import Metrica from "./components/Metrica";
import TablaResultados from "./components/TablaResultados";
import PanelBreakers from "./components/PanelBreakers";
import PanelTableros from "./components/PanelTableros";
import PanelFuentesEnergia from "./components/PanelFuentesEnergia";
import PanelTransformadores from "./components/PanelTransformadores";
import SelectorNormativa from "./components/SelectorNormativa";
import DiagramaUnifilar from "./components/DiagramaUnifilar";
import InformeTecnico from "./components/InformeTecnico";
import PanelDirectorio from "./components/PanelDirectorio";
import PlanoInteligente from "./components/PlanoInteligente";
import TabsViewPager from "./components/TabsViewPager";
import SubTabs from "./components/SubTabs";
import PiePagina from "./components/PiePagina";
import { useCircuitos } from "./hooks/useCircuitos";
import { colores, fuentes } from "./styles/colores";
import { OPCIONES_TIPO_INSTALACION, TIPOS_INSTALACION } from "./shared/constants/constantes.js";

// Tab layout + ViewPager2 (pedido del usuario, retomado 2026-11-19):
// 7 pestañas, escalonadas por el ORDEN en que se van ingresando los
// datos — Normativa (lo primero que se configura) → Tableros (incluye
// fuentes de energía) → Circuitos y resultados (el grueso de la carga
// de datos + su feedback inmediato, por eso van juntos, no separados:
// la tabla de resultados reacciona en vivo mientras se cargan
// circuitos/equipos) → Diagrama unifilar → Informe técnico → Directorio
// (sistema de etiquetado) → Plano (plano inteligente, Fase 1:
// calibración + trazado manual — ver PLANO_INTELIGENTE_DISENO.md,
// modules/plano/, modules/geometria/). Ver TabsViewPager.jsx para el
// mecanismo de swipe.
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
    editarEtiquetaFuncionCircuito,
    formEquipo,
    setFormEquipo,
    errorEquipo,
    editandoEquipoId,
    guardarEquipo,
    iniciarEdicionEquipo,
    cancelarEdicionEquipo,
    eliminarEquipo,
    editarEtiquetaFuncionEquipo,
    previsualizarImportacionEquipos,
    confirmarImportacionEquipos,
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
    editarTransformador,
    eliminarTransformador,
    nodosDiagrama,
    crearNodoDiagrama,
    editarNodoDiagrama,
    eliminarNodoDiagrama,
    conexionesDiagrama,
    crearConexionDiagrama,
    eliminarConexionDiagrama,
    planoImagen,
    cargarImagenPlano,
    quitarImagenPlano,
    planoCalibracion,
    calibrarPlano,
    nodosPlano,
    segmentosPlano,
    agregarNodoPlano,
    agregarSegmentoPlano,
    eliminarNodoPlano,
    eliminarSegmentoPlano,
    habitacionesPlano,
    cerrarHabitacionPlano,
    eliminarHabitacionPlano,
    renombrarHabitacionPlano,
    generarHabitacionPlano,
    moverHabitacionPlano,
    rutasConductorPlano,
    cerrarRutaConductorPlano,
    eliminarRutaConductorPlano,
    renombrarRutaConductorPlano,
    marcadoresEquipoPlano,
    agregarMarcadorEquipoPlano,
    editarMarcadorEquipoPlano,
    eliminarMarcadorEquipoPlano,
    corregirPerspectivaPlano,
    exportarDXFPlano,
    listaIntegridad,
  } = useCircuitos();

  const circuitoActivo = circuitos.find((c) => c.id === circuitoActivoId) ?? null;

  // Sub-pestaña activa dentro de "Esquemas" (Diagrama unifilar / Plano)
  // — agrupados bajo un mismo apartado a pedido del usuario (2026-11-20),
  // sin fusionar sus lienzos (ver SubTabs.jsx). Puramente de presentación,
  // nunca se persiste (mismo criterio que `modo` en PlanoInteligente).
  const [subTabEsquemas, setSubTabEsquemas] = useState(0);

  return (
    <div style={{ background: colores.bg, minHeight: "100vh", color: colores.textMain, fontFamily: fuentes.display, overflowX: "hidden" }}>
      <style>{`
        input, select { font-family: inherit; }
        input:focus, select:focus, button:focus { outline: 2px solid ${colores.copper}; outline-offset: 1px; }

        /* Bug visual reportado por el usuario (celular, captura adjunta,
           2026-11-19): en pantallas angostas, la grilla de 2 columnas de
           "Circuitos y resultados" (minmax(280px,...) + 1fr) no entra en
           el ancho disponible — la columna de resultados se desborda
           visualmente más allá del borde del panel, y se alcanza a ver
           contenido de la pestaña Diagrama "sangrando" al lado (el
           overflow:hidden de TabsViewPager no alcanza a contenerlo del
           todo en algunos navegadores/celulares). Abajo de 680px, apila
           en una sola columna — dos valores fijos de 280/340px simplemente
           no caben en un celular angosto (~360-400px de ancho real).
           overflowX:hidden en la raíz de arriba es una red de seguridad
           adicional: ningún contenido debería poder "escaparse"
           horizontalmente de la app, pase lo que pase adentro. */
        @media (max-width: 680px) {
          .circuitos-grid { grid-template-columns: 1fr !important; }
        }

        /* Informe técnico (InformeTecnico.jsx): al imprimir/"Guardar como PDF",
           mostrar SOLO el informe, sin importar qué pestaña está activa en
           pantalla (TabsViewPager monta todas las pestañas siempre, solo
           las desplaza fuera de vista con transform — display:none ahí no
           alcanza; visibility sí atraviesa eso). */
        @media print {
          body * { visibility: hidden; }
          #informe-memoria-tecnica, #informe-memoria-tecnica * { visibility: visible; }
          #informe-memoria-tecnica { position: absolute; top: 0; left: 0; width: 100%; }
          #informe-memoria-tecnica-boton-imprimir { display: none; }
          /* El transform de TabsViewPager vuelve a .tabs-viewpager-strip el
             "contenedor de posicionamiento" de cualquier descendiente con
             position:absolute (CSS: un ancestro con transform SIEMPRE lo
             es) — sin anularlo acá, #informe-memoria-tecnica (arriba)
             queda posicionado relativo a esa tira desplazada en vez de a
             la página, y termina fuera de pantalla al imprimir. */
          .tabs-viewpager-strip { transform: none !important; }
        }
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

                {/* Transformador: origen seleccionable SOLO en instalación
                    industrial (ver TIPOS_ORIGEN.TRANSFORMADOR en
                    modules/origen/index.js) — su lista propia sigue el
                    mismo gateo. */}
                {tipoInstalacion === TIPOS_INSTALACION.COMERCIAL_INDUSTRIAL && (
                  <div style={{ marginTop: 16 }}>
                    <PanelTransformadores
                      transformadores={transformadores}
                      crearTransformador={crearTransformador}
                      editarTransformador={editarTransformador}
                      eliminarTransformador={eliminarTransformador}
                      listaIntegridad={listaIntegridad}
                    />
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "circuitos",
            label: "Circuitos y resultados",
            contenido: (
              <div className="circuitos-grid" style={{ padding: "20px 24px", display: "grid", gap: 20, gridTemplateColumns: "minmax(280px, 340px) 1fr", alignItems: "start" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <FormularioCircuito
                    form={formCircuito}
                    setForm={setFormCircuito}
                    onGuardar={guardarCircuito}
                    onCancelar={cancelarEdicionCircuito}
                    error={errorCircuito}
                    editando={!!editandoCircuitoId}
                    normativaActiva={normativaActiva}
                    tipoInstalacion={tipoInstalacion}
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

                  <ImportarEquiposTexto
                    onPrevisualizar={previsualizarImportacionEquipos}
                    onConfirmar={confirmarImportacionEquipos}
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
            id: "esquemas",
            label: "Esquemas",
            contenido: (
              <div style={{ padding: "20px 24px" }}>
                <SubTabs
                  activo={subTabEsquemas}
                  onCambiar={setSubTabEsquemas}
                  paneles={[
                    {
                      id: "diagrama",
                      label: "Diagrama unifilar",
                      contenido: (
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
                      ),
                    },
                    {
                      id: "plano",
                      label: "Plano",
                      contenido: (
                        <PlanoInteligente
                          planoImagen={planoImagen}
                          cargarImagenPlano={cargarImagenPlano}
                          quitarImagenPlano={quitarImagenPlano}
                          planoCalibracion={planoCalibracion}
                          calibrarPlano={calibrarPlano}
                          nodosPlano={nodosPlano}
                          segmentosPlano={segmentosPlano}
                          agregarNodoPlano={agregarNodoPlano}
                          agregarSegmentoPlano={agregarSegmentoPlano}
                          eliminarNodoPlano={eliminarNodoPlano}
                          eliminarSegmentoPlano={eliminarSegmentoPlano}
                          habitacionesPlano={habitacionesPlano}
                          cerrarHabitacionPlano={cerrarHabitacionPlano}
                          eliminarHabitacionPlano={eliminarHabitacionPlano}
                          renombrarHabitacionPlano={renombrarHabitacionPlano}
                          generarHabitacionPlano={generarHabitacionPlano}
                          moverHabitacionPlano={moverHabitacionPlano}
                          rutasConductorPlano={rutasConductorPlano}
                          cerrarRutaConductorPlano={cerrarRutaConductorPlano}
                          eliminarRutaConductorPlano={eliminarRutaConductorPlano}
                          renombrarRutaConductorPlano={renombrarRutaConductorPlano}
                          marcadoresEquipoPlano={marcadoresEquipoPlano}
                          agregarMarcadorEquipoPlano={agregarMarcadorEquipoPlano}
                          editarMarcadorEquipoPlano={editarMarcadorEquipoPlano}
                          eliminarMarcadorEquipoPlano={eliminarMarcadorEquipoPlano}
                          corregirPerspectivaPlano={corregirPerspectivaPlano}
                          exportarDXFPlano={exportarDXFPlano}
                          tableros={tableros}
                          equipos={equipos}
                          circuitos={circuitos}
                          fuentesEnergia={fuentesEnergia}
                          transformadores={transformadores}
                        />
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            id: "informe",
            label: "Informe técnico",
            contenido: (
              <div style={{ padding: "20px 24px" }}>
                <InformeTecnico
                  proyecto={proyecto}
                  normativaActiva={normativaActiva}
                  tipoInstalacion={OPCIONES_TIPO_INSTALACION.find((o) => o.valor === tipoInstalacion)
                    ? { id: tipoInstalacion, label: OPCIONES_TIPO_INSTALACION.find((o) => o.valor === tipoInstalacion).label }
                    : null}
                  circuitos={circuitos}
                  equipos={equipos}
                  resultados={resultados}
                  tableros={tableros}
                  alimentadores={alimentadores}
                  fuentesEnergia={fuentesEnergia}
                  transformadores={transformadores}
                  listaIntegridad={listaIntegridad}
                  nodosDiagrama={nodosDiagrama}
                  conexionesDiagrama={conexionesDiagrama}
                />
              </div>
            ),
          },
          {
            id: "directorio",
            label: "Directorio",
            contenido: (
              <div style={{ padding: "20px 24px" }}>
                <PanelDirectorio
                  tableros={tableros}
                  editarTablero={editarTablero}
                  eliminarTablero={eliminarTablero}
                  circuitos={circuitos}
                  editarEtiquetaFuncionCircuito={editarEtiquetaFuncionCircuito}
                  eliminarCircuito={eliminarCircuito}
                  equipos={equipos}
                  editarEtiquetaFuncionEquipo={editarEtiquetaFuncionEquipo}
                  eliminarEquipo={eliminarEquipo}
                  nodosDiagrama={nodosDiagrama}
                  editarNodoDiagrama={editarNodoDiagrama}
                  eliminarNodoDiagrama={eliminarNodoDiagrama}
                  habitacionesPlano={habitacionesPlano}
                  renombrarHabitacionPlano={renombrarHabitacionPlano}
                  eliminarHabitacionPlano={eliminarHabitacionPlano}
                  rutasConductorPlano={rutasConductorPlano}
                  renombrarRutaConductorPlano={renombrarRutaConductorPlano}
                  eliminarRutaConductorPlano={eliminarRutaConductorPlano}
                  marcadoresEquipoPlano={marcadoresEquipoPlano}
                  editarMarcadorEquipoPlano={editarMarcadorEquipoPlano}
                  eliminarMarcadorEquipoPlano={eliminarMarcadorEquipoPlano}
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
