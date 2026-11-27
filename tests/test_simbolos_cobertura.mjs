import { ApplicationMediator as App } from "../src/core/ApplicationMediator.ts";

const catalogo = App.diagrama.CATALOGO_COMPONENTES;
console.log(`Catálogo tiene ${catalogo.length} tipos.`);
console.log("Tipos listados (para contrastar manualmente contra simbolosDiagrama.jsx):");
catalogo.forEach((c) => console.log(" -", c.id));
