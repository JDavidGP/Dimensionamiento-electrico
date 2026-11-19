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
- [ ] Factores de simultaneidad del REBT (ITC-BT-10) a nivel de tablero/acometida
- [ ] Diagrama unifilar sincronizado con la tabla — Fase 1 (modelo de datos), Fase 2 (motor de reglas eléctricas) y Fase 3 (editor mínimo: agregar/mover/conectar/eliminar nodos, los 25 símbolos del catálogo dibujados a mano) listas, sin cálculos todavía; faltan símbolos normalizados IEC 60617 (los actuales son equivalentes simplificados propios), autoorganización, zoom/pan y sincronizar con la tabla de circuitos
- [ ] Memoria técnica / informe en PDF
- [ ] Sistema de etiquetado y planos
- [ ] Migración progresiva a TypeScript
- [x] Fuentes de energía (Batería, Generador) con rol (Principal/Secundaria/Auxiliar) como origen seleccionable de un tablero, reutilizando el selector de "Tablero padre" — Transformador queda pendiente aparte (ver más abajo)
- [x] Conmutación entre fuentes de energía (red local / batería / generador), por horario o automática ante falla — registrado en la memoria del proyecto, todavía no recalcula según cuál fuente está activa
- [x] Tipo de instalación (domiciliaria / industrial), elegido junto con la normativa — por ahora informativo, todavía no quita/agrega equipos o tablas
- [ ] Transformador como origen seleccionable (la entidad ya existe, creada sin conectar — se integra junto con el sistema de media tensión)

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
