# Plano inteligente — diseño de arquitectura geométrica

> Documento de **diseño**, escrito ANTES de implementar nada — responde la
> pregunta del usuario (2026-11-20) sobre independencia de dispositivo y
> propone la arquitectura completa. Una vez que se empiece a construir,
> las secciones correspondientes (Motor geométrico → `modules/geometria/`,
> `PlanoMediator`, etc.) se resumen también en `ARCHITECTURE.md`, igual
> criterio que el resto de los mediadores — este archivo queda como la
> referencia larga/razonada, `ARCHITECTURE.md` como la referencia corta
> una vez que el código exista de verdad.

---

## 0. La pregunta, respondida directo

**¿Cambian los cálculos si se calibra en un dispositivo y se abre en otro?**

**No — pero solo si se separa, desde el primer día, "lo que se mide" de
"lo que se ve".** Si se calibra o se mide contra **píxeles de pantalla**
(CSS pixels del `<canvas>` tal como está dibujado AHORA), el resultado
sí cambia con el zoom, el tamaño de ventana, el `devicePixelRatio` del
dispositivo y el navegador — eso es matemáticamente inevitable, porque
"píxel de pantalla" no es una unidad fija: es una función de cuánta
superficie física ocupa 1 unidad lógica, que varía por dispositivo y por
estado de la vista (zoom actual).

La solución (y es la única solución real, es literalmente lo que hace
cualquier CAD/GIS profesional) es que **ningún cálculo toque nunca un
píxel de pantalla**. Todo cálculo vive en un **espacio de coordenadas
interno del proyecto, en metros reales**, que es un dato — un número en
el JSON del proyecto — y no una propiedad del dispositivo. La pantalla
solo traduce ESE dato a donde sea que haya que dibujarlo ahora, y esa
traducción se **recalcula cada vez**, nunca se guarda como si fuera el
dato real.

---

## 1. Tres espacios de coordenadas — la idea central

```
┌─────────────────────────────────────────────────────────────────┐
│  ESPACIO MODELO (metros reales) — "el proyecto"                  │
│  Persistido en el JSON. Fijo. Igual en cualquier dispositivo.    │
│  Acá viven: nodos de pared, polígonos de habitación, longitudes. │
│  Unidad: METROS. Origen: arbitrario pero fijo (ver §3).          │
└─────────────────────────────────────────────────────────────────┘
                 ▲                              │
                 │ calibracion.escala           │ calibracion.escala
                 │ (metros por píxel de imagen) │ (inversa)
                 │                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ESPACIO IMAGEN (píxeles de la imagen/PDF cargado)                │
│  Fijo una vez cargado el archivo — es una propiedad DEL ARCHIVO, │
│  no del dispositivo que lo abre (un PDF de 1000×800pt o una      │
│  imagen de 3000×2000px mide siempre lo mismo, lo abra quien lo   │
│  abra). Solo existe para posicionar el FONDO (la imagen de fondo │
│  de referencia) debajo del trazado vectorial.                    │
└─────────────────────────────────────────────────────────────────┘
                 ▲                              │
                 │ transformVista (zoom + pan)  │ transformVista⁻¹
                 │ EFÍMERO, nunca persistido    │ (clicks → modelo)
                 │ como parte del cálculo       │
                 ▼                              │
┌─────────────────────────────────────────────────────────────────┐
│  ESPACIO PANTALLA (CSS pixels del <canvas> ahora mismo)           │
│  Cambia con zoom, resize de ventana, DPR del dispositivo.        │
│  SOLO sirve para dibujar y para recibir clicks — nunca se        │
│  guarda, nunca alimenta un cálculo directamente.                 │
└─────────────────────────────────────────────────────────────────┘
```

**Regla de oro de este módulo** (mismo espíritu que la Regla de oro de
`ARCHITECTURE.md` §1): *ningún módulo que calcule algo (geometría,
motor eléctrico) puede importar ni leer nada que dependa de `window`,
`devicePixelRatio`, el tamaño del `<canvas>` o el estado de zoom/pan.
Si una función necesita esos datos, es una función de render o de
interacción, no de cálculo — van en archivos distintos.*

---

## 2. Arquitectura en 6 capas (respondiendo el pedido explícito)

