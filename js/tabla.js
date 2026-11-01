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
      .replace(/sh/g, "s").replace(/ch/g, "C").replace(/kh/g, "j").replace(/ph/g, "f").replace(/th/g, "t")
      .replace(/ou/g, "u").replace(/w/g, "u")
      .replace(/gu([ei])/g, "G$1").replace(/g([ei])/g, "j$1").replace(/G/g, "g")
      .replace(/qu/g, "k").replace(/c([ei])/g, "s$1").replace(/c/g, "k")
      .replace(/ll/g, "y").replace(/v/g, "b").replace(/z/g, "s").replace(/h/g, "")
      .replace(/y(?![aeiou])/g, "i")
      .replace(/(.)\1+/g, "$1");
  }

  // Muletillas que se dicen antes de la respuesta: «pues…», «creo que es…», «la capital es…»
  const MULETILLAS = /^(?:(?:pues|eh+|em+|m+|uf+|a ver|vale|bueno|creo que|seguro que|yo creo que|sera|seria|es|son|la respuesta es|la capital es|la capital de .{1,40}? es|su capital es|el pais es|es la capital de) )+/;
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
  /** Margen de letras distintas que se tolera al comparar por el sonido: 1 de cada 4. */
  const margen = (clave) => Math.floor(clave.length / 4);

  /** ¿Lo dicho es «no sé», «paso», «ni idea»…? Entonces se pasa la pregunta. */
  const NO_SE = /^(?:no (?:lo )?se|nose|no se cual es|ni idea|no tengo (?:ni )?idea|no tengo ni la mas remota idea|paso|pasar|paso palabra|me rindo|no me acuerdo|no lo recuerdo|no lo se)$/;
  const esNoSe = (alternativas) => alternativas.some((a) => NO_SE.test(sinMuletillas(a)));

  /**
   * Evalúa una respuesta dicha en voz alta. «alternativas» son las interpretaciones del reconocimiento
   * de voz, de más a menos probable: basta con que una sea correcta. Primero se buscan las grafías
   * aceptadas (también dentro de una frase); después, por cómo suena, siempre que el nombre correcto
   * sea el que más se parece de todos. Devuelve lo mismo que evaluar(), más el texto oído.
   */
  function evaluarVoz(alternativas, pregunta) {
    // Lo que solo son muletillas («eh», «pues») o una letra suelta no es una respuesta: se sigue escuchando.
    const textos = alternativas.map((a) => String(a).trim()).filter((a) => (trozos(a)[0] || "").replace(/ /g, "").length >= 2);
    if (!textos.length) return { ok: false, vacia: true };
    // Lo dicho entero (sin muletillas), y cómo lo evalúa la corrección normal
    const dichos = textos.map((t) => { const entero = trozos(t)[0]; return { t, entero, r: evaluar(entero, pregunta, false) }; });
    const conocido = (d) => d.r.comoCapital || d.r.comoPais; // es otro nombre conocido («Malí» no es «Malé»)
    // 1. Una de las interpretaciones es una grafía aceptada
    for (const d of dichos) if (d.r.ok) return { ...d.r, texto: d.t };
    // 2. La respuesta va dentro de una frase («París, creo»), salvo que lo dicho sea otro nombre («Ciudad de la Paz» no es «La Paz»)
    for (const d of dichos) {
      if (conocido(d)) continue;
      for (const f of trozos(d.t).slice(1)) { const r = evaluar(f, pregunta, false); if (r.ok) return { ...r, texto: d.t }; }
    }
    // 3. Por cómo suena: el nombre correcto tiene que ser el más parecido de todos, sin empate
    const { p, dir } = pregunta;
    const claves = clavesDe(dir === "pc" ? "capital" : "pais");
    for (const d of dichos) {
      if (conocido(d)) continue;
      const k = claveSonora(d.entero);
      if (k.length < 3) continue;
      let mejor = null;
      for (const c of claves) {
        if (c.p !== p) continue;
        const dist = distancia(k, c.clave, margen(c.clave));
        if (dist <= margen(c.clave) && (!mejor || dist < mejor)) mejor = dist;
      }
      if (mejor === null) continue;
      const otroIgual = claves.some((c) => c.p !== p && distancia(k, c.clave, mejor) <= mejor);
      if (!otroIgual) return { ok: true, exacta: true, nombre: dir === "pc" ? p.capital : p.pais, texto: d.t };
    }
    // 4. Fallo. ¿Ha dicho otro país u otra capital? Se cuenta para explicarlo (y dar la distancia).
    for (const d of dichos) if (conocido(d)) return { ...d.r, texto: d.t };
    for (const d of dichos) {
      for (const f of trozos(d.t).slice(1)) { const r = evaluar(f, pregunta, false); if (r.comoCapital || r.comoPais) return { ...r, texto: d.t }; }
    }
    return { ok: false, texto: textos[0] };
  }

  const ORDINALES = [
    ["1", "uno", "una", "primera", "primero"], ["2", "dos", "segunda", "segundo"],
    ["3", "tres", "tercera", "tercero"], ["4", "cuatro", "cuarta", "cuarto"],
  ];
  /**
   * En el modo de 4 opciones: qué opción se ha dicho, por su número («la dos», «3», «la primera»)
   * o por su nombre. «nombresDe(opcion)» da los nombres aceptados de cada opción. Devuelve 0–3, o -1.
   */
  function opcionDicha(alternativas, opciones, nombresDe) {
    for (const a of alternativas) {
      const n = (sinMuletillas(a) + " ").replace(/^(?:(?:la|el|opcion|numero|respuesta) )+/, "").trim();
      const i = ORDINALES.findIndex((lista) => lista.includes(n));
      if (i >= 0 && i < opciones.length) return i;
    }
    for (const a of alternativas) {
      for (const f of trozos(a)) {
        const suyas = variantes(f);
        const i = opciones.findIndex((o) => nombresDe(o).some((n) => [...variantes(n)].some((v) => suyas.has(v))));
        if (i >= 0) return i;
      }
    }
    // Por cómo suena: la opción más parecida, si se parece lo bastante y no empata con otra.
    for (const a of alternativas) {
      const k = claveSonora(sinMuletillas(a));
      if (k.length < 3) continue;
      const d = opciones.map((o) => Math.min(...nombresDe(o).map((n) => { const c = claveSonora(n); return distancia(k, c, margen(c) + 1); })));
      const minimo = Math.min(...d);
      const i = d.indexOf(minimo);
      const limite = margen(claveSonora(nombresDe(opciones[i])[0])) + 1;
      if (minimo <= limite && d.filter((x) => x === minimo).length === 1) return i;
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
    claveSonora, evaluarVoz, esNoSe, opcionDicha,
  };
})(typeof window !== "undefined" ? window : globalThis);
