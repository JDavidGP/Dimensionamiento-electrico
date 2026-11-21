# DEC como PWA (app instalable para celular)

Pedido del usuario (2026-11-22: "quiero que el empaquetado sea para móviles"). Se
evaluaron 2 caminos y se eligió explícitamente este:

- **PWA instalable (esta ronda)** — el navegador del celular ofrece "Agregar a
  pantalla de inicio"; una vez instalada se abre como una app normal (ícono
  propio, sin barra de direcciones), y funciona sin señal después de la
  primera carga. No necesita Play Store/App Store ni cuenta de desarrollador.
  Se puede construir completo desde este entorno de nube.
- **.apk nativo (descartado por ahora)** — un .apk real (vía Capacitor) necesita
  Android SDK/Gradle para compilarlo y firmarlo; este entorno de nube no tiene
  esas herramientas, así que en el mejor de los casos se podría armar el
  *proyecto* Capacitor pero no el .apk final acá mismo. Queda como una opción
  para más adelante si hace falta de verdad (por ejemplo, para repartirlo fuera
  de un navegador).

## Cómo se armó

- `vite-plugin-pwa` (ver `vite.config.js`) genera, en cada `npm run build`:
  - `dist/manifest.webmanifest` — nombre, ícono, color, `display: "standalone"`.
  - `dist/sw.js` — service worker (vía Workbox) que precachea todo el bundle
    (~1.1MB, incluido el worker de pdf.js) para que la app completa funcione
    sin señal después de la primera visita.
- Íconos en `public/` (`icon-192.png`, `icon-512.png` + variantes `maskable`
  para Android, `apple-touch-icon.png` para iOS) — un rayo eléctrico simple en
  los colores propios de la app (`src/styles/colores.js`: fondo `#171512`,
  cobre `#C9793D`). Es un diseño provisorio, genérico — cuando se defina el
  nombre/identidad final del programa (ver README, "Ideas futuras") conviene
  rehacerlos.
- `pdf-lib` (usado para guardar/abrir el proyecto, ver el commit de guardado en
  PDF) se carga con `import()` dinámico, no estático — queda en su propio chunk,
  afuera del bundle inicial, para no pesarle a la primera carga en un celular.

## Cómo probarla

### En el celular, de verdad (publicado)

Usuario, 2026-11-22: primer nivel de privacidad elegido — "link no listado,
sin contraseña" (ver README, o la conversación), para que el usuario la
pruebe personalmente antes de pasar a acceso restringido por email para sus
colegas.

Publicado en GitHub Pages (gratis, HTTPS automático, sin cuenta nueva —
`.github/workflows/deploy-pages.yml`, se dispara solo en cada push a esta
rama). **Falta UN paso manual, una sola vez**: en GitHub →
`Settings` → `Pages` → "Build and deployment" → `Source`: elegir
**"GitHub Actions"** (hoy probablemente dice "Deploy from a branch"). Sin
ese cambio el workflow corre pero Pages no sirve nada.

Una vez hecho eso, la app queda en:

**https://jdavidgp.github.io/Dimensionamiento-electrico/**

Desde el celular, abrir esa URL:
- Android/Chrome: menú ⋮ → "Instalar app" (o aparece un banner solo).
- iPhone/Safari: botón compartir → "Agregar a pantalla de inicio" (tiene que
  ser Safari — en iOS solo Safari puede instalar PWAs, Chrome ahí no).

Es un link público sin listar: cualquiera con la URL puede entrar, no hay
contraseña. Pensado para que el usuario la pruebe por su cuenta antes de
decidir si hace falta un nivel de acceso más restringido para repartirla
entre colegas.

### En local, para desarrollo

1. `npm run build && npm run preview` (sirve desde la raíz, sin el prefijo
   `/Dimensionamiento-electrico/` que usa Pages — ver la nota de
   `vite.config.js` sobre `GITHUB_PAGES`).
2. Abrir esa URL en el navegador del celular, en la misma red wifi que la
   computadora (cambiar `localhost` por la IP de la computadora en la red).
3. Confirmado con `tests/test_pwa.mjs`: manifest válido y enlazado, los 4
   íconos declarados responden 200, `theme-color` coincide con el fondo de la
   app, y el service worker se registra y queda "ready".

## Pendiente, a propósito

- Los íconos son un diseño genérico de arranque, no definitivo.
- Sin pantalla de splash custom (cada plataforma pone la suya por defecto a
  partir del ícono + `background_color` del manifest).
- Sin notificaciones push ni sincronización en segundo plano — no pedidas.
