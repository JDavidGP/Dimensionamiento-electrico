import React, { useRef, useState } from "react";
import { colores, fuentes } from "../styles/colores";

// Tab layout + "ViewPager2" (pedido del usuario, 2026-11-20/2026-11-19:
// "un menú arriba, horizontal, que se desliza de izquierda a derecha...
// tabs tipo ViewPager2 — swipe, no solo click"). Todos los paneles se
// montan siempre (no se desmontan al cambiar de pestaña) — así el
// estado interno de cada uno (scroll, formularios abiertos, tarjetas
// expandidas) sobrevive al cambiar de pestaña, igual que un ViewPager2
// real mantiene vivas las páginas adyacentes.
//
// El swipe se implementa SOLO con eventos táctiles (touchstart/move/end),
// nunca con mousedown/mousemove — un swipe por mouse chocaría con el
// arrastre de nodos del diagrama unifilar (DiagramaUnifilar.jsx ya usa
// mousedown/mousemove para mover nodos) y con la selección de texto en
// los formularios. En desktop (sin touch) la navegación es 100% por
// click en las pestañas, sin ningún riesgo para esas interacciones. En
// touch, mover un nodo del diagrama arrastrándolo YA no funcionaba antes
// de este cambio (el editor solo escucha mouse) — limitación preexistente,
// no algo que este cambio introduce.
//
// Decisión de qué cuenta como "swipe" vs. "scroll vertical": se espera
// a que el gesto se mueva más de UMBRAL_DECISION_PX en algún eje antes
// de decidir; si predomina el eje vertical, se deja pasar el scroll
// normal de la página (no se llama preventDefault) — así no se rompe
// el scroll dentro de una pestaña larga.

const UMBRAL_DECISION_PX = 10;
const UMBRAL_CAMBIO_FRACCION = 0.22; // arrastrar > 22% del ancho del panel cambia de pestaña al soltar
const UMBRAL_CAMBIO_PX_MIN = 50; // o al menos este tanto en píxeles (paneles muy anchos)

export default function TabsViewPager({ paneles }) {
  const [activo, setActivo] = useState(0);
  const [deltaArrastre, setDeltaArrastre] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const contenedorRef = useRef(null);
  const activoRef = useRef(activo);
  activoRef.current = activo;
  // gesto.current.delta vive en un ref (no solo en el estado) porque una
  // secuencia de touchmove/touchend puede llegar en el mismo tick de
  // React (p. ej. un swipe rápido) ANTES de que el re-render con el
  // nuevo `deltaArrastre` llegue a confirmarse — si alTocarFin leyera
  // el `deltaArrastre` del cierre de React, podía leer un valor viejo
  // (0) y nunca disparar el cambio de pestaña. El ref siempre tiene el
  // último valor real, sin depender de que React ya haya renderizado.
  const gesto = useRef(null); // {startX, startY, direccion: null | "horizontal" | "vertical", delta: number}

  function irA(indice) {
    setActivo(Math.max(0, Math.min(paneles.length - 1, indice)));
  }

  function alTocarInicio(e) {
    const t = e.touches[0];
    gesto.current = { startX: t.clientX, startY: t.clientY, direccion: null, delta: 0 };
  }

  function alTocarMover(e) {
    if (!gesto.current) return;
    const t = e.touches[0];
    const dx = t.clientX - gesto.current.startX;
    const dy = t.clientY - gesto.current.startY;

    if (gesto.current.direccion === null) {
      if (Math.abs(dx) < UMBRAL_DECISION_PX && Math.abs(dy) < UMBRAL_DECISION_PX) return;
      gesto.current.direccion = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (gesto.current.direccion === "horizontal") setArrastrando(true);
    }

    if (gesto.current.direccion !== "horizontal") return; // deja el scroll vertical nativo intacto (touch-action: pan-y ya evita que el navegador lo capture como gesto propio)

    const esPrimero = activoRef.current === 0 && dx > 0;
    const esUltimo = activoRef.current === paneles.length - 1 && dx < 0;
    const valor = esPrimero || esUltimo ? dx / 3 : dx; // resistencia en los extremos, como un ViewPager real
    gesto.current.delta = valor;
    setDeltaArrastre(valor);
  }

  function alTocarFin() {
    if (gesto.current?.direccion === "horizontal") {
      const delta = gesto.current.delta;
      const anchoPanel = contenedorRef.current?.offsetWidth || 1;
      const cambia = Math.abs(delta) / anchoPanel > UMBRAL_CAMBIO_FRACCION || Math.abs(delta) > UMBRAL_CAMBIO_PX_MIN * 3;
      if (cambia) {
        if (delta < 0) irA(activoRef.current + 1);
        else irA(activoRef.current - 1);
      }
    }
    setArrastrando(false);
    setDeltaArrastre(0);
    gesto.current = null;
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          borderBottom: `1px solid ${colores.border}`,
          padding: "0 24px",
        }}
      >
        {paneles.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => irA(i)}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${i === activo ? colores.copper : "transparent"}`,
              color: i === activo ? colores.textMain : colores.textDim,
              fontFamily: fuentes.display,
              fontWeight: i === activo ? 700 : 500,
              fontSize: 13,
              whiteSpace: "nowrap",
              cursor: "pointer",
              transition: "color 0.15s ease, border-color 0.15s ease",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div
        ref={contenedorRef}
        style={{ overflow: "hidden", touchAction: "pan-y" }}
        onTouchStart={alTocarInicio}
        onTouchMove={alTocarMover}
        onTouchEnd={alTocarFin}
        onTouchCancel={alTocarFin}
      >
        {/* className (no solo inline style) a propósito: App.jsx la usa para
            anular el transform al imprimir — un transform en un ancestro
            vuelve a ESE ancestro el "contenedor de posicionamiento" para
            cualquier descendiente con position:absolute (ver el CSS
            @media print de App.jsx, InformeTecnico.jsx) — sin esto, el
            informe terminaba posicionado fuera de pantalla al imprimir. */}
        <div
          className="tabs-viewpager-strip"
          style={{
            display: "flex",
            alignItems: "flex-start",
            transform: `translateX(calc(${-activo * 100}% + ${deltaArrastre}px))`,
            transition: arrastrando ? "none" : "transform 0.25s ease",
          }}
        >
          {/* overflow:hidden en cada panel (no solo en contenedorRef más
              arriba) — defensa extra: si el contenido de UN panel se
              desborda de su propia caja (ej. una grilla con columnas de
              ancho mínimo fijo que no entra en un celular angosto), que
              no se "filtre" visualmente hacia el panel vecino — ver el
              bug visual reportado por el usuario, 2026-11-19. */}
          {paneles.map((p) => (
            <div key={p.id} style={{ flex: "0 0 100%", minWidth: 0, overflow: "hidden" }}>
              {p.contenido}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
