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
   * La maratón va por vueltas: en cada vuelta salen, en un orden aleatorio nuevo, todos los países que
   * quedan por dominar. Un país acertado espera a la vuelta siguiente; uno fallado vuelve dentro de la
   * misma vuelta, entre estas posiciones más adelante (al azar).
   */
  const REPETIR_FALLO = [3, 8];
  /** Países distintos que tienen que salir, como mínimo, entre dos apariciones del mismo país. */
  const SEPARACION = 3;
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
    for (const id of ids) paises[id] = { racha: 0, aciertos: 0, fallos: 0 };
    return {
      version: VERSION, creada: ahora.toISOString(), actualizada: ahora.toISOString(),
      dir, modo, zona, taiwan: !!taiwan,
      turno: 0, aciertos: 0, fallos: 0, segundos: 0, ultimo: null, recientes: [], vuelta: 0, cola: [], paises,
    };
  }

  function barajar(lista, azar) {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const entre = ([min, max], azar) => min + Math.floor(azar() * (max - min + 1));

  const pendientes = (m) => Object.keys(m.paises).filter((id) => m.paises[id].racha < OBJETIVO);
  const total = (m) => Object.keys(m.paises).length;
  const dominados = (m) => total(m) - pendientes(m).length;
  /** Países empezados pero sin dominar (llevan 1 o 2 aciertos seguidos). */
  const enCamino = (m) => Object.values(m.paises).filter((e) => e.racha > 0 && e.racha < OBJETIVO).length;

  /**
   * Deja lista la cola de la vuelta en curso: quita los países ya dominados y, si la vuelta se ha
   * acabado (o le quedan tan pocos que no se pueden separar), empieza otra con los que quedan en un orden
   * aleatorio nuevo. Aparta del principio los países que acaban de salir, para que entre dos apariciones
   * del mismo país salgan al menos SEPARACION países distintos (o todos los que queden, si son menos).
   */
  function prepararCola(m, azar) {
    const pend = pendientes(m);
    const quedan = new Set(pend);
    const k = Math.min(SEPARACION, pend.length - 1);
    const recientes = (Array.isArray(m.recientes) ? m.recientes : m.ultimo ? [m.ultimo] : [])
      .filter((id) => quedan.has(id)).slice(0, k);
    m.cola = [...new Set(Array.isArray(m.cola) ? m.cola : [])].filter((id) => quedan.has(id));
    // Posición mínima de cada país que acaba de salir: el último necesita k países por delante;
    // el penúltimo ya tiene uno entre medias, así que le bastan k − 1; y así sucesivamente.
    const minimo = new Map(recientes.map((id, q) => [id, k - q]));
    const posMin = (id) => minimo.get(id) || 0;
    // Coloca los primeros puestos uno a uno: en cada hueco, el primer país de la cola que ya puede ir ahí.
    const ordenar = (cola) => {
      const delante = [], resto = [...cola];
      while (resto.length && delante.length < k) {
        const i = resto.findIndex((id) => posMin(id) <= delante.length);
        if (i < 0) return null;
        delante.push(resto.splice(i, 1)[0]);
      }
      return [...delante, ...resto];
    };
    const encadenar = () => {
      const enCola = new Set(m.cola);
      m.cola = [...m.cola, ...barajar(pend.filter((id) => !enCola.has(id)), azar)];
      m.vuelta = (m.vuelta || 0) + 1;
    };
    if (!m.cola.length) encadenar();
    let ordenada = ordenar(m.cola);
    // Si la vuelta es tan corta que no deja separar a los que acaban de salir, se encadena la siguiente.
    if (!ordenada && pend.length > m.cola.length) { encadenar(); ordenada = ordenar(m.cola); }
    m.cola = ordenada || [...m.cola].sort((a, b) => posMin(a) - posMin(b));
  }

  /** País de la siguiente pregunta (o null si ya están todos dominados). */
  function siguienteId(m, azar = Math.random) {
    if (!pendientes(m).length) return null;
    prepararCola(m, azar);
    return m.cola[0];
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
    m.cola = (Array.isArray(m.cola) ? m.cola : []).filter((x) => x !== id);
    if (resultado === "fallo") {
      e.racha = 0;
      e.fallos++;
      m.fallos++;
    } else {
      e.aciertos++;
      m.aciertos++;
      if (resultado === "acierto") e.racha = Math.min(OBJETIVO, e.racha + 1);
    }
    // Fallado: vuelve dentro de esta vuelta, unas preguntas más adelante. Acertado: espera a la siguiente vuelta.
    if (resultado === "fallo") m.cola.splice(Math.min(m.cola.length, entre(REPETIR_FALLO, azar)), 0, id);
    if (e.racha >= OBJETIVO && antes < OBJETIVO) e.dominado = ahora.toISOString();
    m.ultimo = id;
    m.recientes = [id, ...(Array.isArray(m.recientes) ? m.recientes : []).filter((x) => x !== id)].slice(0, SEPARACION);
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
      segundos: entero(m.segundos, 0, 1e9), ultimo: idsValidos.has(m.ultimo) ? m.ultimo : null,
      recientes: Array.isArray(m.recientes) ? m.recientes.filter((id) => idsValidos.has(id)).slice(0, SEPARACION) : [],
      vuelta: entero(m.vuelta, 0, 1e6),
      // Las maratones guardadas antes de las vueltas no traen cola: empiezan una vuelta nueva al seguir.
      cola: Array.isArray(m.cola) ? [...new Set(m.cola)].filter((id) => paises[id] && paises[id].racha < OBJETIVO) : [],
      paises,
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
    VERSION, OBJETIVO, REPETIR_FALLO, SEPARACION, MAX_HISTORIAL,
    crearMaraton, siguienteId, registrarRespuesta, pendientes, dominados, enCamino, total,
    masFallados, resumenMaraton, exportar, validar,
  };
})(typeof window !== "undefined" ? window : globalThis);