```
┌──────────────────────────────────────────────────────────────────┐
│ 6. INTERFAZ GRÁFICA (React)                                       │
│    usePlano.js (hook) · PlanoToolbar.jsx · formularios de pared/  │
│    habitación/elemento. Mantiene el `transformVista` (zoom/pan)   │
│    como estado efímero — NUNCA se persiste como parte del cálculo.│
└───────────────────────────────┬────────────────────────────────┘
                                 │ llama a
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ ApplicationMediator → PlanoMediator                                │
│    (mismo patrón que TableroMediator/OrigenMediator ya existentes) │
└───────┬──────────────┬──────────────┬───────────────┬────────────┘
        │              │              │               │
        ▼              ▼              ▼               ▼
┌───────────────┐┌─────────────┐┌─────────────┐┌──────────────────┐
│ 1. MOTOR       ││ 2. SISTEMA  ││ 3. ESCALA    ││ (consume, no     │
│    GEOMÉTRICO  ││    DE       ││    DEL       ││  produce, geome- │
│                ││    COORDE-  ││    PROYECTO  ││  tría)           │
│ modules/       ││    NADAS    ││              ││                  │
│ geometria/     ││             ││ modules/     ││ 6. MOTOR DE      │
│                ││ modules/    ││ plano/       ││    CÁLCULOS      │
│ distancia(),   ││ plano/      ││ calibracion. ││    ELÉCTRICOS    │
│ areaPoligono(),││ coordenadas ││ js           ││    (YA EXISTE)   │
│ perimetro(),   ││ .js         ││              ││                  │
│ interseccion(),││             ││ calcularEsc- ││ MotorCalculo-    │
│ cicloCerrado() ││ aPantalla() ││ ala(),       ││ Mediator — NO    │
│                ││ aModelo()   ││ imagenAMo-   ││ se toca; recibe  │
│ 100% puro,     ││             ││ delo()       ││ áreaM2 ya        │
│ CERO zoom/DOM  ││ 100% puro,  ││              ││ calculada como   │
│                ││ matriz 2D   ││ 100% puro    ││ SUGERENCIA, no   │
│                ││ afín        ││              ││ como cálculo     │
│                ││             ││              ││ directo (ver §6) │
└───────────────┘└─────────────┘└─────────────┘└──────────────────┘
                                 ▲
                                 │ pinta (lee modelo + transformVista,
                                 │ escribe solo píxeles)
┌──────────────────────────────────────────────────────────────────┐
│ 4. MOTOR DE RENDERIZADO — PlanoCanvas.jsx                          │
│    NO es un módulo puro (necesita <canvas>/SVG) — vive en un      │
│    componente React, mismo nivel que DiagramaUnifilar.jsx hoy.    │
│    Por cada punto a dibujar: coordenadas.aPantalla(puntoModelo,   │
│    transformVista). Por cada click: coordenadas.aModelo(click,    │
│    transformVista) ANTES de pasarlo a cualquier mediador.         │
└──────────────────────────────────────────────────────────────────┘
```

### Por qué nunca dependen de la resolución del dispositivo

| Capa | Qué sabe | Qué NO sabe nunca |
|------|----------|---------------------|
| Motor geométrico | números en metros | pixeles, canvas, zoom, DPR, `window` |
| Sistema de coordenadas | matrices 2D (afines), las fórmulas de transformar | el tamaño REAL de ningún dispositivo — recibe el tamaño del canvas como PARÁMETRO, no lo averigua solo |
| Escala del proyecto | dos puntos + una distancia real → un escalar | nada de pantalla; el escalar es un dato de proyecto, como `tensionAlimentacion` de un tablero |
| Motor de renderizado | el `<canvas>` actual, su tamaño CSS, el `devicePixelRatio` | cómo calcular un área o una distancia — solo pide los puntos ya en metros y los proyecta |
| Interfaz gráfica | qué herramienta está activa, el `transformVista` efímero | nada de esto se guarda en el JSON del proyecto salvo, opcionalmente, como preferencia de UI explícitamente marcada como no-autoritativa |
| Motor eléctrico | metros², cantidades | de dónde salieron esos metros² — nunca importa nada de `modules/plano/` directamente (regla ya existente en §11 de ARCHITECTURE.md, extendida) |

