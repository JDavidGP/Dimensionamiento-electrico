# ⚡ DEC — Dimensionamiento Eléctrico Completo

Aplicación web para **calcular y dimensionar instalaciones eléctricas de baja tensión** según distintas normativas, pensada para técnicos e instaladores electricistas.

> **Estado:** en desarrollo activo · versión 0.5  
> **Autor:** Josué David Gibson Pérez, técnico electricista y técnico en energías renovables (Nicaragua)

---

## Qué hace

- **Modelo de proyecto completo:** Proyecto → Tableros → Circuitos → Equipos, con integridad referencial entre tableros padre e hijo.
- **Cálculo de corriente** monofásica, bifásica y trifásica.
- **Factor de demanda normativo:** alumbrado, pequeños electrodomésticos y motores con la regla del 125 % del motor mayor. El factor de simultaneidad se muestra solo como dato informativo; el dimensionamiento siempre parte de la demanda normativa.
- **Selección de sección del conductor y del interruptor automático (breaker)** según las tablas de cada normativa.
- **Corrección por temperatura** y **ocupación de canalizaciones**.
- **Caída de tensión por circuito y acumulada** a lo largo de la cadena de tableros. Se acumula en voltios e incluye detección de ciclos, tramos sin datos marcados como "no determinado" y propagación explícita de errores.
- **Balance de fases** con umbral de desbalance configurable (10 % por defecto) y advertencia.
- **Cortocircuito** y cálculo de **alimentadores**.
- **Validación en dos fases:**
  1. Referencial: IDs huérfanos, referencias rotas, duplicados.
  2. Eléctrica, bajo demanda: breaker frente a corriente de diseño, caída de tensión y advertencias del motor de cálculo.
- **Guardado y apertura de proyectos** en formato JSON.

## Normativas soportadas

| Normativa | Detalle |
|-----------|---------|
| **NEC** (EE. UU.) | Tabla 310.16 a 60 °C, reglas de demanda del Art. 220 y del Art. 430.24 |
| **CIEN** (Nicaragua) | Basada en NEC, con los tamaños de breaker del Art. 240-6 |
| **IEC 60364-5-52 — España (REBT)** | UNE-HD 60364-5-52, tensiones de 230/400 V, breakers IEC 60898 y límite de caída de tensión del 3 % |

Cada normativa es un módulo independiente (`src/modules/normativa/`) que se registra en un catálogo y se valida al arrancar contra un **contrato de campos obligatorios**. Para añadir una normativa nueva no hay que modificar el motor de cálculo.

## Arquitectura

- **React 18 + Vite**, JavaScript modular.
- **Patrón Mediator:** un `ApplicationMediator` orquesta mediadores de dominio. Los módulos no se conocen entre sí.
- **Una sola fuente de verdad** del proyecto. El motor y la normativa solo leen; las escrituras pasan por la capa de aplicación.
- **Servicios compartidos:** DataProvider, Repository, Cache, Logger y Config.
- Persistencia mediante **adapters** (JSON hoy; SQLite o importación PDF en el futuro).

```
UI ─► ApplicationMediator
        ├─ MotorCalculoMediator ─► NormativaMediator (solo parámetros)
        ├─ ValidacionMediator   ─► resultados ya calculados
        ├─ TableroMediator      ─► jerarquía de tableros
        ├─ PersistenciaMediator ─► adapters (JSON)
        ├─ DocumentoMediator    ─► memoria técnica (en desarrollo)
        └─ DiagramaMediator     ─► diagrama unifilar (en desarrollo)
```

El contrato de arquitectura completo está en [`ARCHITECTURE.md`](./ARCHITECTURE.md).

### Estructura

```
src/
  core/          ApplicationMediator, mediadores de dominio y servicios
  modules/
    motor/       corriente, sección, breaker, caída de tensión, demanda,
                 cortocircuito, balance de fases, canalización, alimentador
    normativa/   NEC, CIEN, IEC (España)
    validacion/  formularios, referencial, eléctrica
    tablero/  origen/  persistencia/  documento/  diagrama/
  shared/        tablas de datos, constantes y utilidades (conversiones AWG ↔ mm²)
  components/    interfaz de usuario
  hooks/         estado de React
```

