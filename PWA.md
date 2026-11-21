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

1. `npm run build && npm run preview` (o cualquier servidor HTTPS — "Agregar a
   pantalla de inicio" exige HTTPS o `localhost`, nunca HTTP plano).
2. Desde el celular, abrir esa URL en Chrome (Android) o Safari (iOS).
3. Android/Chrome: menú ⋮ → "Instalar app" (o aparece un banner solo).
   iOS/Safari: botón compartir → "Agregar a pantalla de inicio" (Safari no
   tiene instalación automática, siempre es manual).
4. Confirmado con `tests/test_pwa.mjs`: manifest válido y enlazado, los 4
   íconos declarados responden 200, `theme-color` coincide con el fondo de la
   app, y el service worker se registra y queda "ready".

## Pendiente, a propósito

- Los íconos son un diseño genérico de arranque, no definitivo.
- Sin pantalla de splash custom (cada plataforma pone la suya por defecto a
  partir del ícono + `background_color` del manifest).
- Sin notificaciones push ni sincronización en segundo plano — no pedidas.
