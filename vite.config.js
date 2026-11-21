import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Empaquetado en GitHub Pages (usuario, 2026-11-22: "quiero probar
  // personalmente" antes de pasar a acceso restringido) — Pages sirve
  // el proyecto bajo /Dimensionamiento-electrico/, no en la raíz del
  // dominio, así que cada referencia a un archivo necesita ese prefijo.
  // SOLO en ese build específico (variable GITHUB_PAGES, puesta por
  // .github/workflows/deploy-pages.yml) — el build normal (CI de
  // tests.yml, `npm run dev`/`preview` local) sigue sirviendo desde la
  // raíz como siempre.
  base: process.env.GITHUB_PAGES ? "/Dimensionamiento-electrico/" : "/",
  plugins: [
    react(),
    // Empaquetado para móviles (usuario, 2026-11-22: "quiero que el
    // empaquetado sea para móviles") — PWA instalable: "Agregar a
    // pantalla de inicio" desde el navegador, funciona sin señal una
    // vez cargada, sin tienda de aplicaciones ni cuenta de
    // desarrollador. Ver PWA.md para el porqué completo (incluida la
    // razón por la que NO es un .apk nativo en esta ronda) y cómo
    // probarla.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Dimensionamiento Eléctrico Completo (DEC)",
        short_name: "DEC",
        description: "Calculadora de dimensionamiento eléctrico — circuitos, tableros, diagrama unifilar y plano, bajo NEC/CIEN/REBT.",
        lang: "es",
        start_url: process.env.GITHUB_PAGES ? "/Dimensionamiento-electrico/" : "/",
        scope: process.env.GITHUB_PAGES ? "/Dimensionamiento-electrico/" : "/",
        display: "standalone",
        background_color: "#222a3f",
        theme_color: "#222a3f",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // El worker de pdf.js (~1.3MB) y el chunk de pdf-lib son grandes
        // a propósito (ver su propia nota) — se precachean igual que
        // todo lo demás, así el programa queda 100% usable sin señal
        // una vez que se abrió una vez (ver PWA.md).
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5000,
    strictPort: true,
    allowedHosts: true,
  },
});
