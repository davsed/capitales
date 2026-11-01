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
const oido = (id, dir, ...alternativas) => T.evaluarVoz(alternativas, { p: pais(id), dir });

test("acepta la respuesta aunque el reconocimiento la escriba a su manera", () => {
  const casos = [
    ["FR", "París"], ["FR", "paris"], ["BF", "Wagadugu"], ["BF", "huaga dugu"], ["CI", "Yamusucro"],
    ["MM", "naipidó"], ["MM", "Nay pi do"], ["TM", "Asjabat"], ["SZ", "Babane"], ["TD", "Llamena"],
    ["TJ", "Dusambe"], ["KP", "Piongyang"], ["PW", "Nguerulmud"], ["SN", "Dacar"], ["IT", "Rome"],
    ["BN", "bandar seri begawan"], ["US", "Washington"],
  ];
  for (const [id, dicho] of casos) assert.ok(oido(id, "pc", dicho).ok, `${pais(id).pais}: «${dicho}»`);
  assert.ok(oido("KZ", "cp", "Kazajstan").ok);
});

test("con la lista cerrada vale lo que más se parece a la respuesta, aunque se oiga mal", () => {
  // El reconocimiento parte palabras, cambia vocales y letras que suenan parecido o se come una sílaba
  const casos = [
    ["SZ", "Babane"], ["BF", "agua dugu"], ["KG", "bis quec"], ["TJ", "tu sambé"], ["AM", "e reban"],
    ["OM", "mas cate"], ["NE", "nia mei"], ["TO", "nuku alofa"], ["SB", "oniara"], ["LA", "bien tian"],
    ["KH", "nom pen"], ["MN", "ulam bator"], ["GH", "acra"], ["MW", "lilongue"], ["LS", "masero"],
  ];
  for (const [id, dicho] of casos) assert.ok(oido(id, "pc", dicho).ok, `${pais(id).capital}: «${dicho}»`);
  // Pero no si se parece igual a otra: Riad y Riga
  assert.ok(!oido("SA", "pc", "ría").ok);
  assert.ok(!oido("LV", "pc", "ría").ok);
});

test("lo oído a medias ayuda, salvo que al final se diga otro nombre", () => {
  const q = { p: pais("ES"), dir: "pc" };
  assert.ok(T.evaluarVoz(["mal di"], q, ["Madrid"]).ok); // a medias lo entendió bien
  const guinea = { p: pais("GN"), dir: "cp" };
  assert.ok(!T.evaluarVoz(["Guinea Ecuatorial"], guinea, ["Guinea"]).ok); // al final dijo otro país
  assert.ok(T.evaluarVoz(["Guinea"], guinea, ["Guinea Ecu"]).ok);
});

test("encuentra la respuesta dentro de una frase y entre varias interpretaciones", () => {
  assert.ok(oido("FR", "pc", "la capital es París").ok);
  assert.ok(oido("FR", "pc", "pues creo que es parís").ok);
  assert.ok(oido("PE", "pc", "lima, perú").ok);
  // La primera interpretación es otra cosa, pero una de las siguientes es la buena: cuenta como acierto.
  assert.ok(oido("CH", "pc", "Verna", "Berna").ok);
  const r = oido("FR", "pc", "parís");
  assert.equal(r.texto, "parís"); // se guarda lo oído, para enseñarlo
});

test("otro país u otra capital es un fallo, aunque suene parecido", () => {
  const r = oido("TG", "pc", "Roma");
  assert.ok(!r.ok);
  assert.equal(r.comoCapital.id, "IT");
  assert.ok(!oido("MV", "pc", "Malí").ok); // Malí es un país; la capital de Maldivas es Malé
  assert.ok(!oido("SN", "pc", "Daca").ok); // Daca es la capital de Bangladés
  assert.ok(!oido("IQ", "cp", "Irán").ok);
  assert.ok(!oido("AT", "cp", "Australia").ok);
  assert.ok(!oido("NE", "cp", "Nigeria").ok);
  assert.ok(!oido("FR", "pc", "Lyon").ok);
});

test("ninguna capital se da por buena para otro país, ni ningún país por otro", () => {
  for (const p of PAISES) {
    for (const q of PAISES) {
      if (p === q) continue;
      for (const c of [q.capital, ...q.capitalAlt]) assert.ok(!T.evaluarVoz([c], { p, dir: "pc" }).ok, `«${c}» aceptada como capital de ${p.pais}`);
      for (const n of [q.pais, ...q.paisAlt]) assert.ok(!T.evaluarVoz([n], { p, dir: "cp" }).ok, `«${n}» aceptado en lugar de ${p.pais}`);
    }
    assert.ok(T.evaluarVoz([p.capital], { p, dir: "pc" }).ok, p.capital);
    assert.ok(T.evaluarVoz([p.pais], { p, dir: "cp" }).ok, p.pais);
  }
});

test("lo que no se entiende queda vacío y «no sé» pasa la pregunta", () => {
  assert.ok(T.evaluarVoz(["", "  "], { p: pais("FR"), dir: "pc" }).vacia);
  assert.ok(T.evaluarVoz(["eh", "pues", "a"], { p: pais("FR"), dir: "pc" }).vacia);
  for (const dicho of ["No sé.", "no lo sé", "Paso", "ni idea", "me rindo", "pues no sé"]) assert.ok(T.esNoSe([dicho]), dicho);
  for (const dicho of ["no sé si es París", "París", "Nosotros"]) assert.ok(!T.esNoSe([dicho]), dicho);
});

test("en el modo de 4 opciones se puede decir el número o el nombre", () => {
  const opciones = ["PT", "ES", "VA", "MC"].map(pais);
  const nombres = (o) => [o.capital, ...o.capitalAlt];
  const elegida = (dicho) => T.opcionDicha([dicho], opciones, nombres);
  assert.equal(elegida("la dos"), 1);
  assert.equal(elegida("2"), 1);
  assert.equal(elegida("la primera"), 0);
  assert.equal(elegida("opción cuatro"), 3);
  assert.equal(elegida("Madrid"), 1);
  assert.equal(elegida("vaticano"), 2);
  assert.equal(elegida("Lisbon"), 0);
  assert.equal(elegida("Mónaco"), 3);
  assert.equal(elegida("París"), -1); // no es ninguna de las cuatro
});
