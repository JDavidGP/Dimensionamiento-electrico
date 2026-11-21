import { chromium } from "playwright";
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
const page = await browser.newPage();
const fallos = [];
page.on("response", (r) => { if (r.status() === 404) fallos.push(r.url()); });
await page.goto((process.env.BASE_URL || "http://localhost:4333"), { waitUntil: "networkidle" });
console.log("404s en carga simple (sin tocar nada):", fallos);
await browser.close();
