// Límites y factores usados en los cálculos eléctricos.
// Centralizados aquí para que un ajuste futuro (ej. al incorporar
// las tablas oficiales del CIEN) no requiera tocar la lógica de cálculo.

export const LIMITE_CAIDA_TENSION_PCT = 3.0; // % máximo de caída de tensión permitido
export const FACTOR_CARGA_CONTINUA = 1.25; // Regla del 125% para cargas continuas (>3h)

// Límite de caída de tensión ACUMULADA (alimentador + circuito derivado
// sumados). CONFIRMADO con fuente — no es una cifra sin respaldo:
//   - NEC 210.19(A) Nota informativa N.° 4 (circuito derivado): ≤3% en
//     el punto de utilización más alejado.
//   - NEC 215.2(A)(1) Nota informativa N.° 2 (alimentador): ≤3% en el
//     alimentador, y que la suma alimentador + circuito derivado no
//     supere el 5% combinado.
// Verificado por dos vías independientes: la cita que se usó para tomar
// la decisión de diseño, y una búsqueda propia posterior — ambas
// coinciden en el mismo número y la misma ubicación en el Code.
//
// IMPORTANTE — es una NOTA INFORMATIVA, no un artículo exigible: NEC §90.5
// define las notas informativas como "solo informativas, no exigibles
// como requisito". El 3%/5% es una recomendación para "eficiencia
// razonable de operación", no un límite de seguridad obligatorio como sí
// lo son la ampacidad o la capacidad de interrupción del breaker. Varias
// AHJ (jurisdicciones locales, EE.UU.) SÍ lo adoptan como exigencia vía
// enmienda propia — acá se adopta como política de diseño por defecto
// del proyecto, prudente aunque no sea obligatoria en todos lados.
//
// Sigue nombrada PROVISIONAL porque es una política DEL PROYECTO que
// podría afinarse para casos especiales (media tensión, transformadores,
// otra jurisdicción con su propio límite normativo) — NO porque la cifra
// esté sin verificar. NO reemplaza normativa.limiteCaidaTensionPct (el 3%
// por tramo individual, que sigue aplicándose sin cambios en
// seleccionarSeccion.js) — es un chequeo ADICIONAL sobre la suma de
// ambos tramos. Ver modules/motor/caidaTensionAcumulada.js.
export const LIMITE_CAIDA_TENSION_ACUMULADA_PROVISIONAL_PCT = 5.0;

// Umbral RECOMENDADO de desbalance de corriente entre líneas (L1/L2/L3)
// de un tablero. CONFIRMADO por el usuario como valor por defecto del
// proyecto (10%) — a diferencia de LIMITE_CAIDA_TENSION_ACUMULADA_
// PROVISIONAL_PCT (que tiene cita NEC exacta), este número NO tiene
// artículo del NEC que lo fije: el NEC 210.11(B) exige repartir las
// cargas entre líneas pero no fija un %. El 10-20% que circula en la
// práctica de la industria viene de IEEE Std 141 (Red Book) y de
// normas NEMA para motores (NEMA MG-1: un desbalance de TENSIÓN de 1%
// ya empieza a deratear un motor trifásico — a 5% la capacidad cae a
// ~75%, y no se recomienda operar por encima de ese punto). 10% es el
// extremo más conservador de esa práctica citada.
//
// MODIFICABLE en runtime — Config.limites.desbalanceFasesPct (ver
// core/services/Config.js) empieza igual a este valor pero se puede
// sobrescribir por proyecto. balanceFases() (modules/motor) genera una
// ADVERTENCIA SERIA cuando el umbral efectivamente usado supera este
// valor recomendado — subir el margen no es gratis: más desbalance de
// corriente sostenido calienta el neutro en circuitos multialambre por
// encima de lo esperado, envejece el aislamiento más rápido, y un
// desbalance de tensión asociado empuja a deratear motores (NEMA MG-1)
// o directamente a no operarlos con seguridad por encima de 5%.
export const UMBRAL_DESBALANCE_FASES_PCT = 10.0;

export const MIN_COSPHI = 0.5;
export const MAX_COSPHI = 1.0;

export const MIN_TEMP_C = -10;
export const MAX_TEMP_C = 60;

