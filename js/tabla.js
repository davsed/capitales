/* Capitales del mundo — tabla clave-valor bidireccional y corrección de respuestas.
   Sin dependencias del DOM: se usa en el navegador (window.TABLA) y en las pruebas de Node. */
(function (global) {
  "use strict";

  const PAISES = global.PAISES;

  /* ------------------------------------------------------------------
     Normalización de texto y tabla clave-valor bidireccional
     ------------------------------------------------------------------ */
  const ARTICULO = /^(el|la|los|las|the) /;

  function normalizar(texto) {
    return String(texto)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[’'`´ʻ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  /** Variantes comparables de un nombre: con y sin artículo inicial, con y sin espacios. */
  function variantes(texto) {
    const n = normalizar(texto);
    const sinArticulo = n.replace(ARTICULO, "");
    return new Set([n, sinArticulo, n.replace(/ /g, ""), sinArticulo.replace(/ /g, "")]);
  }

  // país → capital y capital → país, indexados por todas las grafías aceptadas.
  const tablaPais = new Map();
  const tablaCapital = new Map();
  for (const p of PAISES) {
    for (const nombre of [p.pais, ...p.paisAlt]) for (const v of variantes(nombre)) if (!tablaPais.has(v)) tablaPais.set(v, p);
    for (const nombre of [p.capital, ...p.capitalAlt]) for (const v of variantes(nombre)) if (!tablaCapital.has(v)) tablaCapital.set(v, p);
  }
  const capitalDe = (pais) => { for (const v of variantes(pais)) if (tablaPais.has(v)) return tablaPais.get(v); return null; };
  const paisDe = (capital) => { for (const v of variantes(capital)) if (tablaCapital.has(v)) return tablaCapital.get(v); return null; };

  /** Distancia de Damerau-Levenshtein (alineamiento óptimo de cadenas). Por encima de «tope» devuelve tope + 1. */
  function distancia(a, b, tope = 2) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > tope) return tope + 1;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const coste = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + coste);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[m][n];
  }

  /**
   * Evalúa una respuesta escrita.
   * dir "pc": se da el país y se pide la capital · dir "cp": se da la capital y se pide el país.
   */
  function evaluar(entrada, pregunta, admitirErratas) {
    const { p, dir } = pregunta;
    const esperadas = dir === "pc" ? [p.capital, ...p.capitalAlt] : [p.pais, ...p.paisAlt];
    const suyas = variantes(entrada);
    if (!normalizar(entrada)) return { ok: false, vacia: true };
    for (const nombre of esperadas) {
      for (const v of variantes(nombre)) if (suyas.has(v)) return { ok: true, exacta: true, nombre };
    }
    // ¿Ha escrito otro país u otra capital? Entonces es un fallo, aunque se parezca (Irak ≠ Irán).
    const comoCapital = paisDe(entrada);
    const comoPais = capitalDe(entrada);
    if (comoCapital || comoPais) return { ok: false, comoCapital, comoPais };
    if (admitirErratas) {
      const a = normalizar(entrada).replace(ARTICULO, "").replace(/ /g, "");
      for (const nombre of esperadas) {
        const b = normalizar(nombre).replace(ARTICULO, "").replace(/ /g, "");
        const limite = b.length >= 8 ? 2 : b.length >= 4 ? 1 : 0;
        if (limite && distancia(a, b) <= limite) return { ok: true, exacta: false, nombre };
      }
    }
    return { ok: false };
  }

  /* ------------------------------------------------------------------
     Respuestas dichas en voz alta
     El reconocimiento de voz escribe los nombres a su manera («Wagadugu», «Yamoussoukro»,
     «la capital es París»), así que se comparan por cómo suenan en español.
     ------------------------------------------------------------------ */

  /** Clave de cómo suena un nombre: dos grafías que se pronuncian igual dan la misma clave. */
  function claveSonora(texto) {
    return normalizar(texto).replace(ARTICULO, "").replace(/ /g, "")
      .replace(/igh/g, "ai").replace(/ng(?![aeiou])/g, "n") // a la inglesa: «night» suena «nait», «kingsensa», «kinsensa»
      .replace(/sh/g, "s").replace(/ch/g, "C").replace(/kh/g, "j").replace(/ph/g, "f").replace(/th/g, "t")
      .replace(/ou/g, "u").replace(/w/g, "u")
      .replace(/gu([ei])/g, "G$1").replace(/g([ei])/g, "j$1").replace(/G/g, "g")
      .replace(/qu/g, "k").replace(/c([ei])/g, "s$1").replace(/c/g, "k")
      .replace(/ll(?=[aeiou])/g, "y").replace(/ll/g, "l").replace(/v/g, "b").replace(/z/g, "s").replace(/h/g, "")
      .replace(/y(?![aeiou])/g, "i")
      .replace(/(.)\1+/g, "$1");
  }

  // Muletillas que se dicen antes de la respuesta: «pues…», «creo que es…», «la capital es…»
  const MULETILLAS = /^(?:(?:pues|eh+|em+|m+|uf+|a ver|bueno|creo que|seguro que|yo creo que|sera|seria|es|son|la respuesta es|la capital es|la capital de .{1,40}? es|su capital es|el pais es|es la capital de) )+/;
  const sinMuletillas = (texto) => (normalizar(texto) + " ").replace(MULETILLAS, "").trim();
  /** Lo dicho y sus trozos (de 1 a 4 palabras), para encontrar la respuesta dentro de una frase. */
  function trozos(texto) {
    const limpio = sinMuletillas(texto);
    const palabras = limpio.split(" ").filter(Boolean);
    const lista = [limpio];
    for (let largo = Math.min(4, palabras.length - 1); largo >= 1; largo--) {
      for (let i = 0; i + largo <= palabras.length; i++) lista.push(palabras.slice(i, i + largo).join(" "));
    }
    return [...new Set(lista.filter(Boolean))];
  }

  // Claves sonoras de todas las capitales y de todos los países (se calculan la primera vez que hacen falta)
  let clavesPorTipo = null;
  function clavesDe(tipo) {
    if (!clavesPorTipo) {
      clavesPorTipo = { capital: [], pais: [] };
      for (const p of PAISES) {
        for (const n of [p.capital, ...p.capitalAlt]) clavesPorTipo.capital.push({ p, nombre: n, clave: claveSonora(n) });
        for (const n of [p.pais, ...p.paisAlt]) clavesPorTipo.pais.push({ p, nombre: n, clave: claveSonora(n) });
      }
    }
    return clavesPorTipo[tipo];
  }
  // Sonidos que el reconocimiento de voz confunde a menudo: cambiar uno por otro cuesta menos que una letra distinta.
  const CONFUNDIBLES = new Set(["ei", "ou", "bp", "dt", "gk", "gj", "mn", "iy"].flatMap((x) => [x, x[1] + x[0]]));
  /** Distancia entre dos claves sonoras (Damerau-Levenshtein con los sonidos confundibles a 0,4). */
  function distanciaSonora(a, b) {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const x = a[i - 1], y = b[j - 1];
        const coste = x === y ? 0 : CONFUNDIBLES.has(x + y) ? 0.4 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + coste);
        if (i > 1 && j > 1 && x === b[j - 2] && a[i - 2] === y) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[m][n];
  }
  /** Cuánto se parecen dos claves sonoras, de 0 (nada) a 1 (suenan igual). */
  const parecido = (a, b) => 1 - distanciaSonora(a, b) / Math.max(a.length, b.length, 1);

  /**
   * Lista cerrada: entre todos los nombres posibles (todas las capitales, o todos los países), los países
   * cuyo nombre más se parece a lo oído, del más parecido al menos, con su parecido.
   */
  function masParecidos(oido, tipo) {
    const k = claveSonora(oido);
    const mejor = new Map(); // país → parecido de su nombre más cercano
    for (const c of clavesDe(tipo)) {
      const s = parecido(k, c.clave);
      if (s > (mejor.get(c.p) || 0)) mejor.set(c.p, s);
    }
    return [...mejor].map(([p, s]) => ({ p, s })).sort((x, y) => y.s - x.s);
  }
  // Para dar por buena una respuesta por cómo suena: que la correcta sea la más parecida de la lista,
  // que se parezca lo bastante y que se distinga de la segunda (Riad y Riga se confunden: entonces, no).
  // Elegidos simulando miles de errores de reconocimiento, sin aceptar lo que solo se parece «un poco»:
  // con un error en el nombre se acepta el 96 %; con dos, el 84 %. Lo que no se parece claramente a nada
  // no es ni acierto ni fallo: se sigue escuchando. Lo oído a medias solo vale si no hay ninguna duda.
  // Dos nombres que suenan casi igual (Kingston y Kingstown, Malí y Malé) no se pueden distinguir de oído:
  // si se oye el otro, vale. En las 4 opciones se pide más, porque entre cuatro nombres el más parecido dice menos.
  const VOZ = { umbral: 0.7, trozo: 0.8, margen: 0.08, umbralClaro: 0.6, trozoClaro: 0.68, margenClaro: 0.14, temprano: 0.85, otro: 0.8, homofono: 0.87, umbralOpciones: 0.6, margenOpciones: 0.1 };

  /** ¿Lo dicho es «no sé», «paso», «ni idea»…? Entonces se pasa la pregunta. */
  const NO_SE = /^(?:no (?:lo )?se|nose|no se cual es|ni idea|no tengo (?:ni )?idea|no tengo ni la mas remota idea|paso|pasar|paso palabra|me rindo|no me acuerdo|no lo recuerdo|no lo se)$/;
  const esNoSe = (alternativas) => alternativas.some((a) => NO_SE.test(sinMuletillas(a)));

  /** «kigalikigalikigali» → «kigali»: el reconocimiento a veces repite una palabra pegada a sí misma. */
  function sinRepetir(palabra) {
    for (let n = 3; n <= palabra.length / 2; n++) {
      const u = palabra.slice(0, n);
      if (palabra.length % n === 0 && u.repeat(palabra.length / n) === palabra) return u;
    }
    return palabra;
  }
  /**
   * Quita del principio de lo oído el nombre que se pregunta («Micronesia paliquir» → «paliquir»): el micrófono
   * oye la lectura de la pregunta, o el jugador la repite antes de contestar. También «país» o «capital».
   */
  function sinEco(texto, preguntado) {
    let palabras = normalizar(texto).split(" ").filter(Boolean).map(sinRepetir);
    if (palabras[0] === "pais" || palabras[0] === "capital") palabras = palabras.slice(1);
    const clave = claveSonora(preguntado);
    const n = normalizar(preguntado).split(" ").length;
    for (let k = Math.min(palabras.length, n); k >= 1; k--) {
      if (parecido(claveSonora(palabras.slice(0, k).join(" ")), clave) >= 0.8) { palabras = palabras.slice(k); break; }
    }
    return palabras.join(" ");
  }

  /** Lo dicho entero (sin muletillas) y cómo lo evalúa la corrección normal. Las muletillas solas no cuentan. */
  const preparar = (lista, pregunta) => lista.map((a) => String(a).trim())
    .filter((t) => (trozos(t)[0] || "").replace(/ /g, "").length >= 2)
    .map((t) => { const entero = trozos(t)[0]; return { t, entero, r: evaluar(entero, pregunta, false) }; });
  /** ¿Es otro nombre conocido, otro país u otra capital? («Malí» no es «Malé».) */
  const conocido = (d) => !!(d.r.comoCapital || d.r.comoPais);

  // Nombres que son el principio de otro de la misma lista («Guinea» → «Guinea Ecuatorial», «Sudán» → «Sudán
  // del Sur»): oídos a medias no valen todavía, porque la frase puede seguir.
  let prefijos = null;
  function esPrincipioDeOtro(p, tipo) {
    if (!prefijos) {
      prefijos = { capital: new Set(), pais: new Set() };
      for (const t of ["capital", "pais"]) {
        const nombres = clavesDe(t).map((c) => ({ p: c.p, n: normalizar(c.nombre).replace(ARTICULO, "") }));
        for (const a of nombres) if (nombres.some((b) => b.p !== a.p && b.n.startsWith(a.n + " "))) prefijos[t].add(a.p);
      }
    }
    return prefijos[tipo].has(p);
  }

  /**
   * Juzga lo oído para una pregunta. «alternativas»: las interpretaciones del reconocimiento de voz, de más
   * a menos probable (basta con que una sea correcta). Devuelve:
   *   { ok: true, nombre, texto }        acierto («nombre»: cómo se escribe bien)
   *   { ok: false, comoCapital | comoPais, texto }   ha dicho otro nombre de la lista: fallo
   *   { dudoso: true, texto }            no se parece claramente a ningún nombre: se sigue escuchando
   *   { vacia: true }                    solo muletillas («eh», «pues»)
   * Con «temprano» (lo oído aún a medias) solo da un acierto si es inequívoco; si no, { espera: true }.
   */
  function juzgarVoz(alternativas, pregunta, { temprano = false } = {}) {
    const { p, dir } = pregunta;
    // El micrófono suele oír también la pregunta (la lectura, o el propio jugador repitiéndola): se quita
    const limpias = alternativas.map((a) => (evaluar(a, pregunta, false).ok ? a : sinEco(a, dir === "pc" ? p.pais : p.capital)));
    const dichos = preparar(limpias, pregunta);
    if (!dichos.length) return temprano ? { espera: true } : { ok: false, vacia: true };
    const tipo = dir === "pc" ? "capital" : "pais";
    const nombre = dir === "pc" ? p.capital : p.pais;
    const acierto = (d) => ({ ok: true, exacta: true, nombre, texto: d.t });
    const puedeSeguir = temprano && esPrincipioDeOtro(p, tipo);
    // 1. Una de las interpretaciones es una grafía aceptada
    for (const d of dichos) if (d.r.ok && !puedeSeguir) return acierto(d);
    // 2. La respuesta va dentro de una frase («creo que es Lima»), salvo que lo dicho sea otro nombre
    if (!temprano) {
      for (const d of dichos) {
        if (conocido(d)) continue;
        for (const f of trozos(d.t).slice(1)) if (evaluar(f, pregunta, false).ok) return acierto(d);
      }
    }
    // 3. Lista cerrada: el nombre más parecido de todos tiene que ser el correcto, claramente
    const clavesCorrectas = clavesDe(tipo).filter((c) => c.p === p).map((c) => c.clave);
    for (const d of dichos) {
      const k = claveSonora(d.entero);
      if (k.length < 3) continue;
      if (conocido(d)) {
        // Ha dicho otro nombre de la lista: solo vale si suena casi igual que el correcto (Kingston/Kingstown)
        if (!temprano && Math.max(...clavesCorrectas.map((c) => parecido(k, c))) >= VOZ.homofono) return acierto(d);
        continue;
      }
      const [a, b] = masParecidos(d.entero, tipo);
      // Vale si se parece mucho, o algo menos pero con mucha ventaja sobre el segundo (Astaná ← «hasta»)
      const ventaja = a.s - (b ? b.s : 0);
      const claro = a.p === p && (temprano ? a.s >= VOZ.temprano && ventaja >= VOZ.margen
        : (a.s >= VOZ.umbral && ventaja >= VOZ.margen) || (a.s >= VOZ.umbralClaro && ventaja >= VOZ.margenClaro));
      if (claro && !puedeSeguir) return acierto(d);
    }
    if (temprano) return { espera: true };
    // 3b. Un trozo de la frase suena claramente a la respuesta («base TR va a setr base terre» → Basseterre).
    //     Con un listón más alto que la frase entera, porque entre muchos trozos alguno se parece por casualidad.
    for (const d of dichos) {
      if (conocido(d)) continue;
      for (const f of trozos(d.t).slice(1)) {
        if (claveSonora(f).length < 4 || conocido({ r: evaluar(f, pregunta, false) })) continue;
        const [a, b] = masParecidos(f, tipo);
        const ventaja = a.s - (b ? b.s : 0);
        if (a.p === p && ((a.s >= VOZ.trozo && ventaja >= VOZ.margen) || (a.s >= VOZ.trozoClaro && ventaja >= VOZ.margenClaro))) return acierto(d);
      }
    }
    // 4. Fallo: ha dicho otro nombre de la lista (tal cual, dentro de una frase o claramente parecido)
    for (const d of dichos) if (conocido(d)) return { ...d.r, texto: d.t };
    for (const d of dichos) {
      for (const f of trozos(d.t).slice(1)) { const r = evaluar(f, pregunta, false); if (r.comoCapital || r.comoPais) return { ...r, texto: d.t }; }
    }
    for (const d of dichos) {
      if (claveSonora(d.entero).length < 3) continue;
      const [a, b] = masParecidos(d.entero, tipo);
      if (a.p !== p && a.s >= VOZ.otro && a.s - (b ? b.s : 0) >= VOZ.margen) {
        return { ok: false, [dir === "pc" ? "comoCapital" : "comoPais"]: a.p, texto: dir === "pc" ? a.p.capital : a.p.pais };
      }
    }
    return { dudoso: true, texto: dichos[0].t };
  }

  const ORDINALES = [
    ["1", "uno", "una", "primera", "primero"], ["2", "dos", "segunda", "segundo"],
    ["3", "tres", "tercera", "tercero"], ["4", "cuatro", "cuarta", "cuarto"],
  ];
  /**
   * En el modo de 4 opciones: qué opción se ha dicho, por su número («la dos», «3», «la primera»)
   * o por su nombre. «nombresDe(opcion)» da los nombres aceptados de cada opción. Devuelve 0–3, o -1.
   */
  function opcionDicha(alternativas, opciones, nombresDe, { temprano = false } = {}) {
    for (const a of alternativas) {
      const n = (sinMuletillas(a) + " ").replace(/^(?:(?:la|el|opcion|numero|respuesta) )+/, "").trim();
      const i = ORDINALES.findIndex((lista) => lista.includes(n));
      if (i >= 0 && i < opciones.length) return i;
    }
    for (const a of alternativas) {
      for (const f of temprano ? trozos(a).slice(0, 1) : trozos(a)) {
        const suyas = variantes(f);
        const i = opciones.findIndex((o) => nombresDe(o).some((n) => [...variantes(n)].some((v) => suyas.has(v))));
        if (i >= 0) return i;
      }
    }
    if (temprano) return -1;
    // Por cómo suena: la más parecida de las cuatro, si se parece lo bastante y se distingue de las demás.
    for (const a of alternativas) {
      const k = claveSonora(sinMuletillas(a));
      if (k.length < 3) continue;
      const s = opciones.map((o) => Math.max(...nombresDe(o).map((n) => parecido(k, claveSonora(n)))));
      const orden = [...s].sort((x, y) => y - x);
      if (orden[0] >= VOZ.umbralOpciones && orden[0] - (orden[1] || 0) >= VOZ.margenOpciones) return s.indexOf(orden[0]);
    }
    return -1;
  }

  /** Distancia en kilómetros entre las capitales de dos países (fórmula del haverseno). */
  function distanciaKm(a, b) {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  global.TABLA = {
    normalizar, variantes, capitalDe, paisDe, evaluar, distancia, distanciaKm, ARTICULO,
    claveSonora, parecido, masParecidos, juzgarVoz, esNoSe, opcionDicha, VOZ,
  };
})(typeof window !== "undefined" ? window : globalThis);