Como el modelo persistido (JSON del proyecto) solo contiene **números en
metros + la estructura del grafo de paredes/polígonos**, y la aritmética
de punto flotante IEEE754 que usa JavaScript es la misma especificación
en cualquier motor (V8 de Chrome/Edge en Windows o Android, JavaScriptCore
en iOS/Safari, etc.), el mismo archivo de proyecto produce el mismo
resultado en cualquier dispositivo — exactamente el mismo principio que
ya aplica esta app para los cálculos eléctricos (nunca leen de `window`
ni de nada específico del navegador).

---

## 3. Sistema de coordenadas interno — convención

- **Unidad:** metros (float), no píxeles, no centímetros.
- **Origen:** arbitrario, fijado una sola vez al calibrar (ej.: el
  punto A de la calibración, o la esquina superior-izquierda de la
  imagen convertida a metros) — no importa CUÁL, porque toda longitud,
  área y perímetro se calcula de diferencias entre puntos, que son
  invariantes ante traslación del origen. Se documenta una sola
  convención y no se vuelve a tocar.
- **Ejes:** X hacia la derecha, Y hacia abajo (mismo criterio que
  canvas/imagen — evita tener que invertir Y constantemente al
  convertir desde/hacia espacio imagen).
- **Sin rotación global** en v1 (el plano se calibra "tal como está");
  rotar el plano completo es una operación de VISTA (`transformVista`
  puede rotar para visualizar), nunca del modelo.

```js
// Tipo de dato — modules/plano/ (y futuro modules/geometria/ compartido)
Punto = { x: number, y: number }  // SIEMPRE metros, espacio modelo
```

---

## 4. Algoritmo de calibración

```
función calibrarProyecto(puntoPantallaA, puntoPantallaB, distanciaRealMetros, transformVista):
    # 1. NUNCA calibrar contra píxeles de pantalla — deshacer la vista actual primero
    puntoImagenA = coordenadas.aModelo(puntoPantallaA, transformVista)
    puntoImagenB = coordenadas.aModelo(puntoPantallaB, transformVista)
    # (acá "modelo" == espacio imagen todavía, porque la calibración
    #  ES el paso que define la conversión imagen → metros reales)

    distanciaPixeles = √((Bx-Ax)² + (By-Ay)²)

    si distanciaPixeles == 0 → error "los dos puntos no pueden ser el mismo"
    si distanciaRealMetros <= 0 → error "la distancia real debe ser mayor a 0"

    escalaMetrosPorPixel = distanciaRealMetros / distanciaPixeles

    proyecto.plano.calibracion = {
        puntoA: puntoImagenA, puntoB: puntoImagenB,
        distanciaRealMetros, escalaMetrosPorPixel,
    }
    devolver escalaMetrosPorPixel
```

A partir de ahí, **cada punto que el usuario traza** (pared, nodo,
elemento) se convierte UNA VEZ, en el momento de trazarlo, de píxeles de
imagen a metros reales, y así es como se guarda — nunca se vuelve a
tocar la imagen para recalcular nada:

```
puntoModelo.x = puntoImagen.x * escalaMetrosPorPixel
puntoModelo.y = puntoImagen.y * escalaMetrosPorPixel
```

Desde ese momento, el motor geométrico y el eléctrico **solo ven
metros** — no saben que alguna vez hubo una imagen ni una escala.

### Qué pasa en cada escenario

| Escenario | Qué cambia | Qué NO cambia |
|-----------|------------|----------------|
| Usuario hace zoom | `transformVista.zoom` (estado de React, efímero) | `escalaMetrosPorPixel`, todos los puntos del modelo (metros) |
| Cambia tamaño de ventana | el "fit to viewport" recalcula `transformVista` para que el MISMO contenido entre en el nuevo tamaño | el modelo, la calibración |
| Teléfono → tablet | tamaño físico de pantalla y `devicePixelRatio` — absorbidos 100% por cómo se dimensiona el backing store del `<canvas>` (`canvas.width = cssWidth * dpr`), un detalle de nitidez de render | el modelo, la calibración, cualquier resultado |
| Android → Windows | motor de render del navegador/SO | el JSON del proyecto es datos planos (números); los mismos números con la misma aritmética dan el mismo resultado |
| Proyecto compartido entre dispositivos | el `transformVista` se recalcula desde cero al abrir (ej.: "ajustar a la ventana"), nunca se restaura desde el archivo como si fuera dato de cálculo | la calibración y la geometría viajan intactas dentro del JSON — se abre y mide igual en cualquier lado |