// Tipo de instalación — 3 niveles, elegidos junto con la normativa
// (ver SelectorNormativa.jsx). Declarado como constante por el mismo
// motivo que TIPOS_ORIGEN/TIPOS_EQUIPO_ESPECIAL: comparar contra estos
// valores, no contra literales sueltos.
//
// AMPLIADO de 2 a 3 niveles (usuario, 2026-11-19 — "dividiría el tipo
// de proyecto desde el inicio... esto simplifica muchísimo la
// interfaz"): el eje RESIDENCIAL_BASICO vs. RESIDENCIAL_AVANZADO es
// una decisión de PRODUCTO/UX (progressive disclosure — ocultarle
// trifásico al ~95% de usuarios que diseña viviendas simples, sin
// limitar al profesional que sí lo necesita), NO una distinción
// normativa — no tiene cita NEC/REBT propia, a diferencia del eje
// RESIDENCIAL vs. COMERCIAL_INDUSTRIAL (ese sí respaldado por la
// investigación de abajo: el umbral de 20 kW del REBT y el concepto de
// "supervised industrial installation" del NEC).
//
//   - RESIDENCIAL_BASICO: mono/bifásico únicamente — sin trifásico
//     (FormularioCircuito.jsx oculta el pill "Tri"). Valor por defecto.
//   - RESIDENCIAL_AVANZADO: habilita trifásico (vivienda grande,
//     bomba/aire acondicionado trifásico, etc.) sin pasar todavía a
//     las herramientas de instalación comercial/industrial (balance de
//     fases avanzado, motores de potencia media/alta) — esas siguen
//     siendo las mismas para los 3 niveles por ahora, ESTE primer paso
//     solo toca el filtro de fases en circuito/equipo (pedido explícito
//     del usuario: "primera ronda chica").
//   - COMERCIAL_INDUSTRIAL: todo visible desde el principio (trifásico,
//     balance de fases, Transformador como origen — ver PanelTableros.jsx).
//
// Migración de archivos guardados con el enum viejo (2 valores):
// "domiciliaria" → RESIDENCIAL_BASICO, "industrial" → COMERCIAL_INDUSTRIAL
// (ver modules/persistencia/proyecto.js, deserializarProyecto).
export const TIPOS_INSTALACION = {
  RESIDENCIAL_BASICO: "residencial_basico",
  RESIDENCIAL_AVANZADO: "residencial_avanzado",
  COMERCIAL_INDUSTRIAL: "comercial_industrial",
};
export const TIPO_INSTALACION_POR_DEFECTO = TIPOS_INSTALACION.RESIDENCIAL_BASICO;

