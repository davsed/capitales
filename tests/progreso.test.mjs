// Pruebas de la maratón y de la copia de seguridad. Uso: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const raiz = new URL("..", import.meta.url).pathname;
const contexto = { window: {} };
contexto.window.window = contexto.window;
vm.createContext(contexto);
for (const archivo of ["js/datos.js", "js/progreso.js"]) vm.runInContext(readFileSync(raiz + archivo, "utf8"), contexto);
const { PAISES, PROGRESO: P } = contexto.window;
const ids = PAISES.filter((p) => !p.limitado).map((p) => p.id);
const idsValidos = new Set(PAISES.map((p) => p.id));

/** Azar reproducible (mulberry32). */
function semilla(s) {
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Juega una maratón entera. acierta(id, turno) decide cada respuesta. */
function jugar(m, acierta, azar) {
  const preguntas = [];
  let id;
  while ((id = P.siguienteId(m, azar)) !== null) {
    preguntas.push(id);
    preguntas.quedaban = [...(preguntas.quedaban || []), P.pendientes(m).length];
    P.registrarRespuesta(m, id, acierta(id, m.turno) ? "acierto" : "fallo", azar);
    if (preguntas.length > 100000) throw new Error("la maratón no termina");
  }
  return preguntas;
}

test("si aciertas siempre, cada país sale exactamente tres veces", () => {
  const m = P.crearMaraton({ ids, dir: "pc", modo: "escribir", zona: "todo" });
  const preguntas = jugar(m, () => true, semilla(1));
  assert.equal(preguntas.length, ids.length * 3);
  const veces = {};
  for (const id of preguntas) veces[id] = (veces[id] || 0) + 1;
  for (const id of ids) assert.equal(veces[id], 3, id);
  assert.equal(P.dominados(m), ids.length);
});

test("nunca pregunta el mismo país dos veces seguidas y un fallo vuelve pronto", () => {
  const azar = semilla(7);
  const m = P.crearMaraton({ ids, dir: "cp", modo: "opciones", zona: "todo" });
  const fallados = new Map(); // id -> turno del fallo
  const vueltas = [];
  const preguntas = jugar(m, (id, turno) => {
    if (fallados.has(id)) { vueltas.push(turno - fallados.get(id)); fallados.delete(id); }
    const ok = azar() < 0.7;
    if (!ok) fallados.set(id, turno + 1);
    return ok;
  }, azar);
  // (salvo al final, cuando solo queda un país)
  for (let i = 1; i < preguntas.length; i++) {
    if (preguntas.quedaban[i] > 1) assert.notEqual(preguntas[i], preguntas[i - 1], `turno ${i}`);
  }
  assert.equal(P.pendientes(m).length, 0);
  // Tras un fallo, el país vuelve en pocas preguntas (de media, menos de 8).
  const media = vueltas.reduce((a, b) => a + b, 0) / vueltas.length;
  assert.ok(media < 8, `media ${media}`);
});

test("para dominar un país hacen falta tres aciertos seguidos", () => {
  const m = P.crearMaraton({ ids: ["FR", "DE", "IT"], dir: "pc", modo: "escribir", zona: "EU" });
  P.registrarRespuesta(m, "FR", "acierto");
  P.registrarRespuesta(m, "FR", "acierto");
  assert.equal(m.paises.FR.racha, 2);
  const r = P.registrarRespuesta(m, "FR", "fallo");
  assert.equal(r.antes, 2);
  assert.equal(r.despues, 0);
  P.registrarRespuesta(m, "FR", "pista"); // con pista ni suma ni resta
  assert.equal(m.paises.FR.racha, 0);
  P.registrarRespuesta(m, "FR", "acierto");
  P.registrarRespuesta(m, "FR", "acierto");
  const fin = P.registrarRespuesta(m, "FR", "acierto");
  assert.ok(fin.dominado);
  assert.equal(P.dominados(m), 1);
  assert.ok(!P.pendientes(m).includes("FR"));
});

test("un grupo pequeño también termina", () => {
  const m = P.crearMaraton({ ids: ["AR", "CL"], dir: "pc", modo: "escribir", zona: "SA" });
  const azar = semilla(3);
  const preguntas = jugar(m, () => azar() < 0.6, azar);
  assert.equal(P.dominados(m), 2);
  assert.ok(preguntas.length >= 6);
});

test("la copia de seguridad se exporta y se vuelve a cargar igual", () => {
  const m = P.crearMaraton({ ids, dir: "pc", modo: "escribir", zona: "todo" });
  const azar = semilla(11);
  for (let i = 0; i < 40; i++) P.registrarRespuesta(m, P.siguienteId(m, azar), azar() < 0.7 ? "acierto" : "fallo", azar);
  const datos = { ajustes: { n: 10 }, records: { "x": { puntos: 900 } }, historial: [{ fecha: "2026-10-04", puntos: 900 }], maraton: m, maratones: [] };
  const texto = JSON.stringify(P.exportar(datos));
  const r = P.validar(texto, idsValidos);
  assert.ok(r.ok, r.error);
  assert.equal(JSON.stringify(r.datos.maraton), JSON.stringify(m));
  assert.equal(r.datos.historial.length, 1);
  assert.equal(r.datos.records.x.puntos, 900);
});

test("rechaza archivos que no son del juego y limpia datos raros", () => {
  assert.equal(P.validar("{no es json", idsValidos).ok, false);
  assert.equal(P.validar(JSON.stringify({ app: "otra" }), idsValidos).ok, false);
  assert.equal(P.validar(JSON.stringify({ app: "capitales", version: 99 }), idsValidos).ok, false);
  assert.equal(P.validar(JSON.stringify({ app: "capitales", version: 1, maraton: { dir: "mix" } }), idsValidos).ok, false);
  const raro = { app: "capitales", version: 1, maraton: {
    dir: "pc", modo: "escribir", zona: "todo", turno: 5,
    paises: { FR: { racha: 9, proxima: 3, aciertos: 2, fallos: -4 }, ZZ: { racha: 1 } },
  } };
  const r = P.validar(JSON.stringify(raro), idsValidos);
  assert.ok(r.ok);
  assert.equal(r.datos.maraton.paises.FR.racha, 3);
  assert.equal(r.datos.maraton.paises.FR.fallos, 0);
  assert.equal(r.datos.maraton.paises.ZZ, undefined);
});
