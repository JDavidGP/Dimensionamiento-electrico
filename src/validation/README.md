# Módulo de integridad (`src/validation`)

## API pública (`index.js`)

```js
import {
  obtenerListaIntegridad,
  obtenerDetalleElectrico,
  resumenIntegridad,
  ESTADOS,
} from "../validation";

// Fase 1 — lista plana para UI
const lista = obtenerListaIntegridad(proyecto, circuitos, equipos);
// [{ id, tipo, nombre, parentId, estado, resumen, problemas }, ...]

// Badge global
const resumen = resumenIntegridad(proyecto, circuitos, equipos);
// { ok: n, advertencia: n, error: n }

// Fase 2 — detalle al seleccionar un nodo
const detalle = obtenerDetalleElectrico(id, proyecto, circuitos, equipos, {
  resultadoCalculo: resultados.find((r) => r.id === id), // opcional pero recomendado
  normativaEngine: NORMATIVAS[normativaActiva],          // opcional
});
// { id, tipo, estado, datos, mensajes }
```

## Desde el hook

`useCircuitos()` ya expone:

- `listaIntegridad`
- `resumenIntegridad`  → `{ ok, advertencia, error }`
- `detalleElectrico(id)` → llama a Fase 2 con el resultado de cálculo y la normativa activa
- `ESTADOS_INTEGRIDAD`

## Diferencias respecto al diseño original

| Original (diseño)              | Real (app actual)                          |
|--------------------------------|--------------------------------------------|
| `proyecto.circuitos` anidados  | arrays planos `circuitos` + `equipos`      |
| `circuito.equipos`              | `equipos.filter(e => e.circuitoId === c.id)` |
| `circuito.tension` / `fase`     | `circuito.voltaje` / `circuito.fases`         |
| `equipo.potencia` / `corriente`| `equipo.valor` + `modoEntrada` + `cantidad`|
| `circuito.breaker` / `calibre`  | se calculan; se leen de `resultadoCalculo` |
| entidad Tablero                | aún no existe (gancho preparado)           |

## Estados

- `ok` — sin hallazgos
- `advertencia` — datos incompletos o recomendaciones
- `error` — inconsistencia estructural o capacidad insuficiente
