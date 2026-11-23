// src/modules/iaLocal/ollamaClient.ts
//
// Cliente para un servidor Ollama LOCAL (self-hosted por el propio
// usuario, nunca un servicio de terceros) — usuario, 2026-11-22:
// "podemos usar IA si lo descargo y lo alojo en celular viejo o
// computadora solo para hacer estás pruebas, IA como Gemma o llama".
// Decisión explícita de NO usar una IA en la nube (ChatGPT/Claude) para
// esto, justo para no mandar el contenido de memorias técnicas a
// ningún servidor ajeno — el texto del PDF nunca sale de la máquina
// del usuario.
//
// Requiere que la propia app corra servida por HTTP (ej. `npm run
// dev`), no HTTPS: un navegador bloquea por "contenido mixto" que una
// página HTTPS llame a un servidor HTTP local/LAN. Ollama en
// 127.0.0.1 desde una página http://localhost no tiene ese problema.
//
// Módulo puro en cuanto a lógica (arma el prompt, interpreta la
// respuesta) pero SÍ hace fetch — vive acá y no en modules/motor
// porque no es un cálculo eléctrico, es integración con un servicio
// externo (aunque sea local).

export interface ConfigIALocal {
  baseUrl: string;
  modelo: string;
}

export const CONFIG_IA_LOCAL_DEFECTO: ConfigIALocal = {
  baseUrl: "http://localhost:11434",
  modelo: "llama3.2:3b",
};

// Tope de caracteres de texto de PDF que se manda en el prompt — un
// modelo chico corriendo en una laptop modesta no tiene una ventana de
// contexto gigante (ver num_ctx abajo); mejor truncar con aviso
// explícito al usuario que mandar algo que el modelo trunca él mismo
// en silencio o que satura la RAM de la máquina.
const MAX_CARACTERES_TEXTO = 12000;

const INSTRUCCION_SISTEMA = `Sos un asistente que extrae datos de instalaciones eléctricas de memorias técnicas o cálculos eléctricos.
Te paso el texto de un documento técnico (puede estar en español o inglés, y puede venir con la maquetación de tablas rota por la extracción de texto).
Tu única tarea es devolver un JSON con esta forma exacta, sin texto adicional antes ni después:

{
  "tableros": [
    {
      "nombre": "string — nombre o identificador del tablero/panel tal como aparece en el documento",
      "tension_v": number o null,
      "fases": "mono" | "bi" | "tri" | null,
      "circuitos": [
        {
          "descripcion": "string corta — qué alimenta este circuito",
          "corriente_a": number o null,
          "voltaje_v": number o null,
          "fases": "mono" | "bi" | "tri" | null
        }
      ]
    }
  ]
}

Reglas estrictas:
- Si el documento no da un dato, usá null — NUNCA inventes un número que no esté en el texto.
- Los campos numéricos son solo el número (sin unidades, sin texto).
- "fases" es mono (una fase), bi (bifásico/dos fases), o tri (trifásico) — si el documento no lo aclara, null.
- Si no encontrás ningún tablero o circuito reconocible, devolvé {"tableros": []}.
- Respondé SOLO el JSON, nada más.`;

export class ErrorIALocal extends Error {
  tipo: "conexion" | "respuesta_invalida" | "http";
  constructor(tipo: "conexion" | "respuesta_invalida" | "http", mensaje: string) {
    super(mensaje);
    this.tipo = tipo;
  }
}

function truncarTexto(texto: string): { texto: string; truncado: boolean } {
  if (texto.length <= MAX_CARACTERES_TEXTO) return { texto, truncado: false };
  return { texto: texto.slice(0, MAX_CARACTERES_TEXTO), truncado: true };
}

export interface ResultadoExtraccionIA {
  json: unknown;
  truncado: boolean;
}

/**
 * Manda el texto a Ollama y devuelve el JSON crudo que contestó (sin
 * validar contra el esquema esperado — eso es trabajo de
 * esquema.ts:validarExtraccion, a propósito en otro módulo: acá solo
 * se habla con el servidor, no se conoce la forma final de los datos).
 */
export async function extraerDeTexto(textoPDF: string, config: ConfigIALocal): Promise<ResultadoExtraccionIA> {
  const { texto, truncado } = truncarTexto(textoPDF);
  const prompt = `${INSTRUCCION_SISTEMA}\n\n--- TEXTO DEL DOCUMENTO ---\n${texto}\n--- FIN DEL TEXTO ---\n\nJSON:`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.modelo,
        prompt,
        format: "json",
        stream: false,
        // Ventana de contexto moderada — suficiente para varias páginas
        // de texto sin pedirle a una laptop de 8GB más de lo razonable.
        options: { num_ctx: 8192, temperature: 0.1 },
      }),
    });
  } catch {
    throw new ErrorIALocal(
      "conexion",
      `No se pudo conectar a Ollama en ${config.baseUrl}. Confirmá que Ollama está corriendo ("ollama run ${config.modelo}" en una terminal) y que la URL es correcta. Si el error persiste, puede ser un bloqueo de CORS — mirá OLLAMA_ORIGINS en la documentación de Ollama.`
    );
  }

  if (!respuesta.ok) {
    throw new ErrorIALocal("http", `Ollama respondió con error ${respuesta.status}. Confirmá que el modelo "${config.modelo}" está descargado ("ollama pull ${config.modelo}").`);
  }

  const cuerpo = await respuesta.json();
  const textoRespuesta = cuerpo?.response;
  if (typeof textoRespuesta !== "string" || !textoRespuesta.trim()) {
    throw new ErrorIALocal("respuesta_invalida", "Ollama contestó vacío — probá de nuevo o con un documento más corto.");
  }

  let json: unknown;
  try {
    json = JSON.parse(textoRespuesta);
  } catch {
    throw new ErrorIALocal("respuesta_invalida", "La IA no devolvió un JSON válido esta vez. Podés reintentar — con modelos chicos a veces pasa.");
  }

  return { json, truncado };
}
