// Pruebas de las respuestas dichas en voz alta (lo que escribe el reconocimiento de voz). Uso: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const raiz = new URL("..", import.meta.url).pathname;
const contexto = { window: {} };
contexto.window.window = contexto.window;
vm.createContext(contexto);
for (const archivo of ["js/datos.js", "js/tabla.js"]) vm.runInContext(readFileSync(raiz + archivo, "utf8"), contexto);
const { PAISES, TABLA: T } = contexto.window;
const pais = (id) => PAISES.find((p) => p.id === id);
const oido = (id, dir, ...alternativas) => T.juzgarVoz(alternativas, { p: pais(id), dir });
const aMedias = (id, dir, ...alternativas) => T.juzgarVoz(alternativas, { p: pais(id), dir }, { temprano: true });

test("acepta la respuesta aunque el reconocimiento la escriba a su manera", () => {
  const casos = [
    ["FR", "París"], ["FR", "paris"], ["BF", "Wagadugu"], ["BF", "huaga dugu"], ["CI", "Yamusucro"],
    ["MM", "naipidó"], ["MM", "Nay pi do"], ["TM", "Asjabat"], ["SZ", "Babane"], ["TD", "Llamena"],
    ["TJ", "Dusambe"], ["KP", "Piongyang"], ["PW", "Nguerulmud"], ["SN", "Dacar"], ["IT", "Rome"],
    ["BN", "bandar seri begawan"], ["US", "Washington"], ["KG", "bis quec"], ["OM", "mas cate"],
    ["TO", "nuku alofa"], ["KH", "nom pen"], ["MN", "ulam bator"], ["GH", "acra"], ["MW", "lilongue"],
  ];
  for (const [id, dicho] of casos) {
    const r = oido(id, "pc", dicho);
    assert.ok(r.ok, `${pais(id).capital}: «${dicho}»`);
    assert.equal(r.nombre, pais(id).capital); // se enseña bien escrito, no como lo ha escrito el reconocimiento
  }
  assert.ok(oido("KZ", "cp", "Kazajstan").ok);
});

test("lo que no se parece claramente a nada no es ni acierto ni fallo: se sigue escuchando", () => {
  for (const dicho of ["zapato rojo", "agua de agua", "mesa"]) {
    const r = oido("BF", "pc", dicho);
    assert.ok(!r.ok && r.dudoso, `«${dicho}»: ${JSON.stringify(r)}`);
  }
  // Riad y Riga se parecen igual a «ría»: no se decide
  assert.ok(oido("SA", "pc", "ría").dudoso);
  assert.ok(oido("LV", "pc", "ría").dudoso);
});

test("otro país u otra capital es un fallo", () => {
  const r = oido("TG", "pc", "Roma");
  assert.ok(!r.ok && !r.dudoso);
  assert.equal(r.comoCapital.id, "IT");
  assert.ok(!oido("SN", "pc", "Daca").ok); // Daca es la capital de Bangladés
  assert.ok(!oido("IQ", "cp", "Irán").ok);
  assert.ok(!oido("AT", "cp", "Australia").ok);
  assert.ok(!oido("NE", "cp", "Nigeria").ok);
  // Claramente parecido a otra capital (aunque mal escrito) también es fallo, con el nombre bien escrito
  const casi = oido("FR", "pc", "Berlim");
  assert.ok(!casi.ok && !casi.dudoso && casi.comoCapital.id === "DE" && casi.texto === "Berlín", JSON.stringify(casi));
});

test("dos nombres que suenan casi igual no se distinguen de oído: vale cualquiera", () => {
  assert.ok(oido("VC", "pc", "Kingston").ok); // la capital de San Vicente es Kingstown
  assert.ok(oido("JM", "pc", "Kingstown").ok);
  assert.ok(oido("MV", "pc", "Malí").ok); // la capital de Maldivas es Malé
  assert.ok(oido("TL", "pc", "Delhi").ok); // la capital de Timor Oriental es Dili
});

