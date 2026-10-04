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

/** Juega una maratón entera. acierta(id, turno) decide cada respuesta. Marca las preguntas de relleno. */
function jugar(m, acierta, azar) {
  const preguntas = [];
  preguntas.relleno = [];
  let id;
  while ((id = P.siguienteId(m, azar)) !== null) {
    preguntas.push(id);
    preguntas.relleno.push(P.esRelleno(m, id));
    P.registrarRespuesta(m, id, acierta(id, m.turno) ? "acierto" : "fallo", azar);
    if (preguntas.length > 100000) throw new Error("la maratón no termina");
  }
  return preguntas;
}

test("si aciertas siempre, cada país cuenta exactamente tres veces", () => {
  const m = P.crearMaraton({ ids, dir: "pc", modo: "escribir", zona: "todo" });
  const preguntas = jugar(m, () => true, semilla(1));
  const veces = {};
  preguntas.forEach((id, i) => { if (!preguntas.relleno[i]) veces[id] = (veces[id] || 0) + 1; });
  for (const id of ids) assert.equal(veces[id], 3, id);
  // Solo hay relleno al final, cuando quedan menos países que la separación mínima.
  assert.ok(preguntas.relleno.filter(Boolean).length <= P.SEPARACION * 2, `relleno ${preguntas.relleno.filter(Boolean).length}`);
  assert.equal(P.dominados(m), ids.length);
});

test("cada pregunta es un país pendiente cualquiera, al azar", () => {
  // Grupo de 10: en la 6.ª pregunta, cada país sale con una frecuencia parecida (≈ 10 %).
  const grupo = ids.slice(0, 10);
  const cuenta = Object.fromEntries(grupo.map((id) => [id, 0]));
  const azar = semilla(21);
  const N = 4000;
  for (let k = 0; k < N; k++) {
    const m = P.crearMaraton({ ids: grupo, dir: "pc", modo: "escribir", zona: "x" });
    let id;
    for (let i = 0; i < 6; i++) { id = P.siguienteId(m, azar); if (i < 5) P.registrarRespuesta(m, id, azar() < 0.7 ? "acierto" : "fallo", azar); }
    cuenta[id]++;
  }
  for (const id of grupo) assert.ok(cuenta[id] / N > 0.07 && cuenta[id] / N < 0.13, `${id}: ${Math.round((cuenta[id] / N) * 100)} %`);
  // Sin subgrupos: en una partida de 46 países, tras 46 preguntas han salido más de 26 distintos (al azar, ~30).
  let distintos = 0;
  for (let k = 0; k < 50; k++) {
    const m = P.crearMaraton({ ids: ids.slice(0, 46), dir: "pc", modo: "escribir", zona: "x" });
    const vistos = new Set();
    for (let i = 0; i < 46; i++) { const x = P.siguienteId(m, azar); vistos.add(x); P.registrarRespuesta(m, x, azar() < 0.7 ? "acierto" : "fallo", azar); }
    distintos += vistos.size;
  }
  assert.ok(distintos / 50 > 26, `distintos ${distintos / 50}`);
});

test("nunca dos veces seguidas y al menos tres países entre dos apariciones del mismo", () => {
  for (const [grupo, semillaN] of [[ids, 5], [ids.slice(0, 12), 6], [ids.slice(0, 5), 7], [ids.slice(0, 4), 8]]) {
    const azar = semilla(semillaN);
    const m = P.crearMaraton({ ids: grupo, dir: "pc", modo: "escribir", zona: "x" });
    const ultimaVez = {};
    let id;
    while ((id = P.siguienteId(m, azar)) !== null) {
      if (id in ultimaVez) assert.ok(m.turno - ultimaVez[id] - 1 >= P.SEPARACION, `${id}: ${m.turno - ultimaVez[id] - 1} entre medias`);
      ultimaVez[id] = m.turno;
      P.registrarRespuesta(m, id, azar() < 0.7 ? "acierto" : "fallo", azar);
    }
    assert.equal(P.pendientes(m).length, 0);
  }
});

test("al final, si quedan pocos, sale de relleno un país ya dominado que no cuenta", () => {
  const m = P.crearMaraton({ ids: ["FR", "DE", "IT", "ES", "PT"], dir: "pc", modo: "escribir", zona: "EU" });
  for (const id of ["IT", "ES", "PT"]) m.paises[id].racha = 3;
  m.recientes = ["FR", "DE", "IT"];
  const id = P.siguienteId(m, semilla(4));
  assert.ok(["ES", "PT"].includes(id), id);
  assert.ok(P.esRelleno(m, id));
  const r = P.registrarRespuesta(m, id, "fallo");
  assert.ok(r.relleno);
  assert.equal(m.paises[id].racha, 3); // un fallo de relleno no le quita el dominado
  assert.equal(P.dominados(m), 3);
});

test("una maratón guardada con la versión anterior se puede continuar", () => {
  const antigua = { app: "capitales", version: 1, maraton: {
    dir: "pc", modo: "escribir", zona: "EU", turno: 7, ultimo: "FR",
    paises: { FR: { racha: 1, proxima: 9, aciertos: 1, fallos: 0 }, DE: { racha: 0, proxima: null, aciertos: 0, fallos: 0 }, IT: { racha: 2, proxima: 20, aciertos: 2, fallos: 0 } },
  } };
  const r = P.validar(JSON.stringify(antigua), idsValidos);
  assert.ok(r.ok);
  const m = r.datos.maraton;
  const preguntas = jugar(m, () => true, semilla(9));
  assert.ok(preguntas[0] !== "FR"); // acababa de salir
  assert.equal(P.dominados(m), 3);
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
