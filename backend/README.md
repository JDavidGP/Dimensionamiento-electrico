# DEC backend

Backend mínimo para DEC (Dimensionamiento Eléctrico Completo) — alcance
acordado 2026-11-27: **solo cuentas y guardar/cargar proyectos**. El
cálculo eléctrico sigue corriendo enteramente en el navegador, igual
que hasta ahora (ver `../src/hooks/useCircuitos.ts`); este backend no
recalcula nada, solo persiste el mismo JSON que ya se exporta con
"Guardar como .json", ahora en una base de datos compartida en vez de
un archivo local, para habilitar multiusuario.

Node.js + TypeScript + Express + PostgreSQL. Sin ORM (consultas SQL
directas con `pg`) — alcance chico, no vale la pena la complejidad
extra todavía.

## Requisitos

- Node.js 20+
- PostgreSQL 14+ corriendo y accesible — directo en el sistema, o con
  Docker (ver abajo)

## Postgres con Docker (recomendado para probar en la propia máquina)

`docker-compose.yml` ya viene configurado para coincidir exacto con el
`DATABASE_URL` de `.env.example` (usuario/contraseña/base `dec`/`dec`/`dec`)
— con esto levantado, `.env` no necesita tocar esa variable.

```bash
docker compose up -d   # levanta Postgres en segundo plano, persistido en un volumen
docker compose down    # lo apaga (los datos quedan en el volumen)
docker compose down -v # lo apaga Y borra los datos, para empezar de cero
```

## Arrancar en desarrollo

```bash
cp .env.example .env
# completar DATABASE_URL (debe apuntar a una base ya creada) y generar
# un JWT_SECRET real:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

npm install
npm run migrar   # aplica backend/src/schema.sql (seguro de correr más de una vez)
npm run dev      # levanta con recarga automática en PUERTO (default 3001)
```

## Producción (en el servidor propio, hardware local)

```bash
npm install --omit=dev
npm run build    # compila a dist/
npm run migrar
npm start        # node dist/server.js
```

## Pruebas

```bash
npm test
```

Son pruebas de integración contra una PostgreSQL real (igual criterio
que el frontend: nada de mocks de base de datos) — usan el
`DATABASE_URL` del `.env` local y limpian los usuarios/proyectos que
crean al terminar. Necesitan la base ya migrada (`npm run migrar`).

## Endpoints

Todas las respuestas son JSON. Las rutas bajo `/proyectos` requieren
`Authorization: Bearer <token>` (el token lo devuelve `/auth/registro`
o `/auth/login`).

| Método | Ruta              | Qué hace                                             |
|--------|-------------------|-------------------------------------------------------|
| POST   | `/auth/registro`  | Crea cuenta — `{ email, password, nombre }`           |
| POST   | `/auth/login`     | Inicia sesión — `{ email, password }`                 |
| GET    | `/proyectos`      | Lista los proyectos del usuario (sin el blob `datos`) |
| GET    | `/proyectos/:id`  | Un proyecto completo, con `datos`                     |
| POST   | `/proyectos`      | Crea — `{ nombre, datos }`                            |
| PUT    | `/proyectos/:id`  | Actualiza — `{ nombre?, datos? }`                     |
| DELETE | `/proyectos/:id`  | Borra                                                  |
| GET    | `/salud`          | Chequeo simple, sin auth                               |

## Frontend ya conectado

`src/hooks/useCuenta.ts` (nuevo, separado de `useCircuitos.ts`) + `src/modules/cuenta/clienteBackend.ts`
+ `src/components/PanelCuenta.tsx` (en el menú ⋮ → "Cuenta"). Es ADITIVO,
no reemplaza nada: "Guardar (.pdf)"/".json"/"Abrir" en la barra superior
siguen funcionando exactamente igual que antes, igual que abrir
cualquier archivo local. "Guardar en la nube" vive aparte, dentro del
panel de Cuenta, y requiere haber iniciado sesión. Abrir un archivo
local o "+ Nuevo" desvincula el proyecto de la nube que estuviera
sincronizado (para no sobreescribirlo sin querer con datos de otro
proyecto). Verificado con Playwright real contra este backend (no solo
las pruebas de integración de arriba): registro, guardar, cambiar de
proyecto, y volver a abrir el mismo proyecto desde la nube reproduce el
nombre/datos exactos.

## Pendiente (no es parte de este alcance)

- Mover el cálculo al servidor (decidido explícitamente que NO por
  ahora — ver conversación 2026-11-27).
- Límite de proyectos/usuario, cuotas, recuperación de contraseña.