test("ninguna capital se da por buena para otro país, ni ningún país por otro (salvo los que suenan igual)", () => {
  const igual = new Set(["IN←TL", "TL←IN", "JM←VC", "VC←JM"]);
  for (const p of PAISES) {
    for (const q of PAISES) {
      if (p === q || igual.has(`${p.id}←${q.id}`)) continue;
      for (const c of [q.capital, ...q.capitalAlt]) assert.ok(!T.juzgarVoz([c], { p, dir: "pc" }).ok, `«${c}» aceptada como capital de ${p.pais}`);
      for (const n of [q.pais, ...q.paisAlt]) assert.ok(!T.juzgarVoz([n], { p, dir: "cp" }).ok, `«${n}» aceptado en lugar de ${p.pais}`);
    }
    assert.ok(T.juzgarVoz([p.capital], { p, dir: "pc" }).ok, p.capital);
    assert.ok(T.juzgarVoz([p.pais], { p, dir: "cp" }).ok, p.pais);
  }
});

test("a medias solo vale si no hay ninguna duda", () => {
  assert.ok(aMedias("ES", "pc", "Madrid").ok);
  assert.ok(aMedias("ES", "pc", "Mad").espera);
  assert.ok(aMedias("BF", "pc", "agua dugu").espera); // parecido, pero no inequívoco: se espera al final
  assert.ok(aMedias("GN", "cp", "Guinea").espera); // aún puede venir «Guinea Ecuatorial»
  assert.ok(oido("GN", "cp", "Guinea").ok); // terminada la frase, sí
  assert.ok(aMedias("SS", "cp", "Sudán del Sur").ok);
  assert.ok(aMedias("SD", "cp", "Sudán").espera);
  assert.ok(aMedias("FR", "pc", "Berlín").espera); // a medias nunca se da un fallo
});

test("encuentra la respuesta dentro de una frase y entre varias interpretaciones", () => {
  assert.ok(oido("FR", "pc", "la capital es París").ok);
  assert.ok(oido("FR", "pc", "pues creo que es parís").ok);
  assert.ok(oido("PE", "pc", "lima, perú").ok);
  // La primera interpretación es otra cosa, pero una de las siguientes es la buena: cuenta como acierto.
  assert.ok(oido("CH", "pc", "Verna", "Berna").ok);
});

test("lo que solo son muletillas queda vacío y «no sé» pasa la pregunta", () => {
  assert.ok(T.juzgarVoz(["", "  "], { p: pais("FR"), dir: "pc" }).vacia);
  assert.ok(T.juzgarVoz(["eh", "pues", "a"], { p: pais("FR"), dir: "pc" }).vacia);
  for (const dicho of ["No sé.", "no lo sé", "Paso", "ni idea", "me rindo", "pues no sé"]) assert.ok(T.esNoSe([dicho]), dicho);
  for (const dicho of ["no sé si es París", "París", "Nosotros"]) assert.ok(!T.esNoSe([dicho]), dicho);
});

test("en el modo de 4 opciones se puede decir el número o el nombre", () => {
  const opciones = ["PT", "ES", "VA", "MC"].map(pais);
  const nombres = (o) => [o.capital, ...o.capitalAlt];
  const elegida = (dicho, temprano = false) => T.opcionDicha([dicho], opciones, nombres, { temprano });
  assert.equal(elegida("la dos"), 1);
  assert.equal(elegida("2"), 1);
  assert.equal(elegida("la primera"), 0);
  assert.equal(elegida("opción cuatro"), 3);
  assert.equal(elegida("Madrid"), 1);
  assert.equal(elegida("vaticano"), 2);
  assert.equal(elegida("Lisbon"), 0);
  assert.equal(elegida("Mónaco"), 3);
  assert.equal(elegida("París"), -1); // no es ninguna de las cuatro
  assert.equal(elegida("dos", true), 1); // a medias, solo si se oye exacto
  assert.equal(elegida("Lisbo", true), -1);
});
