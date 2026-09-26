// Copia a flags/ las banderas SVG (flag-icons, licencia MIT) de los países del juego.
// Uso: node scripts/copiar_banderas.mjs
import { copyFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const raiz = new URL("..", import.meta.url).pathname;
const origen = join(dirname(require.resolve("flag-icons/package.json")), "flags", "4x3");
const paises = JSON.parse(readFileSync(raiz + "data/paises.json", "utf8"));
mkdirSync(raiz + "flags", { recursive: true });
let faltan = [];
for (const p of paises) {
  const archivo = join(origen, p.id.toLowerCase() + ".svg");
  if (existsSync(archivo)) copyFileSync(archivo, join(raiz, "flags", p.id.toLowerCase() + ".svg"));
  else faltan.push(p.id);
}
console.log(`${paises.length - faltan.length} banderas copiadas` + (faltan.length ? ` · faltan: ${faltan}` : ""));