## Ejecutar en local

Requisitos: Node.js 18 o superior.

```bash
npm install
npm run dev
```

## Hoja de ruta

- [x] Entidades base y motor de normativas (NEC / CIEN / IEC-España)
- [x] Motor de cálculo: corriente, sección, breaker, caída de tensión y demanda
- [x] Tableros jerárquicos, caída de tensión acumulada y balance de fases
- [x] Validación referencial y eléctrica
- [x] Factores de simultaneidad del REBT (ITC-BT-10) a nivel de tablero/acometida — Tabla 1 (coeficiente según N° de viviendas) verificada contra el texto oficial y la Guía-BT-10 del ministerio (dos fuentes coincidentes). Un tablero puede marcarse "edificio de viviendas REBT": sus tableros hijos directos se tratan como viviendas (cada uno gestiona sus propios circuitos igual que siempre) y la demanda se calcula con la media de potencias previstas × el coeficiente, en vez de sumarlas al 100% — afecta el dimensionamiento real del alimentador (calibre, breaker, caída de tensión). Grado de electrificación básica/elevada (5750W/9200W, verificados) como respaldo cuando una vivienda todavía no tiene circuitos cargados. Visible solo bajo normativa IEC_ES (REBT) — locales comerciales/garajes/servicios generales siguen sumándose al 100% sin cambios, que ya es lo correcto según ITC-BT-10 para esos casos
- [x] Diagrama unifilar sincronizado con la tabla — Fase 1 (modelo de datos), Fase 2 (motor de reglas eléctricas), Fase 3 (editor mínimo: agregar/mover/conectar/eliminar nodos, los 25 símbolos del catálogo dibujados a mano), sincronización tabla→diagrama (vincular un nodo a su entidad real, 1 a 1, nombre vivo, desvínculo automático si la entidad se borra) y el caso inverso diagrama→tabla para tablero/equipo/fuenteEnergia (sin nodo que lo represente se marca como advertencia en listaIntegridad, visible en Tableros/TablaResultados) listas, sin cálculos todavía; faltan símbolos normalizados IEC 60617 (los actuales son equivalentes simplificados propios), autoorganización y zoom/pan
- [x] Lista propia de fuentes de energía (PanelFuentesEnergia.jsx) con CRUD completo (crear/editar/eliminar, antes solo se podían crear) — tarjetas con el mismo patrón de acordeón que los tableros, mostrando la advertencia del caso inverso
- [x] Memoria técnica / informe en PDF — 5ta pestaña "Informe técnico" (vista imprimible + "Guardar como PDF" del navegador, sin librería nueva: la app no manda nada a ningún servidor ni carga nada externo). v1: encabezado del proyecto, tabla de circuitos calculados, resumen de tableros/alimentadores (incluye la carga REBT cuando aplica), fuentes de energía/transformadores, advertencias de integridad y aviso de responsabilidad. El diagrama unifilar como imagen embebida queda para una próxima ronda, a propósito
- [x] Sistema de etiquetado — código corto (ej. "TD1", "TD1-C3", "TD1-C3-E1") + función descriptiva para tablero/circuito/equipo, autosugerido con jerarquía al crear uno nuevo (nunca forzado, siempre editable), y una 6ta pestaña "Directorio" con el listado consolidado de todo el proyecto, buscable por etiqueta/nombre/función y filtrable por tipo. Primera ronda del pedido más grande del usuario ("Sistema de etiquetado y planos") — el plano inteligente (calibración de escala + trazado manual de paredes) queda para la próxima ronda
- [x] Plano inteligente — Fase 1: calibración de escala + trazado manual de paredes. Arquitectura diseñada primero, por escrito (`PLANO_INTELIGENTE_DISENO.md`, a pedido del usuario), respondiendo si calibrar en un dispositivo afecta los cálculos en otro — NO, porque se separan 3 espacios de coordenadas (modelo en metros, persistido / imagen en píxeles del archivo / pantalla en CSS pixels efímeros, nunca persistida) y todo cálculo vive solo en el espacio modelo. 7ma pestaña "Plano": cargar una imagen, calibrar con 2 puntos + una distancia real conocida, trazar paredes a click (con "pegado" automático a nodos cercanos para cerrar polígonos), y cerrar un trazo sobre su propio punto de inicio calcula área/perímetro al instante (fórmula del shoelace, `modules/geometria/` — núcleo compartido, reutilizable por futuros dominios: tuberías, bandejas, rutas de conductores). Zoom/pan de la vista son puramente de presentación, nunca tocan la medida — probado explícitamente: zoom in/out repetido no cambia la calibración mostrada, y guardar + reabrir el proyecto reproduce el área/perímetro de forma idéntica
- [x] Plano inteligente — Fase 2 (primera ronda): soporte de PDF (cualquier PDF se renderiza vía `pdfjs-dist`, import dinámico para no engordar la carga inicial de quien nunca sube uno, a 150 DPI de referencia — constante fija, no depende del dispositivo — y de ahí en más sigue el mismo flujo que una imagen) y asistencia de bordes al trazar paredes (`modules/plano/deteccionBordes.js`: detector de bordes Sobel liviano sobre un parche chico de la imagen, "pega" el click al filo más fuerte cercano — toggle, activo por defecto). Evaluado y decidido explícitamente NO construir en esta ronda: detección 100% automática de paredes con un pipeline de visión por computadora (OpenCV.js) — demasiado grande/incierto en planos reales sin un modelo entrenado, la asistencia de bordes da buena parte del valor con mucho menos riesgo — y extracción de paths vectoriales de PDF CAD como candidatos de pared, para una ronda aparte
- [x] Plano inteligente — Fase 2 (segunda ronda): corrección de perspectiva para fotos (4 puntos sobre un rectángulo real conocido → homografía por DLT, álgebra lineal pura sin librería de CV → la imagen completa se endereza y queda autocalibrada, sin repetir la calibración manual) y exportación a DXF (el grafo de paredes/ambientes, ya en metros, se serializa a DXF R12 — compatible con AutoCAD/LibreCAD/QCAD). Probado con un cuadrilátero genuinamente distorsionado: el área/perímetro trazados sobre la imagen ya corregida dan la medida real esperada, no solo "se ve derecho". Bug real encontrado y corregido validando el DXF exportado con `ezdxf` (parser real, no solo mirar el texto): los acentos salían corruptos por una codificación UTF-8 donde DXF R12 espera Windows-1252 — corregido con un conversor de bytes dedicado (ver el documento de diseño, §9-11)
- [x] Plano inteligente — Fase 2 (tercera ronda): rutas de conductor y ubicación de equipos sobre el plano, pedido explícito del usuario tras confirmar que el trazado de paredes ya sirve para segmentar cualquier área (incluido un deslinde de terreno, no solo cuartos). Un conductor se traza con el mismo mecanismo de "pegado" que una pared (mismo grafo, un `tipo` de segmento distinto, línea punteada color cobre), pero abierto — se termina con un botón en vez de cerrarse solo — y su longitud real se deriva automáticamente (`longitudPolilinea()`, nueva en `modules/geometria/`). Un equipo se marca con un punto independiente del grafo (reutiliza el MISMO catálogo de símbolos que el diagrama unifilar, `bibliotecaComponentes.js`) y se puede vincular opcionalmente a un tablero/circuito/equipo/fuente/transformador YA existente — mismo patrón de vínculo que el diagrama unifilar, pero con su propia lista de exclusión: una entidad puede estar vinculada a la vez a un nodo del diagrama (su topología eléctrica) y a un marcador del plano (su ubicación física), no es "usarla dos veces". Probado end-to-end con Playwright: longitud de una ruta en L contra su valor real conocido, vínculo a un tablero real, persistencia idéntica tras guardar y reabrir el proyecto. Deliberadamente afuera de esta ronda (ver `PLANO_INTELIGENTE_DISENO.md` §12): pegar una ruta a la posición exacta de un equipo, autocompletar la distancia del circuito/alimentador desde la longitud trazada, capas con toggle de visibilidad
- [x] Directorio — convertido de tabla de solo lectura a árbol plegable y editable, pedido explícito del usuario tras preguntarle su opinión sobre unir Diagrama unifilar y Plano en un mismo apartado (se le dio la recomendación de hacerlo por etapas: Directorio editable primero, generador de polígono por dimensión después, y dejar la fusión del lienzo diagrama/plano y la creación masiva de equipos por texto para otra ronda — el usuario aceptó ese orden). Ahora es el punto único para editar nombre/etiqueta/función de tableros/circuitos/equipos (anidados tablero→circuito→equipo), el nombre de los nodos del diagrama unifilar y el nombre/vínculo de ambientes/rutas de conductor/equipos marcados en el plano — sin ir a buscarlos a su propia pestaña. Reutiliza las MISMAS funciones de edición/eliminación que ya usa cada pestaña (ninguna lógica duplicada); los únicos 2 agregados reales son `editarEtiquetaFuncionCircuito`/`Equipo` (patch liviano de 3 campos de presentación, sin pasar por la validación eléctrica completa). Secciones plegables (tableros/circuitos/equipos, diagrama, plano con sus 3 sub-listas), búsqueda que mantiene visibles los ancestros de una coincidencia, y edición 100% inline (sin un formulario aparte)
- [x] Generador de ambiente por dimensión conocida — modo "Generar ambiente": nombre + ancho×alto (m) ya conocidos + un click en el plano (define el centro) arma un rectángulo de ESE tamaño exacto (4 nodos + 4 paredes + la habitación, reutilizando las mismas fábricas que el trazado manual — se puede seguir editando igual). Nuevo modo "Mover ambiente" para arrastrar cualquier ambiente (generado o trazado a mano) y reposicionarlo — el área/perímetro quedan matemáticamente idénticos (traslación rígida), probado explícitamente. Se descartó a propósito un "chat" con IA real para esto (se le preguntó al usuario, que aceptó la recomendación): un formulario chico y determinístico da el mismo resultado sin mandar nada a ningún servidor ni la ambigüedad de interpretar texto libre — ver `PLANO_INTELIGENTE_DISENO.md` §13. La creación masiva de equipos por texto libre queda deliberadamente para otra ronda
- [x] Importación de equipos por texto — pegás una lista (una línea con la etiqueta de un circuito YA CREADO, ej. "TD1-C3", seguida de una línea por equipo: "cantidad nombre valorW" o "valorA") y se previsualiza línea por línea antes de importar nada. Alcance acotado a propósito (discutido con el usuario, que planteó él mismo las dificultades reales: dónde quedan los datos, a qué tablero pertenece el circuito, cómo mantener el rigor del cálculo): esto NUNCA crea tableros ni circuitos nuevos, solo equipos dentro de uno YA EXISTENTE referenciado por su etiqueta — si no existe, o si hay 2 circuitos con la misma etiqueta (ambigüedad), se rechaza esa línea en vez de adivinar. No es un camino de cálculo "inverso": cada línea pasa por la MISMA validación y fábrica que ya usa el formulario manual (`ValidacionMediator.validarFormularioEquipo`/`formularioAEquipo`), así que un equipo importado por texto es, para el motor, indistinguible de uno tipeado a mano. La previsualización importa solo las líneas válidas (una línea con error no bloquea al resto). Probado con Node puro (el parser y la resolución contra circuitos reales, incluida la detección de etiqueta ambigua) y con Playwright (importación mixta válida/inválida, verificación de que cada equipo queda anidado bajo el circuito correcto en Directorio)
- [ ] Migración progresiva a TypeScript
- [x] Tipo de instalación — ampliado a 3 niveles (Residencial básico / Residencial avanzado / Comercial-Industrial, pedido explícito del usuario tras revisar la app: "simplifica muchísimo la interfaz" ocultarle trifásico al uso típico). Residencial básico ya FILTRA: oculta el pill "Tri" en circuito/equipo Y en el alimentador del tablero (el segundo se había quedado sin aplicar, bug reportado por el usuario, ya corregido); archivos guardados con el enum viejo (domiciliaria/industrial) migran solos al cargarlos. El resto (balance de fases, Transformador, motores) sigue igual en los 3 niveles — ronda chica a propósito, ver shared/constants/constantes.js
- [x] Transformador como origen seleccionable — SOLO en instalaciones comercial/industrial (gateado por tipoInstalacion, confirmado explícitamente por el usuario que se mantiene así hasta tener datos/criterios concretos para residencial avanzado); creable inline desde el selector "Fuente de energía" de un tablero (nombre, fases, tensión primaria/secundaria), sincronizado con el diagrama unifilar igual que fuentesEnergia. Deliberadamente sin editar/eliminar ni lista propia todavía ("nos hace falta datos para desarrollar ese apartado") — y sigue pendiente, a propósito, todo lo que depende de datos reales: evaluarCaidaAcumulada asumiendo un solo nivel de tensión para toda la cadena, %Z aplicado a cortocircuito aguas abajo del transformador
- [x] Layout por pestañas tipo ViewPager2 (6 pestañas — Normativa, Tableros, Circuitos y resultados, Esquemas, Informe técnico, Directorio — en el orden en que se cargan los datos), navegación por click y por swipe táctil (solo touch, no mouse, para no chocar con el arrastre de nodos del diagrama); todos los paneles quedan montados siempre, así no se pierde el estado al cambiar de pestaña
- [x] Diagrama unifilar y Plano agrupados bajo una pestaña "Esquemas" con sub-pestañas (`SubTabs.jsx`) — pedido explícito del usuario, que planteó la idea y la discutió conmigo antes de pedirla: agruparlos visualmente SIN fusionar sus lienzos (siguen siendo dos editores con su propio modelo de datos — la separación topología eléctrica / ubicación física sigue intacta). Las sub-pestañas son deliberadamente sin gestos táctiles propios (solo click): si tuvieran su propio swipe, el toque se propagaría hacia el swipe del ViewPager2 exterior y las dos capas competirían por el mismo gesto — con solo 2 opciones alcanza con click. Mismo criterio de "todo montado siempre" que el resto de la app
- [x] Preferencia de representación por circuito ("Representar en": Diagrama y plano / Solo diagrama / Solo plano / Ninguno) — segunda parte del mismo pedido: no todo circuito necesita aparecer en los dos lados (uno reservado/sin instalar todavía puede no tener sentido en el plano; uno puramente documental puede no necesitar nodo en el diagrama). Deliberadamente PURAMENTE INFORMATIVO (acordado con el usuario): solo ajusta qué advertencias de integridad aparecen (`modules/validacion/referencial.js`, nueva advertencia simétrica "sin representar en el plano", antes solo existía la del diagrama) — nunca impide vincular un nodo o colocar un marcador igual si el usuario quiere, mismo criterio de "nunca fuerza" de toda la app. Default "ambos", así ningún proyecto guardado antes de este campo cambia de comportamiento. Probado con Node puro (las 4 combinaciones, incluido que `representacion` ausente se trata como "ambos") y con Playwright (cambiar la preferencia hace aparecer/desaparecer la advertencia correspondiente en vivo, y persiste al guardar y reabrir)
- [x] Corrección de desborde visual en "Circuitos y resultados" en pantallas angostas (reportado por el usuario con una captura desde Android/Brave): la grilla de 2 columnas no entraba en celulares (~360-400px) y se desbordaba visualmente hacia la pestaña vecina. Colapsa a 1 columna bajo 680px (causa raíz), con `overflow:hidden` como red de seguridad en la raíz de la app y en cada panel del ViewPager
- [x] Fuente de energía — rediseño completo pedido por el usuario tras probar la app, en dos rondas:
  1. "Origen" pasa a llamarse "Fuente de energía" en toda la UI (formulario de tablero, tarjeta, informe técnico); la opción por defecto ya no es un misterioso "Acometida/poste" sino "Red eléctrica local (acometida/poste)", al mismo nivel que Batería/Generador/Transformador.
  2. Los 3 roles (Principal/Secundaria/Auxiliar) se eligen JUNTOS, en el mismo formulario del tablero — no después de crearlo, como vivía antes en un bloque de "Conmutación entre fuentes" separado. Sugerencia automática (nunca forzada): si la principal es la red local, la secundaria se sugiere como la primera batería disponible (y viceversa); el generador suele quedar sugerido de auxiliar. Se agregó "Capacidad contratada (kW)" junto a la tensión y "Notas" junto a distancia/material del conductor.
  3. Se eliminó el campo `rol` fijo que tenía la entidad FuenteEnergia (el usuario detectó que entraba en conflicto con el rol real, que es por tablero: una misma fuente puede ser principal para un tablero y auxiliar para otro) — la fuente ahora solo describe qué es (nombre/tipo/capacidad/notas); el panel de administración se renombró a "Editar fuentes de energía" para distinguirlo del atajo de creación rápida dentro del formulario de tablero.
  4. Rediseño del rol como concepto GLOBAL de la instalación (usuario, 2026-11-20, con el ejemplo de 3 casas: solo red local / red local + generador / las 3 fuentes): el panel "Fuentes de energía" pasa a tener dos cuadros — arriba se declara rápido nombre + tipo + un rol de instalación (Principal/Secundaria/Auxiliar, uno por rol para TODO el proyecto, no por tablero — elegir un rol ya tomado se lo quita a quien lo tenía); abajo, tocar una fuente la expande para configurar sus características (entrada de energía prevista, distancia de conexión, material del conductor, horario de uso, notas). "Red local" (la red eléctrica pública) pasa a ser un tipo de fuente más, creable igual que batería/generador — aditivo, no migra proyectos viejos (`tableroPadreId` null sigue siendo la acometida genérica sin detalle). En instalación residencial básica esto reemplaza la selección de secundaria/auxiliar/conmutación por tablero (con el tablero típico de esa instalación alcanza con el rol global); residencial avanzada y comercial/industrial mantienen los dos niveles, porque ahí sí puede hacer falta variar la combinación según el tablero. Motor de cálculo: si un tablero no declaró su propia distancia/material de alimentador y su origen es una fuente que sí los tiene, `TableroMediator.calcularAlimentadorAgregado` los usa como respaldo (no se pide el dato dos veces en el caso común de un tablero por fuente); si el tablero declara los suyos propios —necesario cuando varios tableros cuelgan de la misma fuente con calibres distintos— esos mandan siempre. Probado con Node puro (el respaldo, incluida la prioridad de la distancia propia del tablero sobre la de la fuente) y con Playwright (declarar fuente + rol, reasignación de rol único, editar características, vincular al diagrama).
