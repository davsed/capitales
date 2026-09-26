// Pruebas del dataset y de la tabla bidireccional. Uso: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

const raiz = new URL("..", import.meta.url).pathname;
const contexto = { window: {} };
contexto.window.window = contexto.window;
vm.createContext(contexto);
for (const archivo of ["js/datos.js", "js/mapa.js"]) vm.runInContext(readFileSync(raiz + archivo, "utf8"), contexto);
vm.runInContext(readFileSync(raiz + "js/tabla.js", "utf8"), contexto);
const { PAISES, CONTINENTES, MAPA, TABLA } = contexto.window;
const porId = Object.fromEntries(PAISES.map((p) => [p.id, p]));

test("hay 193 miembros de la ONU + Vaticano, Palestina, Kosovo y Taiwán", () => {
  assert.equal(PAISES.length, 197);
  assert.equal(PAISES.filter((p) => !p.limitado).length, 196);
  for (const id of ["VA", "PS", "XK", "TW"]) assert.ok(porId[id], id);
});

test("la tabla es bidireccional: países y capitales únicos", () => {
  const paises = new Set(PAISES.map((p) => TABLA.normalizar(p.pais)));
  const capitales = new Set(PAISES.map((p) => TABLA.normalizar(p.capital)));
  assert.equal(paises.size, PAISES.length);
  assert.equal(capitales.size, PAISES.length);
  for (const p of PAISES) {
    assert.equal(TABLA.capitalDe(p.pais), p, `capitalDe(${p.pais})`);
    assert.equal(TABLA.paisDe(p.capital), p, `paisDe(${p.capital})`);
  }
});

test("cada país tiene continente, bandera y posición en el mapa", () => {
  for (const p of PAISES) {
    assert.ok(CONTINENTES[p.cont], p.id);
    assert.ok(existsSync(`${raiz}flags/${p.id.toLowerCase()}.svg`), `bandera ${p.id}`);
    assert.ok(MAPA.capitales[p.id], `capital en el mapa ${p.id}`);
    assert.ok(p.wiki, `artículo de Wikipedia ${p.id}`);
  }
});

test("capitales actualizadas y casos disputados", () => {
  assert.equal(porId.GQ.capital, "Ciudad de la Paz"); // cambio de enero de 2026
  assert.equal(porId.KZ.capital, "Astaná");
  assert.equal(porId.ID.capital, "Yakarta");
  assert.equal(porId.BO.capital, "Sucre");
  assert.ok(porId.BO.capitalAlt.includes("La Paz"));
  assert.ok(porId.ZA.capitalAlt.includes("Ciudad del Cabo"));
  assert.equal(porId.MM.capital, "Naipyidó");
  assert.equal(porId.IL.capital, "Jerusalén");
  assert.ok(porId.PS.capitalAlt.includes("Jerusalén Este"));
});

const pc = (id) => ({ p: porId[id], dir: "pc" });
const cp = (id) => ({ p: porId[id], dir: "cp" });

test("acepta tildes, mayúsculas, artículos y alternativas", () => {
  assert.ok(TABLA.evaluar("paris", pc("FR"), false).ok);
  assert.ok(TABLA.evaluar("  PARÍS ", pc("FR"), false).ok);
  assert.ok(TABLA.evaluar("Cairo", pc("EG"), false).ok);
  assert.ok(TABLA.evaluar("habana", pc("CU"), false).ok);
  assert.ok(TABLA.evaluar("Beijing", pc("CN"), false).ok);
  assert.ok(TABLA.evaluar("kualalumpur", pc("MY"), false).ok);
  assert.ok(TABLA.evaluar("La Paz", pc("BO"), false).ok);
  assert.ok(TABLA.evaluar("myanmar", cp("MM"), false).ok);
  assert.ok(TABLA.evaluar("EEUU", cp("US"), false).ok);
});

test("perdona erratas leves solo si están activadas", () => {
  assert.equal(TABLA.evaluar("Budapes", pc("HU"), false).ok, false);
  const r = TABLA.evaluar("Budapes", pc("HU"), true);
  assert.ok(r.ok);
  assert.equal(r.exacta, false);
  assert.ok(TABLA.evaluar("Ouagadougu", pc("BF"), true).ok);
});

test("no confunde un país o capital real con una errata", () => {
  const irak = TABLA.evaluar("Irak", cp("IR"), true);
  assert.equal(irak.ok, false);
  assert.equal(irak.comoPais, porId.IQ);
  const berlin = TABLA.evaluar("Berlín", pc("FR"), true);
  assert.equal(berlin.ok, false);
  assert.equal(berlin.comoCapital, porId.DE);
  const francia = TABLA.evaluar("Francia", pc("FR"), true);
  assert.equal(francia.ok, false);
  assert.equal(francia.comoPais, porId.FR);
});

test("respuesta vacía no cuenta", () => {
  assert.ok(TABLA.evaluar("   ", pc("ES"), true).vacia);
});
