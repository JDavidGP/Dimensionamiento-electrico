# Arquitectura modular basada en mediadores

Contrato de equipo para Dimensionamiento Eléctrico Completo (DEC).  
Basado en la propuesta de mediadores, con correcciones de dependencias,
fuente de verdad y límites de responsabilidad.

---

## 1. Principios

1. **Los módulos NO se conocen entre sí.**
2. **La comunicación entre módulos distintos pasa por un Mediator.**
3. **Dentro del mismo módulo** las funciones pueden llamarse directamente.
4. **Datos compartidos** se obtienen mediante DataProvider / Repository.
5. **Una sola fuente de verdad del proyecto** (modelo canónico).
6. **Mutaciones del proyecto** solo desde la capa de aplicación
   (hook + ApplicationMediator / casos de uso). Motor y Normativa son
   de **solo lectura** respecto al modelo.
7. **Eventos** solo para notificaciones (UI), nunca para cálculos críticos
   ni para pedir un resultado síncrono de negocio.

### Regla de oro

| Mecanismo | Uso |
|-----------|-----|
| Llamadas directas | Solo dentro del mismo módulo |
| Mediator | Entre módulos distintos |
| Repository / DataProvider | Compartir datos (lectura) |
| Eventos | Notificaciones (“guardado”, “normativa cambiada”), no cálculos |

---

## 2. Mapa de componentes

```
UI (components + hooks)
        │
        ▼
ApplicationMediator              ← orquestador de flujos (no “dios” con lógica)
        │
        ├── MotorCalculoMediator  → modules/motor/*
        ├── NormativaMediator     → modules/normativa/*
        ├── ValidacionMediator    → modules/validacion/*
        ├── PersistenciaMediator  → modules/persistencia/*  (+ adapters)
        ├── DocumentoMediator     → modules/documento/*     (stub → PDF)
        └── DiagramaMediator      → modules/diagrama/*      (stub → unifilar)

Servicios compartidos (core/services)
  DataProvider · Repository · Cache · Logger · Config

Infra compartida (shared/)
  data/ (tablas estáticas) · utils/ · constants/
  UnitConversion (conversiones AWG↔mm², etc. — NO viven en Normativa)
```

---

## 3. ApplicationMediator

**Rol:** coordinar flujos de aplicación. No acumular reglas de negocio.

**Orquesta, no implementa:**

- Calcular proyecto completo
- Validar integridad
- Guardar / abrir / nuevo proyecto
- (Futuro) generar informe, sincronizar diagrama

**Exposición:**

- La UI **no** importa mediadores de dominio en paralelo.
- Todo pasa por `ApplicationMediator` (o por el hook que lo encapsula).

**Prohibido:**

- Lógica de dimensionamiento, tablas NEC/IEC o SQL dentro de ApplicationMediator.
- Convertirse en un “God Object” que conoce el detalle de cada módulo.

---

## 4. MotorCalculoMediator

**Responsabilidad:** coordinar cálculos eléctricos.

### Módulos internos (llamadas directas entre ellos)

| Módulo | Notas |
|--------|--------|
| Factor de demanda | Dimensiona; no es informativo |
| Factor de simultaneidad | Solo informativo / uso estimado |
| Continuidad (1.25) | Por equipo, antes de agrupar |
| Corriente | Ley de potencia / √3 |
| Caída de tensión | Sobre corriente de **diseño** (demanda) |
| Dimensionamiento (calibre + breaker) | Sobre demanda normativa |
| Corrección por temperatura | Parámetro de normativa + motor |
| Corrección por agrupamiento | Cuando exista dato de canalización |
| Cortocircuito | Trifásico / monofásico |
| Impedancia de lazo | **Condicionado a topología / tablero** |
| Balance de cargas / fases | **Condicionado a entidad Tablero** |

Capacidades ligadas a entidades que **aún no existen** (Tablero, alimentador)
se documentan como *pendientes*; no se implementan “a nivel de un solo circuito”
de forma engañosa.

### Dependencias permitidas

- DataProvider (lectura de circuitos / equipos)
- NormativaMediator (**solo** para consultar parámetros ya resueltos)
- Funciones internas del mismo motor

### Prohibido depender de

- UI
- ValidacionMediator (el motor no pregunta “¿estoy válido?”)
- DocumentoMediator / DiagramaMediator
- PersistenciaMediator

### Inyección de normativa

El motor **no** importa el catálogo `NEC` / `CIEN` / `IEC` por ID.

