// Añade ?v=<huella del contenido> a los CSS y JS propios de las páginas, para que tras publicar una
// versión nueva el navegador no siga usando la antigua guardada en caché. Uso: node scripts/huellas.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const raiz = new URL("..", import.meta.url).pathname;
const huella = (ruta) => createHash("sha1").update(readFileSync(raiz + ruta)).digest("hex").slice(0, 10);
for (const pagina of ["index.html", "lista.html"]) {
  const antes = readFileSync(raiz + pagina, "utf8");
  const despues = antes.replace(/(src|href)="((?:css|js)\/[^"?]+)(?:\?v=[0-9a-f]+)?"/g,
    (_, atributo, ruta) => `${atributo}="${ruta}?v=${huella(ruta)}"`);
  writeFileSync(raiz + pagina, despues);
  console.log(`${pagina}: ${(despues.match(/\?v=/g) || []).length} archivos con huella`);
}
