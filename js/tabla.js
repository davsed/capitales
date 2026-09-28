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

  /** Distancia de Damerau-Levenshtein (alineamiento óptimo de cadenas). */
  function distancia(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 3;
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

  /** Distancia en kilómetros entre las capitales de dos países (fórmula del haverseno). */
  function distanciaKm(a, b) {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad;
    const dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  global.TABLA = { normalizar, variantes, capitalDe, paisDe, evaluar, distancia, distanciaKm, ARTICULO };
})(typeof window !== "undefined" ? window : globalThis);
