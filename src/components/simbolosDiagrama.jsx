import React from "react";

// Símbolos básicos del diagrama unifilar — dibujados a mano (ninguno
// copiado de ningún tercero), a pedido explícito del usuario tras
// evaluar fuentes externas: ninguna cubría el catálogo completo con
// licencia y estilo consistentes (ver resumen de la investigación en
// la conversación — upb-lea/Inkscape_electric_Symbols es CC0 pero no
// cubre instalación eléctrica de edificio; Trpz3/sld es MIT pero
// incompleto y con errores de marcado). Formas GENÉRICAS de diagramas
// unifilares (círculo=medidor/motor, barras de batería, zigzag de
// bobina, etc.) — convenciones de uso común en cualquier software de
// esquemas, no arte protegido de nadie.
//
// Cada símbolo se dibuja en un viewBox lógico de 32×32, centrado, solo
// trazo (fill="none" salvo los puntos de contacto rellenos) — el color
// lo decide quien lo use (DiagramaUnifilar.jsx ya tiene un color por
// categoría). Ninguno es un símbolo IEC 60617 oficial reproducido —
// son equivalentes simplificados, consistentes con el resto de la UI.

function Linea(props) {
  return <line strokeLinecap="round" {...props} />;
}

const SIMBOLOS = {
  acometida: () => (
    <>
      <Linea x1={16} y1={2} x2={16} y2={14} />
      <path d="M10,14 L16,22 L22,14 Z" fill="currentColor" stroke="none" />
    </>
  ),
  transformador: () => (
    <>
      <circle cx={11} cy={16} r={7} />
      <circle cx={21} cy={16} r={7} />
    </>
  ),
  generador: () => (
    <>
      <circle cx={16} cy={16} r={11} />
      <text x={16} y={20} textAnchor="middle" fontSize={12} stroke="none" fill="currentColor">
        G
      </text>
    </>
  ),
  banco_baterias: () => (
    <>
      <Linea x1={2} y1={16} x2={8} y2={16} />
      <Linea x1={8} y1={7} x2={8} y2={25} strokeWidth={2.5} />
      <Linea x1={13} y1={11} x2={13} y2={21} />
      <Linea x1={13} y1={16} x2={19} y2={16} />
      <Linea x1={19} y1={7} x2={19} y2={25} strokeWidth={2.5} />
      <Linea x1={24} y1={11} x2={24} y2={21} />
      <Linea x1={24} y1={16} x2={30} y2={16} />
    </>
  ),
  panel_fotovoltaico: () => (
    <>
      <rect x={4} y={8} width={24} height={16} />
      <Linea x1={4} y1={16} x2={28} y2={16} />
      <Linea x1={12} y1={8} x2={12} y2={24} />
      <Linea x1={20} y1={8} x2={20} y2={24} />
    </>
  ),
  medidor: () => (
    <>
      <circle cx={16} cy={16} r={11} />
      <Linea x1={16} y1={16} x2={22} y2={10} />
      <circle cx={16} cy={16} r={1.3} fill="currentColor" stroke="none" />
    </>
  ),
  interruptor_principal: () => (
    <>
      <rect x={6} y={5} width={20} height={22} />
      <Linea x1={10} y1={22} x2={20} y2={10} />
      <circle cx={10} cy={22} r={1.4} fill="currentColor" stroke="none" />
      <circle cx={20} cy={10} r={1.4} fill="currentColor" stroke="none" />
    </>
  ),
  interruptor_termomagnetico: () => (
    <>
      <Linea x1={16} y1={3} x2={16} y2={11} />
      <Linea x1={12} y1={11} x2={20} y2={21} />
      <circle cx={12} cy={11} r={1.4} fill="currentColor" stroke="none" />
      <circle cx={20} cy={21} r={1.4} fill="currentColor" stroke="none" />
      <Linea x1={16} y1={21} x2={16} y2={29} />
    </>
  ),
  interruptor_diferencial: () => (
    <>
      <circle cx={16} cy={16} r={9} />
      <Linea x1={16} y1={3} x2={16} y2={11} />
      <Linea x1={13} y1={13} x2={19} y2={19} />
      <circle cx={13} cy={13} r={1.2} fill="currentColor" stroke="none" />
      <circle cx={19} cy={19} r={1.2} fill="currentColor" stroke="none" />
      <Linea x1={16} y1={21} x2={16} y2={29} />
    </>
  ),
  spd: () => (
    <>
      <Linea x1={16} y1={2} x2={16} y2={14} />
      <path d="M9,14 L23,14 L16,24 Z" />
      <Linea x1={16} y1={24} x2={16} y2={27} />
      <Linea x1={9} y1={29} x2={23} y2={29} />
      <Linea x1={12} y1={31} x2={20} y2={31} />
    </>
  ),
  fusible: () => (
    <>
      <Linea x1={2} y1={16} x2={10} y2={16} />
      <rect x={10} y={10} width={12} height={12} rx={6} />
      <Linea x1={22} y1={16} x2={30} y2={16} />
    </>
  ),
  tablero_electrico: () => (
    <>
      <rect x={4} y={3} width={24} height={20} />
      <Linea x1={10} y1={10} x2={22} y2={10} />
      <Linea x1={10} y1={15} x2={22} y2={15} />
      <Linea x1={8} y1={23} x2={8} y2={29} />
      <Linea x1={16} y1={23} x2={16} y2={29} />
      <Linea x1={24} y1={23} x2={24} y2={29} />
    </>
  ),
  barra_distribucion: () => <Linea x1={2} y1={16} x2={30} y2={16} strokeWidth={4} />,
  contacto: () => (
    <>
      <circle cx={16} cy={16} r={10} />
      <Linea x1={12} y1={12} x2={12} y2={20} />
      <Linea x1={20} y1={12} x2={20} y2={20} />
    </>
  ),
  interruptor: () => (
    <>
      <circle cx={9} cy={23} r={1.4} fill="currentColor" stroke="none" />
      <circle cx={23} cy={9} r={1.4} fill="currentColor" stroke="none" />
      <Linea x1={9} y1={23} x2={23} y2={9} />
    </>
  ),
  luminaria: () => (
    <>
      <circle cx={16} cy={13} r={9} />
      <Linea x1={10} y1={7} x2={22} y2={19} />
      <Linea x1={22} y1={7} x2={10} y2={19} />
      <Linea x1={12} y1={22} x2={20} y2={22} />
      <Linea x1={13} y1={25} x2={19} y2={25} />
      <Linea x1={14} y1={28} x2={18} y2={28} />
    </>
  ),
  motor: () => (
    <>
      <circle cx={16} cy={16} r={11} />
      <text x={16} y={20} textAnchor="middle" fontSize={12} stroke="none" fill="currentColor">
        M
      </text>
    </>
  ),
  carga_especial: () => <path d="M16,3 L29,16 L16,29 L3,16 Z" />,
  inversor: () => (
    <>
      <rect x={4} y={6} width={24} height={20} />
      <Linea x1={7} y1={12} x2={14} y2={12} />
      <path d="M17,20 q2,-6 4,0 t4,0" fill="none" />
    </>
  ),
  variador_frecuencia: () => (
    <>
      <rect x={4} y={6} width={24} height={20} />
      <path d="M7,17 q3,-7 6,0 t6,0" fill="none" />
      <path d="M21,21 L25,21 L23,25 Z" fill="currentColor" stroke="none" />
    </>
  ),
  plc: () => (
    <>
      <rect x={9} y={5} width={14} height={22} />
      <Linea x1={2} y1={10} x2={9} y2={10} />
      <Linea x1={2} y1={16} x2={9} y2={16} />
      <Linea x1={2} y1={22} x2={9} y2={22} />
      <Linea x1={23} y1={10} x2={30} y2={10} />
      <Linea x1={23} y1={16} x2={30} y2={16} />
      <Linea x1={23} y1={22} x2={30} y2={22} />
    </>
  ),
  rele: () => (
    <>
      <rect x={5} y={10} width={22} height={12} />
      <path d="M9,16 l2.5,-4 l2.5,4 l2.5,-4 l2.5,4 l2.5,-4 l2.5,4" fill="none" />
    </>
  ),
  contactor: () => (
    <>
      <rect x={6} y={4} width={20} height={9} />
      <Linea x1={10} y1={18} x2={10} y2={27} />
      <Linea x1={16} y1={18} x2={16} y2={27} />
      <Linea x1={22} y1={18} x2={22} y2={27} />
    </>
  ),
  bobina: () => (
    <path d="M3,16 a3.2,3.2 0 0,1 6.4,0 a3.2,3.2 0 0,1 6.4,0 a3.2,3.2 0 0,1 6.4,0 a3.2,3.2 0 0,1 6.4,0" fill="none" />
  ),
  sensor: () => (
    <>
      <circle cx={11} cy={21} r={6} />
      <Linea x1={16} y1={16} x2={25} y2={7} />
      <Linea x1={19} y1={7} x2={25} y2={7} />
      <Linea x1={25} y1={7} x2={25} y2={13} />
    </>
  ),
};

const SIMBOLO_GENERICO = () => <rect x={5} y={5} width={22} height={22} rx={2} />;

/** Símbolo básico de un componente del diagrama, dentro de un viewBox lógico 32×32. */
export function SimboloDiagrama({ tipo, x = 0, y = 0, size = 28, color }) {
  const Dibujo = SIMBOLOS[tipo] ?? SIMBOLO_GENERICO;
  return (
    <g transform={`translate(${x}, ${y}) scale(${size / 32})`} stroke={color} strokeWidth={1.8} fill="none" color={color}>
      <Dibujo />
    </g>
  );
}

export function tieneSimbolo(tipo) {
  return Boolean(SIMBOLOS[tipo]);
}