```
MotorCalculoMediator.calcularCircuito(circuito, equipos, normativaId)
  → normativa = NormativaMediator.obtener(normativaId)
  → modules/motor/calcularCircuito(circuito, equipos, normativaObjeto)
```

---

## 5. NormativaMediator

**Módulos:** NEC, IEC, CIEN, biblioteca normativa, registro de hojas seleccionables.

### Dependencias

- Repository
- Cache

### Responsabilidad

- Entregar el **objeto normativa** completo (ampacidades, breakers, reglas de demanda, límites ΔV, voltajes por fase, etc.).
- Listar normativas para la UI.
- Gancho opcional `verificarCircuito` (reglas extra post-cálculo).

### Prohibido

- Realizar dimensionamiento o cálculos de corriente/ΔV.
- Conocer UI, Motor, Documento o Diagrama.
- Alojar **conversiones genéricas de unidades** (AWG↔mm², °C, etc.): eso va en `shared/utils` o servicio `UnitConversion`. Normativa solo aporta **valores de tabla**.

---

## 6. ValidacionMediator

**Módulos conceptuales (mismo mediador, responsabilidades distintas):**

| Tipo | Cuándo | Ejemplo | ¿Bloquea guardar? |
|------|--------|---------|-------------------|
| Formulario | Al editar / submit de campo | Nombre vacío, cos φ fuera de rango | Sí (entrada inválida) |
| Consistencia del proyecto | Sobre el modelo guardado | Equipo huérfano, ID duplicado, dedicado con 2 equipos | Según severidad |
| Eléctrica / normativa | Con **resultados ya calculados** | Breaker < I diseño, ΔV, advertencias del motor | Advertencia o error de proyecto |

### Dependencias permitidas

- DataProvider (modelo + **resultados** del snapshot)
- NormativaMediator (parámetros / `verificarCircuito`)
- MotorCalculoMediator **solo** de forma explícita y excepcional
  (recalcular un nodo bajo demanda), **no** en cadena por defecto tras cada cálculo global

### Regla anti-ciclo

```
Cálculo global → escribe resultados en snapshot
Validación     → LEE resultados; no vuelve a disparar el motor en bucle
```

Si Validación necesitara un número que no está en el resultado, se amplía el
contrato del resultado del motor; no se acopla Validación→Motor en cada clic.

---

## 7. PersistenciaMediator

**Hoy:** exportador / importador JSON (navegador).

**Mañana:** SQLite, importador PDF, etc.

### Diseño por adapters

```
PersistenciaMediator
  ├── JsonAdapter      (actual — File / Blob en browser)
  ├── SqliteAdapter    (futuro)
  └── PdfImportAdapter (futuro)
```

El mediador **no** mezcla SQL, parsing PDF y `document.createElement('a')`
en una sola capa opaca. Cada adapter implementa el mismo puerto
(serializar / deserializar / listar).

### Dependencias

- Sistema de archivos / APIs de almacenamiento del adapter
- No depende de Motor ni de Normativa (persiste el documento ya armado)

---

## 8. DocumentoMediator

**Módulos:** reportes PDF, memoria técnica, exportación, resumen de cálculos.

### Dependencias

- DataProvider (modelo + resultados **ya calculados**)

### Prohibido

- Recalcular circuitos por su cuenta (pediría al Motor vía ApplicationMediator
  si hiciera falta un refresh explícito, no en silencio).

---

## 9. DiagramaMediator

**Módulos:** editor unifilar, topología, etiquetas, coordenadas,
sincronización con la tabla.

### Dependencias

- DataProvider

### Modelo canónico (anti-bucle tabla ↔ diagrama)

- La **fuente de verdad** es el modelo de proyecto (circuitos, equipos, tableros).
- Tabla y diagrama son **vistas**.
- Ambas escriben al modelo; **nunca** una vista escribe directamente en la otra.

```
[Tabla] ──writes──► Modelo canónico ◄──writes── [Diagrama]
              │
              └──reads──► ambas vistas se re-renderizan
```

---

## 10. Servicios compartidos

| Servicio | Rol |
|----------|-----|
| **DataProvider** | Entrega datos solicitados. **No calcula.** En React es vista de lectura sincronizada desde el hook (`syncSnapshot`), no segunda fuente de verdad que mute circuitos por su cuenta. |
| **Repository** | Acceso a datos de referencia persistentes / estáticos (tablas). |
| **Cache** | Tablas normativas y resultados frecuentes en memoria. |
| **Logger** | Registro de errores y diagnóstico. |
| **Config** | Configuración global (normativa por defecto, feature flags). |

### Fuente de verdad del estado (SPA React)