---

## 5. Casos especiales de origen del plano

| Caso | Riesgo principal | Procedimiento de calibración recomendado |
|------|-------------------|---------------------------------------------|
| **PDF vectorial** | Ninguno geométrico grave — pero extraer las paredes directo de los paths vectoriales del PDF es un proyecto aparte (los PDF de distintos CAD agrupan/capas de formas muy distinto, nada estandarizado de forma confiable) | v1: renderizar la página a un raster de referencia (vía `pdf.js`, a una escala FIJA, ej. 150dpi) y tratarlo exactamente como una imagen escaneada — calibración de 2 puntos. Extracción automática de paths vectoriales queda **fuera de alcance**, anotada como mejora futura, igual criterio que la detección automática de paredes en imágenes |
| **Plano escaneado (imagen)** | Mínimo — los escáneres planos rara vez introducen perspectiva | Calibración estándar de 2 puntos, usando la distancia de referencia **más larga disponible** en el plano (ej. el ancho total del edificio en el cajetín de cotas) en vez de un segmento corto — el error de "hacer click 2-3px desviado" pesa proporcionalmente mucho menos sobre una referencia larga |
| **Fotografía con cámara** | **Perspectiva** — un escalar único (metros por píxel igual en cualquier dirección) es matemáticamente incorrecto acá: un punto lejos de la cámara mide distinto por píxel que uno cerca | v1 honesto: avisar al usuario que fotografíe lo más perpendicular/cenital posible y aceptar el mismo error de la calibración de 2 puntos (bueno para boceto, no para precisión). V2 (más adelante, NO en esta ronda): calibración de **4 puntos** sobre un rectángulo conocido (ej. las 4 esquinas de una habitación) para resolver una **homografía** (matriz 3×3 proyectiva, resuelta por mínimos cuadrados — DLT, "Direct Linear Transform", viable en JS puro sin librería de CV pesada) que rectifica la foto a vista cenital ANTES de calibrar la escala |
| **Plano con perspectiva** | Mismo que fotografía — es la misma causa | Mismo procedimiento: homografía de 4 puntos antes de calibrar |
| **Escaneo deformado — leve** (sesgo/estiramiento en un eje, común en escáneres baratos) | Un escalar isotrópico (mismo factor en X e Y) puede quedar mal si el escaneo estiró más un eje que el otro | Calibración **anisotrópica**: dos distancias de referencia, una horizontal y una vertical (o 3 puntos en "L"), calculando `escalaX` y `escalaY` por separado — sigue siendo lineal y simple, sin homografía completa |
| **Escaneo deformado — severo** (papel arqueado, distorsión no lineal) | Ninguna transformación lineal (ni homografía) lo corrige bien | **Fuera de alcance**, a propósito — mismo criterio que software profesional: ningún CAD "arregla" un escaneo muy deformado, se pide volver a escanear plano. Se deja anotado que, si alguna vez hiciera falta, la solución es una corrección no lineal tipo *thin-plate-spline* con muchos puntos de control — no se construye sin un caso real que lo necesite |

---

## 6. Integración con lo que ya existe (sin romper la regla de oro)

- `PlanoMediator` es un mediador de dominio más, mismo nivel que
  `TableroMediator`/`OrigenMediator` — se registra en
  `core/mediators/index.js` y en `ApplicationMediator` igual que los
  demás (ver §3 de `ARCHITECTURE.md`).
- El **motor eléctrico nunca importa nada de `modules/plano/` ni de
  `modules/geometria/`** — la única vía permitida es que la capa de
  aplicación (hook/UI) lea un área ya calculada (`PlanoMediator.
  areaDeHabitacion(id)`, en m², un número plano) y la use como
  **sugerencia** al completar el formulario de un circuito/equipo —
  igual que cualquier otro dato que hoy completa un formulario, nunca
  una llamada directa Motor↔Plano (mismo principio que ya prohíbe
  Documento/Diagrama → Motor directo, `ARCHITECTURE.md` §11).
