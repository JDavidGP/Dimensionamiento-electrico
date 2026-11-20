// src/modules/plano/exportarDXF.js
//
// Exportación CAD — Fase 2, segunda ronda (2026-11-20). Ver
// PLANO_INTELIGENTE_DISENO.md §7: porque el modelo ya es geometría
// pura en metros reales, sin ningún acoplamiento a dispositivo/
// render, exportar es "solo" un serializador que recorre el mismo
// grafo (nodos/segmentos/habitaciones, los mismos que usa el motor
// geométrico y el render) y emite otro formato de texto — CERO
// cambios al resto del plano.
//
// DXF (Drawing Exchange Format, de Autodesk) — formato ASCII basado
// en pares "código de grupo / valor", bien documentado públicamente.
// Se genera acá la variante R12 mínima (la más compatible — la leen
// AutoCAD, LibreCAD, QCAD y la inmensa mayoría de visores CAD) con
// solo la sección ENTITIES: una entidad LINE por pared, una entidad
// TEXT por ambiente (con su nombre y área). No hace falta ninguna
// librería — es texto plano con una gramática simple.
//
// Conversión de ejes: el modelo de este proyecto usa Y hacia ABAJO
// (convención de imagen/pantalla, ver PLANO_INTELIGENTE_DISENO.md §3)
// — CAD usa Y hacia ARRIBA (convención de dibujo técnico). Se invierte
// el signo de Y acá, SOLO al exportar, para que el dibujo se vea en la
// orientación correcta al abrirlo en un programa de CAD — el modelo
// interno nunca cambia.
//
// Módulo puro — se usa a través de PlanoMediator.

function filasGrupo(pares) {
  const lineas = [];
  for (const [codigo, valor] of pares) {
    lineas.push(String(codigo), String(valor));
  }
  return lineas;
}

/**
 * @param {object} datos
 * @param {object[]} datos.nodos - [{id, punto:{x,y}}] en metros (espacio modelo)
 * @param {object[]} datos.segmentos - [{id, nodoAId, nodoBId, tipo}]
 * @param {object[]} datos.habitaciones - [{id, nodoIds, nombre, areaM2, perimetroM}]
 * @returns {string} contenido del archivo .dxf (texto, codificación ASCII)
 */
export function generarDXF({ nodos = [], segmentos = [], habitaciones = [] } = {}) {
  const lineas = [...filasGrupo([[0, "SECTION"], [2, "ENTITIES"]])];

  for (const seg of segmentos) {
    const nodoA = nodos.find((n) => n.id === seg.nodoAId);
    const nodoB = nodos.find((n) => n.id === seg.nodoBId);
    if (!nodoA || !nodoB) continue; // referencia rota — se omite, no se inventa un punto
    lineas.push(
      ...filasGrupo([
        [0, "LINE"],
        [8, "PAREDES"],
        [10, nodoA.punto.x.toFixed(4)],
        [20, (-nodoA.punto.y).toFixed(4)],
        [30, "0.0"],
        [11, nodoB.punto.x.toFixed(4)],
        [21, (-nodoB.punto.y).toFixed(4)],
        [31, "0.0"],
      ])
    );
  }

  for (const hab of habitaciones) {
    const puntos = hab.nodoIds.map((id) => nodos.find((n) => n.id === id)?.punto).filter(Boolean);
    if (puntos.length === 0) continue;
    const centroX = puntos.reduce((s, p) => s + p.x, 0) / puntos.length;
    const centroY = puntos.reduce((s, p) => s + p.y, 0) / puntos.length;
    const etiqueta = `${hab.nombre} (${hab.areaM2.toFixed(2)} m2)`;
    lineas.push(
      ...filasGrupo([
        [0, "TEXT"],
        [8, "ETIQUETAS"],
        [10, centroX.toFixed(4)],
        [20, (-centroY).toFixed(4)],
        [30, "0.0"],
        [40, "0.2"], // altura de texto, metros — valor fijo razonable para un plano residencial
        [1, etiqueta],
      ])
    );
  }

  lineas.push(...filasGrupo([[0, "ENDSEC"], [0, "EOF"]]));

  // DXF usa fin de línea CRLF por especificación — algunos lectores viejos lo exigen.
  return lineas.join("\r\n") + "\r\n";
}

// Un archivo DXF R12 (AC1009, como el que genera generarDXF — sin
// sección HEADER ni $DWGCODEPAGE declarado) se asume codificado en
// Windows-1252/Latin-1 de 8 bits, NUNCA UTF-8 — es el comportamiento
// de AutoCAD, LibreCAD, QCAD y ezdxf (verificado leyendo el archivo
// generado con ezdxf, que es exactamente lo que detectó este bug: los
// acentos (ej. "Habitación") salían como "HabitaciÃ³n" porque un
// `Blob` de JavaScript construido a partir de un string codifica en
// UTF-8 por defecto — dos bytes para "ó" en vez del único byte 0xF3
// que cp1252 espera). Convierte el texto YA generado a los bytes
// crudos de Windows-1252, para pasárselos al Blob directo (ver
// useCircuitos.js, exportarDXFPlano) — nunca al string sin convertir.
const MAPA_CP1252_PUNTUACION_UNICODE = {
  0x2013: 0x96, // en-dash –
  0x2014: 0x97, // em-dash —
  0x2018: 0x91, // comilla simple izquierda ‘
  0x2019: 0x92, // comilla simple derecha ’
  0x201c: 0x93, // comilla doble izquierda “
  0x201d: 0x94, // comilla doble derecha ”
  0x2026: 0x85, // puntos suspensivos …
};

/**
 * Texto (string JS, UTF-16 interno) → bytes de Windows-1252. Los
 * caracteres ASCII y Latin-1 (á,é,í,ó,ú,ñ,¿,¡,ü, etc. — todo lo
 * razonable en un nombre de ambiente en español) mapean directo,
 * 1 a 1. Comillas tipográficas/rayas "inteligentes" (las que agregan
 * solas algunos teclados/procesadores de texto) se traducen a su
 * equivalente cp1252. Cualquier otro carácter fuera de ese repertorio
 * (ej. emoji) se reemplaza por "?" — mejor avisar visiblemente que
 * corromper en silencio.
 */
export function codificarDXFComoBytes(texto) {
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const code = texto.charCodeAt(i);
    if (code <= 0xff) {
      bytes[i] = code;
    } else if (MAPA_CP1252_PUNTUACION_UNICODE[code] != null) {
      bytes[i] = MAPA_CP1252_PUNTUACION_UNICODE[code];
    } else {
      bytes[i] = 0x3f; // "?"
    }
  }
  return bytes;
}