// INVESTIGACIÓN — qué distingue a una instalación industrial en NEC y
// REBT (pedida por el usuario, 2026-11-19, para decidir CON QUÉ
// CRITERIO el tipo de instalación debería filtrar/agregar equipos y
// tablas más adelante — todavía no implementado). Reunido vía
// WebSearch, dos rondas (una inicial de memoria, luego corregida con
// búsqueda real al notar que no se había verificado todavía — NO
// reemplaza el texto oficial de cada norma, que sigue sin consultarse
// directamente en esta sesión).
//
// NEC (NFPA 70) — no define "instalación industrial" como una
// categoría única y cerrada; el criterio real está repartido en
// varios artículos que SÍ distinguen explícitamente por tipo de
// ocupación/supervisión:
//   - Art. 240.2 define el término "supervised industrial
//     installation/location" — confirmado que existe como término
//     definido (no solo de uso coloquial), usado en la Parte de
//     Art. 240 dedicada a "Supervised Industrial Installations"
//     (protección contra sobrecorriente, ≤1000V AC / 1500V DC): una
//     instalación industrial con mantenimiento y supervisión que
//     garantiza que solo personal calificado la monitorea/da servicio
//     habilita criterios de protección distintos a los de una
//     instalación sin esa supervisión. Mismo concepto de "ubicación
//     supervisada" se repite en Art. 450 (transformadores). ESTE es el
//     punto donde el NEC traza una línea explícita industrial/no
//     industrial — condicionada a la SUPERVISIÓN CALIFICADA, no solo
//     al tipo de edificio. (No se confirmó el texto exacto de 240.92
//     contra el código — pendiente de acceso directo a NFPA 70.)
//   - Art. 110.26: el espacio de trabajo libre frente a equipos
//     eléctricos tiene condiciones distintas (Condición 1/2/3) según
//     el voltaje y la disposición de partes energizadas — típico de
//     cuartos eléctricos industriales, aunque el artículo no usa la
//     palabra "industrial" como condición en sí.
//   - Art. 409 (tableros de control industrial) y Art. 430 (motores):
//     reglas de protección/arranque que en la práctica casi solo
//     aparecen en instalaciones industriales por la escala de los
//     motores involucrados.
//   - Art. 695 (bombas contra incendio) y Arts. 500-516 (ubicaciones
//     peligrosas: polvo, vapores inflamables): mucho más comunes en
//     plantas industriales, aunque no exclusivos de ellas.
//   - Art. 220 (cálculo de demanda): no tiene una tabla "industrial"
//     separada de la residencial — el criterio ahí es el tipo de
//     ocupación/uso real de la carga, no una etiqueta "industrial".
//
// REBT (España, RD 842/2002 + ITC-BT) — a diferencia del NEC, sí tiene
// un criterio administrativo explícito y más nítido, aunque no es
// exactamente "domiciliaria vs industrial" sino "qué documentación
// exige la instalación":
//   - ITC-BT-04, Grupo a) "Industrias en general": PROYECTO (firmado
//     por técnico competente) obligatorio si la potencia instalada
//     P > 20 kW. Por debajo de eso (y hasta 100 kW) alcanza con una
//     MEMORIA TÉCNICA DE DISEÑO (formato oficial, varía por comunidad
//     autónoma). CORRECCIÓN sobre mi primera pasada (sin verificar):
//     había asumido 100 kW como umbral de Proyecto por recuerdo
//     propio — está mal. El 100 kW real corresponde a un umbral
//     DISTINTO: INSPECCIÓN INICIAL obligatoria por Organismo de
//     Control, no al umbral de Proyecto (que es 20 kW). Dos fuentes
//     independientes (Iberley y PLC Madrid) coinciden en el 20 kW
//     para Proyecto; un tercer documento (TFG académico) usaba mal el
//     100 kW para esto, lo cual expuso el error.
//   - ITC-BT-47 (motores): reglas específicas de protección y
//     arranque para motores, con umbrales de potencia distintos para
//     vivienda vs. otros usos.
//   - ITC-BT-48 (transformadores) e ITC-BT-18 (puesta a tierra):
//     exigencias que en la práctica solo se activan a la escala de una
//     instalación industrial o de gran consumo.
//   - La distinción vivienda/local comercial/industrial también
//     aparece en el cálculo de previsión de cargas (ITC-BT-10, grados
//     de electrificación, con sus propios factores de simultaneidad)
//     — ya anotado como pendiente aparte en la hoja de ruta
//     ("Factores de simultaneidad del REBT a nivel de
//     tablero/acometida").
//
// CONCLUSIÓN PRELIMINAR (para la próxima sesión que retome esto): el
// eje común entre ambas normativas NO es "residencial vs. fábrica"
// como categoría binaria simple, sino: (a) la ESCALA de potencia (el
// REBT sí tiene un número concreto: 20 kW), (b) si hay personal
// calificado supervisando la instalación (el eje real del NEC), y
// (c) el tipo de carga real conectada (motores, ubicaciones
// peligrosas). El selector de tipo de instalación de la UI
// probablemente deba traducirse a estos criterios concretos al
// filtrar más equipos/tablas (balance de fases avanzado, motores de
// potencia media/alta — ver la nota arriba de TIPOS_INSTALACION), no
// tratarse como una etiqueta decorativa. Primer paso ya dado (2026-11-19):
// RESIDENCIAL_BASICO oculta el pill "Tri" en circuito/equipo — el
// resto (balance de fases, Transformador, motores) sigue pendiente de
// diferenciarse entre RESIDENCIAL_AVANZADO y COMERCIAL_INDUSTRIAL.
// Esto sigue sin ser una cita verificada palabra por palabra contra el
// texto oficial (pendiente real: acceso directo a NFPA 70 y al BOE del
// REBT) — es la mejor síntesis posible vía búsqueda web, ya con una
// corrección propia de por medio, para orientar el diseño. Fuentes
// consultadas (2026-11-19): Mike Holt Forums e NFPA public-input docs
// para 240.2; Iberley, PLC Madrid y un TFG de la Universidad de
// Zaragoza para ITC-BT-04.