1. El **estado mutable** del documento vive en la capa de aplicación
   (`useCircuitos` / futuro store).
2. Tras cada cambio relevante se llama `ApplicationMediator.syncSnapshot(...)`.
3. Los mediadores de dominio **leen** del DataProvider cuando operan sin
   argumentos explícitos; la UI sigue siendo quien **escribe** vía el hook.

No deben existir dos caminos de escritura (`setCircuitos` y
`DataProvider.setCircuitos`) sin una sola dirección clara.

---

## 11. Diagrama de dependencias (permitido)

```
UI
 └─ ApplicationMediator
      ├─ MotorCalculoMediator ──► NormativaMediator (solo parámetros)
      │         │
      │         └─ DataProvider (lectura)
      │
      ├─ ValidacionMediator ──► DataProvider (modelo + resultados)
      │         ├─► NormativaMediator
      │         └─► Motor (solo bajo demanda explícita, no en cadena)
      │
      ├─ PersistenciaMediator ──► adapters (JSON hoy)
      ├─ DocumentoMediator ──► DataProvider
      └─ DiagramaMediator ──► DataProvider
```

### Prohibiciones

| Desde | Hacia | Motivo |
|-------|-------|--------|
| Motor | Validacion, Documento, Diagrama, UI | El motor no presenta ni valida flujo de app |
| Normativa | Motor, UI | Solo datos de código |
| Documento / Diagrama | Motor (directo) | Consumen resultados ya calculados |
| Cualquier módulo | Otro módulo de dominio sin mediador | Rompe la regla de oro |

---

## 12. Flujo de ejemplo (corregido)

```
UI
 → ApplicationMediator.calcularProyecto()
      → MotorCalculoMediator.calcularTodos()
           → DataProvider / args: circuitos, equipos
           → NormativaMediator.obtener(id) → parámetros
           → motor interno dimensiona
      → resultados se guardan en snapshot (DataProvider)
 → ApplicationMediator / ValidacionMediator
      → LEE resultados + modelo (consistencia y eléctrica)
 → (opcional) DocumentoMediator.resumenCalculos()
 → PersistenciaMediator.descargarJson() / guardar
```

Orden estable: **calcular → persistir resultados en snapshot → validar → documentar → guardar**.  
Validar no reabre el motor en bucle.

---

## 13. Carpetas del repositorio

```
src/
  core/
    ApplicationMediator.js
    mediators/
    services/
  modules/
    motor/
    normativa/
    validacion/
    persistencia/
    documento/          # stub
    diagrama/           # stub
  shared/
    data/
    utils/
    constants/
  components/           # UI
  hooks/                # estado React + llamadas a ApplicationMediator
  ARCHITECTURE.md       # este contrato
```

Carpetas legacy (`calculations/`, `data/normativas/`, `validation/` como
re-exports) son **compatibilidad**; la lógica vive en `modules/` y se
orquesta desde `core/`.

---

## 14. Checklist al añadir código nuevo

- [ ] ¿Este código es de un solo dominio? → módulo interno, sin mediador.
- [ ] ¿Cruza dominios? → mediador (o ApplicationMediator si es flujo de app).
- [ ] ¿Es tabla o dato de referencia? → Repository / shared/data, no hardcode en UI.
- [ ] ¿Es conversión de unidades? → shared/utils, no Normativa.
- [ ] ¿Escribe el proyecto? → solo capa de aplicación (hook / caso de uso).
- [ ] ¿Necesita Tablero y aún no existe? → stub documentado, no implementación a medias a nivel circuito.
- [ ] ¿Validación eléctrica? → usa resultados del snapshot, no recalcula en silencio.
- [ ] ¿Evento? → solo notificación, no request/response de cálculo.

---

## 15. Resumen de correcciones respecto a la propuesta inicial

1. **Validación consume resultados**; no dispara el motor en cadena por defecto.
2. **Una sola fuente de verdad** del proyecto; DataProvider es lectura sincronizada.
3. **ApplicationMediator = orquestador**, no contenedor de reglas de negocio.
4. **Persistencia por adapters** (JSON ahora; SQLite/PDF después).
5. **Conversiones de unidades fuera de Normativa.**
6. **Modelo canónico** para tabla ↔ diagrama (sin bucles vista-a-vista).
7. **Capacidades del Motor** ligadas a entidades futuras (Tablero) quedan
   explícitamente pendientes.
8. **Mutaciones** solo en capa de aplicación; Motor/Normativa solo leen el modelo.
9. **Tres tipos de validación** (formulario / consistencia / eléctrica) con
   semántica distinta para la UI.
