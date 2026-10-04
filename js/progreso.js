/* Capitales del mundo — progreso que se recuerda entre sesiones:
   la maratón (cada país hay que acertarlo tres veces seguidas), el historial de rondas
   y la copia de seguridad en JSON. Sin DOM: se usa en el navegador (window.PROGRESO)
   y en las pruebas de Node. */
(function (global) {
  "use strict";

  const VERSION = 1;
  /** Aciertos seguidos que hacen falta para dominar un país. */
  const OBJETIVO = 3;
  /**
   * Preguntas que tienen que pasar antes de volver a preguntar un país, según cómo fue la última vez:
   * un fallo vuelve pronto; con un acierto, más tarde; con dos, más tarde todavía.
   */
  const HUECOS = { 0: 3, 1: 6, 2: 14 };
  const MAX_HISTORIAL = 500;

  const esObjeto = (x) => !!x && typeof x === "object" && !Array.isArray(x);
  const entero = (x, min, max, porDefecto = min) => {
    const n = Math.round(Number(x));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : porDefecto;
  };

  /* ------------------------------------------------------------------
     Maratón
     ------------------------------------------------------------------ */
  function crearMaraton({ ids, dir, modo, zona, taiwan = false }, ahora = new Date()) {
    const paises = {};
    for (const id of ids) paises[id] = { racha: 0, proxima: null, aciertos: 0, fallos: 0 };
    return {
      version: VERSION, creada: ahora.toISOString(), actualizada: ahora.toISOString(),
      dir, modo, zona, taiwan: !!taiwan,
      turno: 0, aciertos: 0, fallos: 0, segundos: 0, ultimo: null, paises,
    };
  }

  const pendientes = (m) => Object.keys(m.paises).filter((id) => m.paises[id].racha < OBJETIVO);
  const total = (m) => Object.keys(m.paises).length;
  const dominados = (m) => total(m) - pendientes(m).length;
  /** Países empezados pero sin dominar (llevan 1 o 2 aciertos seguidos). */
  const enCamino = (m) => Object.values(m.paises).filter((e) => e.racha > 0 && e.racha < OBJETIVO).length;

  /**
   * Elige el país de la siguiente pregunta:
   * 1. los que ya toca repasar (los más atrasados primero, con algo de azar entre ellos);
   * 2. si no toca ninguno, uno nuevo al azar;
   * 3. si no quedan nuevos y aún no toca ninguno (grupos pequeños), el que antes toque.
   * Nunca repite el mismo país dos veces seguidas si queda otro.
   */
  function siguienteId(m, azar = Math.random) {
    const pend = pendientes(m);
    if (!pend.length) return null;
    const otros = pend.length > 1 ? pend.filter((id) => id !== m.ultimo) : pend;
    const vistos = otros.filter((id) => m.paises[id].proxima !== null)
      .sort((a, b) => m.paises[a].proxima - m.paises[b].proxima);
    const tocan = vistos.filter((id) => m.paises[id].proxima <= m.turno);
    if (tocan.length) {
      const grupo = tocan.slice(0, 3);
      return grupo[Math.floor(azar() * grupo.length)];
    }
    const nuevos = otros.filter((id) => m.paises[id].proxima === null);
    if (nuevos.length) return nuevos[Math.floor(azar() * nuevos.length)];
    return vistos[0];
  }

  /**
   * Apunta la respuesta a un país.
   * resultado: "acierto" (suma uno), "pista" (acierto con pista: ni suma ni resta) o "fallo" (vuelve a 0).
   * Devuelve { antes, despues, dominado } con los aciertos seguidos antes y después.
   */
  function registrarRespuesta(m, id, resultado, azar = Math.random, ahora = new Date()) {
    const e = m.paises[id];
    const antes = e.racha;
    m.turno++;
    if (resultado === "fallo") {
      e.racha = 0;
      e.fallos++;
      m.fallos++;
    } else {
      e.aciertos++;
      m.aciertos++;
      if (resultado === "acierto") e.racha = Math.min(OBJETIVO, e.racha + 1);
    }
    const hueco = HUECOS[e.racha] ?? HUECOS[0];
    e.proxima = m.turno + Math.max(2, Math.round(hueco * (0.8 + azar() * 0.4)));
    if (e.racha >= OBJETIVO && antes < OBJETIVO) e.dominado = ahora.toISOString();
    m.ultimo = id;
    m.actualizada = ahora.toISOString();
    return { antes, despues: e.racha, dominado: e.racha >= OBJETIVO };
  }

  /** Los países que más fallos han acumulado (para el resumen final). */
  function masFallados(m, n = 10) {
    return Object.entries(m.paises)
      .filter(([, e]) => e.fallos > 0)
      .sort((a, b) => b[1].fallos - a[1].fallos || a[0].localeCompare(b[0]))
      .slice(0, n)
      .map(([id, e]) => ({ id, fallos: e.fallos }));
  }

  /** Resumen de una maratón terminada, para el historial. */
  function resumenMaraton(m, ahora = new Date()) {
    return {
      creada: m.creada, terminada: ahora.toISOString(), dir: m.dir, modo: m.modo, zona: m.zona,
      paises: total(m), preguntas: m.turno, aciertos: m.aciertos, fallos: m.fallos, segundos: Math.round(m.segundos),
    };
  }

  /* ------------------------------------------------------------------
     Copia de seguridad (JSON)
     ------------------------------------------------------------------ */
  function exportar({ ajustes, records, historial, maraton, maratones }, ahora = new Date()) {
    return {
      app: "capitales", version: VERSION, exportado: ahora.toISOString(),
      ajustes: ajustes || null, records: records || {}, historial: historial || [],
      maraton: maraton || null, maratones: maratones || [],
    };
  }

  function limpiarMaraton(m, idsValidos) {
    const valida = esObjeto(m) && ["pc", "cp"].includes(m.dir) && ["escribir", "opciones"].includes(m.modo) &&
      typeof m.zona === "string" && esObjeto(m.paises);
    if (!valida) return null;
    const paises = {};
    for (const [id, e] of Object.entries(m.paises)) {
      if (!idsValidos.has(id) || !esObjeto(e)) continue;
      paises[id] = {
        racha: entero(e.racha, 0, OBJETIVO),
        proxima: e.proxima === null || e.proxima === undefined ? null : entero(e.proxima, 0, 1e7),
        aciertos: entero(e.aciertos, 0, 1e7),
        fallos: entero(e.fallos, 0, 1e7),
        ...(typeof e.dominado === "string" ? { dominado: e.dominado } : {}),
      };
    }
    if (!Object.keys(paises).length) return null;
    return {
      version: VERSION,
      creada: typeof m.creada === "string" ? m.creada : new Date().toISOString(),
      actualizada: typeof m.actualizada === "string" ? m.actualizada : new Date().toISOString(),
      dir: m.dir, modo: m.modo, zona: m.zona.slice(0, 40), taiwan: !!m.taiwan,
      turno: entero(m.turno, 0, 1e7), aciertos: entero(m.aciertos, 0, 1e7), fallos: entero(m.fallos, 0, 1e7),
      segundos: entero(m.segundos, 0, 1e9), ultimo: idsValidos.has(m.ultimo) ? m.ultimo : null, paises,
    };
  }

  /**
   * Comprueba un archivo de copia. Devuelve { ok: true, datos } o { ok: false, error },
   * con el error explicado para el jugador. Descarta lo que no reconoce en vez de fallar.
   */
  function validar(entrada, idsValidos) {
    let d = entrada;
    if (typeof entrada === "string") {
      try { d = JSON.parse(entrada); } catch { return { ok: false, error: "El archivo no es un JSON válido." }; }
    }
    if (!esObjeto(d) || d.app !== "capitales") return { ok: false, error: "Este archivo no es una copia del juego de capitales." };
    if (typeof d.version !== "number" || d.version > VERSION) {
      return { ok: false, error: "Esta copia es de una versión más nueva del juego. Recarga la página e inténtalo otra vez." };
    }
    let maraton = null;
    if (d.maraton != null) {
      maraton = limpiarMaraton(d.maraton, idsValidos);
      if (!maraton) return { ok: false, error: "La maratón guardada en el archivo está dañada." };
    }
    return {
      ok: true,
      datos: {
        exportado: typeof d.exportado === "string" ? d.exportado : null,
        ajustes: esObjeto(d.ajustes) ? d.ajustes : null,
        records: esObjeto(d.records) ? d.records : {},
        historial: Array.isArray(d.historial) ? d.historial.filter(esObjeto).slice(-MAX_HISTORIAL) : [],
        maraton,
        maratones: Array.isArray(d.maratones) ? d.maratones.filter(esObjeto).slice(-100) : [],
      },
    };
  }

  global.PROGRESO = {
    VERSION, OBJETIVO, HUECOS, MAX_HISTORIAL,
    crearMaraton, siguienteId, registrarRespuesta, pendientes, dominados, enCamino, total,
    masFallados, resumenMaraton, exportar, validar,
  };
})(typeof window !== "undefined" ? window : globalThis);
