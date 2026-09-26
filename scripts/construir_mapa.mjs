// Genera js/mapa.js: un mapamundi en SVG (Natural Earth, dominio público vía world-atlas)
// con un trazado por país, las coordenadas proyectadas de cada capital y la caja de cada país
// para poder hacer zoom. Uso: node scripts/construir_mapa.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const raiz = new URL("..", import.meta.url).pathname;
const paises = JSON.parse(readFileSync(raiz + "data/paises.json", "utf8"));
const t110 = require("world-atlas/countries-110m.json");
const t50 = require("world-atlas/countries-50m.json");

const W = 1000, H = 520;
const f110 = feature(t110, t110.objects.countries).features.filter((f) => f.id !== "010"); // sin Antártida
const f50 = feature(t50, t50.objects.countries).features;
const proyeccion = geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: "FeatureCollection", features: f110 });
const trazo = geoPath(proyeccion).digits(1);

const porCcn3 = new Map(paises.map((p) => [p.ccn3, p]));
// Natural Earth no da código numérico a Kosovo: se identifica por nombre.
for (const f of [...f110, ...f50]) if (f.properties.name === "Kosovo") f.id = "XK";
porCcn3.set("XK", paises.find((p) => p.id === "XK"));
const usados = new Set();
const fondo = [];
const formas = {};
for (const f of f110) {
  const p = porCcn3.get(f.id);
  const d = trazo(f);
  if (!d) continue;
  if (p) { formas[p.id] = d; usados.add(p.id); } else fondo.push(d);
}
// Países pequeños que no están a 1:110m: se toman de la versión 1:50m.
for (const f of f50) {
  const p = porCcn3.get(f.id);
  if (p && !usados.has(p.id)) {
    const d = trazo(f);
    if (d) { formas[p.id] = d; usados.add(p.id); }
  }
}

const capitales = {};
const cajas = {};
for (const p of paises) {
  const [x, y] = proyeccion([p.lon, p.lat]);
  capitales[p.id] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  if (formas[p.id]) {
    const [[x0, y0], [x1, y1]] = trazo.bounds(f50.find((f) => f.id === (p.id === "XK" ? "XK" : p.ccn3)) || f110.find((f) => f.id === p.ccn3));
    cajas[p.id] = [x0, y0, x1, y1].map((v) => Math.round(v));
  }
}

const sinForma = paises.filter((p) => !formas[p.id]).map((p) => p.pais);
const js = "// Generado por scripts/construir_mapa.mjs (Natural Earth vía world-atlas). No editar a mano.\n" +
  "window.MAPA = " + JSON.stringify({ w: W, h: H, fondo: fondo.join(""), formas, capitales, cajas }) + ";\n";
writeFileSync(raiz + "js/mapa.js", js);
console.log(`mapa.js: ${(js.length / 1024).toFixed(0)} KB · ${Object.keys(formas).length} países con forma` +
  (sinForma.length ? ` · solo punto: ${sinForma.join(", ")}` : ""));
