// Guardar/abrir el proyecto como .pdf (con los datos incrustados) en
// vez de .json — usuario, 2026-11-22, "quiero que el empaquetado...
// guarde en PDF en vez de json, necesitamos un traductor que convierta
// los datos de PDF a los utilizados en el programa". Prueba la capa
// PURA (generarPdfProyecto/extraerDatosDePdf, modules/persistencia/pdf.ts):
// round-trip exacto con una forma de datos realista (incluida una
// imagen de plano en base64, para probar un adjunto grande), y los 2
// casos de error esperados (PDF ajeno sin el adjunto, bytes que no son
// un PDF).
import { generarPdfProyecto, extraerDatosDePdf, NOMBRE_ARCHIVO_ADJUNTO } from "../src/modules/persistencia/pdf.ts";
import { serializarProyecto, deserializarProyecto } from "../src/modules/persistencia/proyecto.ts";
import { PDFDocument } from "pdf-lib";

function assert(cond, msg) {
  if (!cond) { console.error("FALLO:", msg); process.exitCode = 1; } else { console.log("OK:", msg); }
}

// --- 1. Round-trip con una forma de datos realista ---
const datosOriginales = serializarProyecto({
  proyecto: { nombre: "Casa López", fechaCreacion: "2026-01-01T00:00:00.000Z" },
  normativaActiva: "NEC",
  tipoInstalacion: "residencial_avanzado",
  circuitos: [{ id: "c1", nombre: "Iluminación", tableroId: "t1" }],
  equipos: [{ id: "e1", nombre: "Luminaria sala", circuitoId: "c1" }],
  tableros: [{ id: "t1", nombre: "TD-1" }],
  fuentesEnergia: [],
  transformadores: [],
  nodosDiagrama: [{ id: "n1", tipo: "tablero_electrico", nombre: "TD-1", posicion: { x: 0, y: 0 }, entidadId: "t1" }],
  conexionesDiagrama: [],
  plano: {
    imagen: { dataUrl: "data:image/png;base64," + "A".repeat(500_000), anchoPx: 1600, altoPx: 1200 },
    calibracion: { escalaMetrosPorPixel: 0.0125, metodo: "perimetro" },
    nodos: [],
    segmentos: [],
    habitaciones: [],
    rutasConductor: [],
    marcadoresEquipo: [],
  },
});

const pdfBytes = await generarPdfProyecto(datosOriginales, {
  tituloFicha: "Casa López",
  lineasFicha: ["Normativa: NEC", "Tableros: 1 · Circuitos: 1 · Equipos: 1"],
});
assert(pdfBytes.length > 0, "Se generó el PDF (bytes > 0)");

const datosRecuperados = await extraerDatosDePdf(pdfBytes);
assert(JSON.stringify(datosRecuperados) === JSON.stringify(datosOriginales), "Los datos recuperados del PDF son BYTE A BYTE idénticos a los originales (incluida la imagen de plano de 500KB)");

// Tienen que seguir pasando por deserializarProyecto sin romperse, igual que el .json de siempre.
const proyectoFinal = deserializarProyecto(datosRecuperados);
assert(proyectoFinal.proyecto.nombre === "Casa López", "deserializarProyecto reconstruye el proyecto normalmente a partir de los datos leídos del PDF");
assert(proyectoFinal.tableros.length === 1 && proyectoFinal.tableros[0].nombre === "TD-1", "Los tableros llegan intactos");
assert(proyectoFinal.plano.imagen.anchoPx === 1600, "La imagen del plano (incluido su data URL grande) llega intacta");

// --- 2. Error esperado: un PDF cualquiera, sin el adjunto ---
const pdfAjeno = await PDFDocument.create();
pdfAjeno.addPage([200, 200]).drawText("Un PDF cualquiera, sin datos de DEC.", { x: 20, y: 150, size: 10 });
const pdfAjenoBytes = await pdfAjeno.save();
try {
  await extraerDatosDePdf(pdfAjenoBytes);
  assert(false, "Un PDF sin el adjunto debería lanzar un error claro");
} catch (e) {
  assert(e.message.includes("no tiene datos de proyecto DEC"), `Mensaje de error claro para un PDF sin el adjunto (real: "${e.message}")`);
}

// --- 3. Error esperado: bytes que no son un PDF ---
try {
  await extraerDatosDePdf(new TextEncoder().encode("esto no es un pdf"));
  assert(false, "Bytes que no son un PDF deberían lanzar un error claro");
} catch (e) {
  assert(e.message.includes("no es un PDF válido"), `Mensaje de error claro para bytes que no son un PDF (real: "${e.message}")`);
}

console.log("\nTodas las pruebas completadas.");