- Qué norma dice cuántos puntos de luz por m² (NEC/CIEN/REBT) **no se
  inventa ahora** — es investigación aparte, con fuente real verificada,
  el día que se construya esa sugerencia automática. Se deja marcado
  como pendiente explícito, no como implementado.

---

## 7. Arquitectura escalable — de "plano de paredes" a CAD/BIM liviano

### La idea central: un núcleo geométrico compartido + capas por dominio

Esto es exactamente el patrón que ya usan QGIS (un sistema de referencia
de coordenadas, muchas "capas" temáticas — calles, edificios, parcelas —
todas georreferenciadas de forma consistente) y AutoCAD (un único
"espacio modelo" en unidades reales, organizado en "layers" con distinto
estilo, consumidos distinto según el tipo de objeto). Y, de hecho, **ya
es el mismo patrón que esta app usa hoy para el diagrama unifilar**
(`nodosDiagrama` + `conexionesDiagrama`, un grafo de nodos y conexiones)
— lo único que cambia acá es que el grafo vive en **coordenadas reales
(metros)** en vez de coordenadas abstractas de lienzo. No es un
paradigma nuevo para este proyecto, es extender uno que ya existe y ya
está probado.

```
┌─────────────────────────────────────────────────────────────────┐
│               modules/geometria/  (núcleo COMPARTIDO, puro)       │
│  Punto, Segmento, Polígono, Grafo(nodos, aristas)                  │
│  distancia() · areaPoligono() [shoelace] · perimetro()            │
│  interseccionSegmentos() · cicloCerrado() [detecta polígonos      │
│  cerrados en el grafo] · puntoEnPoligono()                         │
└───────┬──────────────┬──────────────┬──────────────┬─────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
 ┌────────────┐ ┌─────────────┐ ┌────────────┐ ┌──────────────────┐
 │ plano       │ │ tuberias/   │ │ bandejas/  │ │ rutasConductores/ │
 │ arquitec-   │ │             │ │            │ │                    │
 │ tónico/     │ │ segmento:   │ │ segmento:  │ │ segmento: desde→   │
 │             │ │ diámetro,   │ │ ancho,     │ │ hasta, calibre,     │
 │ pared:      │ │ material    │ │ alto,      │ │ % de ocupación de  │
 │ espesor,    │ │             │ │ %ocupación │ │ la canalización    │
 │ tipo        │ │             │ │            │ │ (ya existe el      │
 │             │ │             │ │            │ │ concepto en Motor) │
 │ habitación: │ │             │ │            │ │                    │
 │ nombre,     │ │             │ │            │ │                    │
 │ áreaM2      │ │             │ │            │ │                    │
 │ (derivada)  │ │             │ │            │ │                    │
 └────────────┘ └─────────────┘ └────────────┘ └──────────────────┘
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                              │
                   cada uno con su propio Mediator
             (PlanoArquitectonicoMediator, TuberiasMediator...)
             — mismo patrón que TableroMediator/OrigenMediator hoy
```

### Estructuras de datos recomendadas

```js
// modules/geometria/ — compartido, reutilizado por TODOS los dominios
Punto   = { x: number, y: number }                         // metros
Nodo    = { id, punto: Punto }                              // vértice del grafo
Segmento = {                                                 // arista del grafo
  id, nodoAId, nodoBId,
  tipo: "pared" | "tuberia" | "bandeja" | "conductor",
  atributos: {...}                                          // específico del dominio
}
Poligono = { id, nodoIds: [...] }                            // DERIVADO del grafo
                                                               // (ciclos cerrados) —
                                                               // NUNCA se guarda una
                                                               // segunda copia a mano,
                                                               // mismo criterio anti-
                                                               // doble-escritura que
                                                               // circuitosDeTablero()
Capa    = { id, nombre, tipo, visible, elementoIds: [...] }  // para activar/ocultar
                                                               // esquemas unifilares /
                                                               // plano arquitectónico /
                                                               // tuberías por separado,
                                                               // mismo concepto que
                                                               // "layers" de AutoCAD/QGIS
```