- [x] Revisión de interfaz y deuda técnica (usuario, 2026-11-20, pidiendo primero una lista de hallazgos antes de tocar nada, "empezá por lo más sencillo"): código muerto eliminado, confirmando con una búsqueda explícita de llamadores antes de borrar cada uno (`ApplicationMediator.calcularProyecto`/`integridad`, `EtiquetadoMediator.directorio` y la función `listaDirectorio` que quedaron huérfanas cuando Directorio pasó a árbol editable propio, `NormativaMediator.parametro`/`invalidateCache`, tres wrappers de `TableroMediator` cuyo equivalente real sí se usa, `DocumentoMediator.resumenCalculos`); símbolo de luminaria del diagrama unifilar rediseñado (era un círculo con una X que se confundía con un ícono de "cancelar"; ahora es un foco con filamento y base roscada, reconocible); y las pruebas de regresión que habían quedado desactualizadas por cambios de rondas anteriores (campo `rol` eliminado de FuenteEnergia, Diagrama/Plano agrupados bajo "Esquemas", etiqueta "Comercial / Industrial") corregidas contra el comportamiento real, no adivinado.

## Aviso

Esta herramienta está en desarrollo y sirve de apoyo al cálculo. No sustituye el criterio de un profesional habilitado ni la verificación según la normativa vigente en cada país. El mismo aviso se muestra dentro de la aplicación.

## Privacidad

La aplicación no pide registro, no usa cookies, analítica ni rastreo, y no carga recursos de terceros (las fuentes son del sistema). Los cálculos se hacen en el navegador y los proyectos se guardan solo como archivos JSON en el equipo del usuario.

## Licencias de terceros

- [React](https://github.com/facebook/react) y [Vite](https://github.com/vitejs/vite): licencia MIT.
- Las tablas normativas contienen valores numéricos de referencia; no se reproduce el texto de las normas. NEC® es marca registrada de la NFPA, sin relación con este proyecto.

## Licencia

© 2026 Josué David Gibson Pérez. **Todos los derechos reservados.**  
El código se publica solo para consulta. No está permitido copiarlo, modificarlo, distribuirlo ni usarlo con fines comerciales sin autorización escrita del autor.