Por qué FK (`nodoAId`/`nodoBId`), no coordenadas duplicadas en cada
segmento: dos paredes que comparten una esquina comparten el MISMO
nodo — mover ese nodo mueve ambas paredes a la vez, y la detección de
polígonos cerrados (una habitación) es simplemente "encontrar ciclos en
el grafo", un problema de grafos estándar (DFS/BFS marcando visitados),
no una heurística geométrica aparte. Mismo principio de "FK, no copia"
que ya rige `circuito.tableroId` en el resto de la app.

### Detección de intersecciones

- **v1 (tamaño real de un proyecto residencial/comercial — decenas a
  pocos cientos de segmentos):** fuerza bruta O(n²), par por par, con
  el test estándar de orientación (producto cruzado) + chequeo de
  bounding box antes de la prueba completa — rápido de sobra a esta
  escala, y es literalmente lo que hace cualquier editor CAD simple.
- **Escalado futuro (miles de segmentos, instalaciones industriales
  grandes):** *sweep-line* (Bentley–Ottmann, `O((n+k) log n)`) — el
  mismo algoritmo que usan motores de topología tipo PostGIS/QGIS por
  debajo. Se anota como ruta de escalado conocida, no se construye
  hasta que haga falta.

### Longitudes, áreas y perímetros

- **Longitud de segmento:** distancia euclidiana, ya en metros.
- **Área/perímetro de polígono:** fórmula del "shoelace" (suma de
  productos cruzados de vértices consecutivos ÷ 2) — `O(n)`, numéricamente
  estable, es el estándar de la industria (así lo calcula internamente
  cualquier GIS).

### Dimensionamiento automático

Una vez que un polígono (habitación) tiene su `areaM2` (dato puro,
independiente de dispositivo, igual que todo lo demás), ese número se
ofrece como **sugerencia** al formulario de circuito/equipo vía
mediador — nunca escribe directo. Qué regla normativa exacta de
"VA/m²" o "puntos de luz por m²" aplica cada normativa (NEC/CIEN/REBT)
es investigación futura con fuente verificada — no se inventa ahora,
se deja marcado como pendiente explícito.

### Exportación CAD/BIM

Porque el modelo es geometría pura en metros reales, sin ningún
acoplamiento a dispositivo/render, exportar es "solo" un **serializador**
que recorre el mismo grafo y emite otro formato de texto:

- **DXF** (formato de intercambio de AutoCAD, texto plano, bien
  documentado): factible escribir un serializador mínimo en JS puro
  para líneas/polilíneas/texto, sin librería pesada.
- **IFC** (BIM): spec mucho más grande — exportación real de BIM queda
  fuera de alcance hasta que un proyecto real lo pida, mismo criterio
  que el resto de esta app con features "sin datos todavía para
  desarrollarlo".

Ninguno de los dos requiere tocar el motor geométrico, el de
renderizado ni el eléctrico — son consumidores nuevos del mismo modelo,
exactamente el punto de tener la separación limpia.

---

## 8. Por qué esto garantiza el mismo resultado en cualquier dispositivo — síntesis

Todo el pipeline de cálculo (geometría + motor eléctrico) es una
**función pura del JSON persistido**: metros, escalares, estructura de
grafo. Cero entradas de `window`, `devicePixelRatio`, tamaño de
`<canvas>` o cualquier estado de navegador/SO. Es el mismo principio
que esta app ya aplica en todos lados (los mediadores y módulos puros
nunca leen del DOM para calcular) extendido al dominio geométrico — no
es una excepción nueva, es la misma regla de oro de `ARCHITECTURE.md`
§1 aplicada acá.

---

## 9. Qué queda pendiente, a propósito (no se construye en esta ronda)

- Extracción automática de paths vectoriales de un PDF CAD.
- Detección automática de paredes/esquinas por visión por computadora
  (acordado explícitamente con el usuario: v1 es calibración + trazado
  MANUAL).
- Homografía de 4 puntos para fotos con perspectiva (v1 solo avisa del
  error, no corrige).
- Corrección no lineal (thin-plate-spline) para escaneos muy deformados.
- Regla normativa de "puntos de luz por m²" para sugerencia automática
  de dimensionamiento (necesita su propia investigación con fuente real).
- Exportación DXF/IFC.
