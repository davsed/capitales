/* Capitales del mundo — lógica del juego.
   Depende de window.PAISES y window.CONTINENTES (js/datos.js) y window.MAPA (js/mapa.js). */
(() => {
  "use strict";

  const PAISES = window.PAISES;
  const CONTINENTES = window.CONTINENTES;
  const MAPA = window.MAPA;
  const $ = (s, r = document) => r.querySelector(s);
  const movimientoReducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rutaBandera = (id) => `flags/${id.toLowerCase()}.svg`;

  /* ------------------------------------------------------------------
     Almacenamiento (puede no estar disponible: modo privado, vistas previas…)
     ------------------------------------------------------------------ */
  const almacen = {
    leer(clave, porDefecto) {
      try { const v = localStorage.getItem(clave); return v ? JSON.parse(v) : porDefecto; } catch { return porDefecto; }
    },
    guardar(clave, valor) {
      try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
    },
  };

  const { normalizar, variantes, capitalDe, paisDe, evaluar, distanciaKm, ARTICULO } = window.TABLA;
  const P = window.PROGRESO;

  /* ------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------ */
  function barajar(lista) {
    const a = [...lista];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const formatoTiempo = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const formatoNumero = (n) => n.toLocaleString("es-ES");
  function formatoPoblacion(n) {
    if (!n) return "";
    if (n >= 1e6) return `${(n / 1e6).toLocaleString("es-ES", { maximumFractionDigits: 1 })} millones de habitantes`;
    return `${formatoNumero(Math.round(n / 1000) * 1000)} habitantes`;
  }
  /** Kilómetros redondeados para leer: 3 km, 880 km, 10.470 km. */
  const formatoKm = (km) => (km < 100 ? Math.max(1, Math.round(km)) : Math.round(km / 10) * 10).toLocaleString("es-ES");
  /** «y» pasa a «e» ante palabras que empiezan por el sonido /i/ (Alemania e Italia). */
  const yE = (siguiente) => (/^h?i(?![aeouáéóú])/i.test(normalizar(siguiente)) ? "e" : "y");
  const escapar = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const anunciar = (texto) => { $("#anuncio").textContent = texto; };
  /** Duración legible: 4:05, o 2 h 13 min si pasa de una hora. */
  function formatoDuracion(segundos) {
    const s = Math.round(segundos);
    if (s < 3600) return formatoTiempo(s * 1000);
    return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
  }
  const relativo = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  function hace(fecha) {
    const s = (new Date(fecha) - Date.now()) / 1000;
    for (const [unidad, seg] of [["day", 86400], ["hour", 3600], ["minute", 60]]) {
      if (Math.abs(s) >= seg) return relativo.format(Math.round(s / seg), unidad);
    }
    return "ahora mismo";
  }

  /* ------------------------------------------------------------------
     Sonido (Web Audio, sin archivos)
     ------------------------------------------------------------------ */
  const sonido = {
    ctx: null,
    activo: almacen.leer("capitales.sonido", true),
    asegurar() {
      if (!this.activo) return null;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === "suspended") this.ctx.resume();
      } catch { this.ctx = null; }
      return this.ctx;
    },
    tono(freq, dur, tipo = "sine", vol = 0.08, retraso = 0) {
      const ctx = this.asegurar();
      if (!ctx) return;
      const t = ctx.currentTime + retraso;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = tipo;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },
    acierto() { this.tono(659, 0.14, "triangle", 0.1); this.tono(988, 0.22, "triangle", 0.1, 0.1); },
    casi() { this.tono(587, 0.14, "triangle", 0.08); this.tono(784, 0.2, "triangle", 0.08, 0.1); },
    fallo() { this.tono(196, 0.28, "sawtooth", 0.05); this.tono(147, 0.32, "sawtooth", 0.05, 0.12); },
    clic() { this.tono(1400 + Math.random() * 500, 0.018, "square", 0.012); },
    fanfarria() { [523, 659, 784, 1047].forEach((f, i) => this.tono(f, 0.25, "triangle", 0.09, i * 0.12)); },
  };

  /* ------------------------------------------------------------------
     Tablero de fichas (split-flap)
     ------------------------------------------------------------------ */
  const ALFABETO = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  function pintarTablero(el, texto, { anchoMax = 46, conSonido = true, unaLinea = false, preferirLinea = false } = {}) {
    const palabras = texto.toUpperCase().split(/\s+/).filter(Boolean);
    const larga = unaLinea ? Math.max(texto.length + 0.5 * (palabras.length - 1), 8) : Math.max(...palabras.map((w) => w.length), 6);
    el.textContent = ""; // se mide sin las fichas del nombre anterior
    const estilo = getComputedStyle(el);
    const relleno = unaLinea ? 0 : parseFloat(estilo.paddingLeft) + parseFloat(estilo.paddingRight) + 4;
    const disponible = (el.clientWidth || 600) - relleno;
    let ancho = Math.max(unaLinea ? 8 : 14, Math.min(anchoMax, Math.floor(disponible / (larga + 0.6)) - 3));
    if (preferirLinea) {
      // Para que la franja no crezca con los nombres largos: en una línea si cabe con fichas de buen tamaño;
      // si no, en el ordenador, como mucho en dos. Simula cómo parte las líneas el navegador
      // (3 px entre letras y 0,45 fichas entre palabras).
      const lineas = (n) => {
        let k = 1, linea = 0;
        for (const p of palabras) {
          const w = p.length * n + (p.length - 1) * 3;
          if (w > disponible) return Infinity; // una palabra que no cabe ni sola
          if (linea && linea + 0.45 * n + w > disponible) { k++; linea = w; } else linea += (linea ? 0.45 * n : 0) + w;
        }
        return k;
      };
      const mayor = (maxLineas, minimo) => { let n = anchoMax; while (n > minimo && lineas(n) > maxLineas) n--; return n; };
      const ancha = disponible > 400;
      const enUna = mayor(1, 8);
      if (enUna >= (ancha ? 22 : 30)) ancho = enUna;
      else if (ancha) ancho = mayor(2, 14);
    }
    el.style.setProperty("--ficha-w", ancho + "px");
    el.textContent = "";
    el.setAttribute("aria-label", texto);
    const fichas = [];
    for (const palabra of palabras) {
      const grupo = document.createElement("span");
      grupo.className = "palabra";
      grupo.setAttribute("aria-hidden", "true");
      for (const letra of palabra) {
        const f = document.createElement("span");
        f.className = "ficha";
        f.textContent = movimientoReducido ? letra : " ";
        grupo.appendChild(f);
        fichas.push({ f, letra });
      }
      el.appendChild(grupo);
    }
    if (movimientoReducido) return Promise.resolve();
    return new Promise((resolver) => {
      let pendientes = fichas.length;
      let ultimoClic = 0;
      fichas.forEach(({ f, letra }, i) => {
        let pasos = 3 + Math.floor(Math.random() * 4) + Math.floor(i / 3);
        const tic = () => {
          f.classList.remove("gira");
          void f.offsetWidth;
          f.classList.add("gira");
          if (conSonido && performance.now() - ultimoClic > 45) { sonido.clic(); ultimoClic = performance.now(); }
          if (pasos-- > 0) {
            f.textContent = /[A-ZÑ]/.test(letra) ? ALFABETO[Math.floor(Math.random() * ALFABETO.length)] : letra;
            setTimeout(tic, 55);
          } else {
            f.textContent = letra;
            if (--pendientes === 0) resolver();
          }
        };
        setTimeout(tic, i * 18);
      });
      if (!fichas.length) resolver();
    });
  }

  /* ------------------------------------------------------------------
     Confeti
     ------------------------------------------------------------------ */
  const confeti = (() => {
    const lienzo = $("#confeti");
    const ctx = lienzo.getContext("2d");
    let piezas = [];
    let animando = false;
    const colores = ["#ffbf1f", "#16804a", "#c6352b", "#2f6fd6", "#13213a", "#ff8fb1"];
    function ajustar() {
      lienzo.width = innerWidth * devicePixelRatio;
      lienzo.height = innerHeight * devicePixelRatio;
    }
    function paso() {
      ctx.clearRect(0, 0, lienzo.width, lienzo.height);
      piezas = piezas.filter((p) => p.y < lienzo.height + 40 && p.vida-- > 0);
      for (const p of piezas) {
        p.vx *= 0.99; p.vy += 0.18 * devicePixelRatio; p.x += p.vx; p.y += p.vy; p.giro += p.vgiro;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.giro);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.t / 2, -p.t / 4, p.t, p.t / 2 * Math.abs(Math.cos(p.giro * 1.3)) + 1);
        ctx.restore();
      }
      if (piezas.length) requestAnimationFrame(paso);
      else { animando = false; ctx.clearRect(0, 0, lienzo.width, lienzo.height); }
    }
    return function lanzar(cantidad = 60, origen) {
      if (movimientoReducido) return;
      ajustar();
      const r = origen ? origen.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 3, width: 0, height: 0 };
      const x0 = (r.left + r.width / 2) * devicePixelRatio;
      const y0 = (r.top + r.height / 2) * devicePixelRatio;
      for (let i = 0; i < cantidad; i++) {
        const ang = Math.random() * Math.PI * 2;
        const vel = (4 + Math.random() * 9) * devicePixelRatio;
        piezas.push({
          x: x0, y: y0, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 6 * devicePixelRatio,
          t: (6 + Math.random() * 6) * devicePixelRatio, giro: Math.random() * 6, vgiro: (Math.random() - 0.5) * 0.4,
          color: colores[i % colores.length], vida: 160 + Math.random() * 60,
        });
      }
      if (!animando) { animando = true; requestAnimationFrame(paso); }
    };
  })();

  /* ------------------------------------------------------------------
     Fotos de la capital (Wikipedia / Wikimedia Commons, en el navegador)
     ------------------------------------------------------------------ */
  const fotos = new Map(); // título de Wikipedia -> { src, url } | null
  let fotosDisponibles = true;
  let promesaFotos = Promise.resolve();
  async function precargarFotos(titulos) {
    const pendientes = [...new Set(titulos)].filter((t) => !fotos.has(t));
    for (let i = 0; i < pendientes.length && fotosDisponibles; i += 50) {
      const lote = pendientes.slice(i, i + 50);
      const url = "https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*" +
        "&prop=pageimages&piprop=thumbnail&pithumbsize=800&pilimit=50&redirects=1&titles=" +
        encodeURIComponent(lote.join("|"));
      try {
        const control = new AbortController();
        const plazo = setTimeout(() => control.abort(), 8000);
        const r = await fetch(url, { signal: control.signal });
        clearTimeout(plazo);
        const j = await r.json();
        const cambios = new Map();
        for (const n of j.query.normalized || []) cambios.set(n.from, n.to);
        for (const n of j.query.redirects || []) cambios.set(n.from, n.to);
        const paginas = new Map((j.query.pages || []).map((pg) => [pg.title, pg]));
        for (const t of lote) {
          let final = t;
          for (let k = 0; k < 3 && cambios.has(final); k++) final = cambios.get(final);
          const pg = paginas.get(final);
          fotos.set(t, pg && pg.thumbnail ? {
            src: pg.thumbnail.source,
            url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(pg.title.replace(/ /g, "_")),
          } : null);
        }
      } catch {
        fotosDisponibles = false; // sin red o bloqueado: el juego sigue sin fotos
      }
    }
  }

  /* ------------------------------------------------------------------
     Mapa
     ------------------------------------------------------------------ */
  const NS = "http://www.w3.org/2000/svg";
  const mapaSvg = $("#mapa");
  let mapaListo = false;
  let vistaActual = [0, 0, MAPA.w, MAPA.h];
  let vistaPais = null; // vista del país de la pregunta, para el botón «Volver al país»
  let animMapa = 0;
  let chinchetas = [];
  function construirMapa() {
    if (mapaListo) return;
    const fondo = document.createElementNS(NS, "path");
    fondo.setAttribute("d", MAPA.fondo);
    fondo.setAttribute("class", "fondo");
    mapaSvg.appendChild(fondo);
    for (const [id, d] of Object.entries(MAPA.formas)) {
      const camino = document.createElementNS(NS, "path");
      camino.setAttribute("d", d);
      camino.setAttribute("class", "pais");
      camino.dataset.id = id;
      mapaSvg.appendChild(camino);
    }
    // Capas superiores: ruta entre capitales (solo al confundir países) y chinchetas.
    const ruta = document.createElementNS(NS, "path");
    ruta.setAttribute("class", "ruta-error");
    const onda = document.createElementNS(NS, "circle");
    onda.setAttribute("class", "onda-pin");
    const pin = document.createElementNS(NS, "circle");
    pin.setAttribute("class", "pin");
    const pinOtro = document.createElementNS(NS, "circle");
    pinOtro.setAttribute("class", "pin-otro");
    mapaSvg.append(ruta, onda, pin, pinOtro);
    chinchetas = [onda, pin, pinOtro];
    mapaListo = true;
  }

  /** Proporción (ancho / alto) con la que se ve ahora el mapa. */
  const ratioMapa = () => {
    const w = mapaSvg.clientWidth, h = mapaSvg.clientHeight;
    return w && h ? w / h : 1.6;
  };
  /** Mapa casi entero: el ancho máximo al que se puede alejar. */
  const anchoMaximo = (ratio) => Math.max(MAPA.w, MAPA.h * ratio) * 1.05;
  /** Que el centro de la vista no salga del mapa (para no perder el mundo al arrastrar). */
  function limitar([x, y, w, h]) {
    const cx = Math.min(Math.max(x + w / 2, 0), MAPA.w);
    const cy = Math.min(Math.max(y + h / 2, 0), MAPA.h);
    return [cx - w / 2, cy - h / 2, w, h];
  }
  /** Vista que contiene una zona [x, y, ancho, alto] con la proporción real del mapa. */
  function ajustarVista([x, y, w, h], ratio = ratioMapa()) {
    const ancho = Math.min(Math.max(w, h * ratio, 12), anchoMaximo(ratio));
    return limitar([x + w / 2 - ancho / 2, y + h / 2 - ancho / ratio / 2, ancho, ancho / ratio]);
  }
  /** Aplica una vista y mantiene las chinchetas del mismo tamaño en pantalla. */
  function aplicarVista(v) {
    vistaActual = v;
    mapaSvg.setAttribute("viewBox", v.map((n) => n.toFixed(2)).join(" "));
    const r = (5.5 * v[2]) / (mapaSvg.clientWidth || 600);
    for (const c of chinchetas) c.setAttribute("r", r.toFixed(3));
  }
  function animarVista(destino, dur = 700) {
    cancelAnimationFrame(animMapa);
    const inicio = [...vistaActual];
    const t0 = performance.now();
    const total = movimientoReducido ? 1 : dur;
    const tick = (ahora) => {
      const t = Math.min(1, (ahora - t0) / total);
      const e = 1 - Math.pow(1 - t, 3);
      aplicarVista(inicio.map((v, i) => v + (destino[i] - v) * e));
      if (t < 1) animMapa = requestAnimationFrame(tick);
    };
    animMapa = requestAnimationFrame(tick);
  }
  /** Vista tras acercar (factor < 1) o alejar (> 1) alrededor de un punto del mapa. */
  function vistaZoom(factor, [px, py], v = vistaActual) {
    const [x, y, w, h] = v;
    const ratio = w / h;
    const ancho = Math.min(Math.max(w * factor, 12), anchoMaximo(ratio));
    const f = ancho / w;
    return limitar([px - (px - x) * f, py - (py - y) * f, ancho, ancho / ratio]);
  }
  function puntoMapa(clientX, clientY) {
    const r = mapaSvg.getBoundingClientRect();
    return [vistaActual[0] + ((clientX - r.left) / r.width) * vistaActual[2], vistaActual[1] + ((clientY - r.top) / r.height) * vistaActual[3]];
  }
  const centroVista = () => [vistaActual[0] + vistaActual[2] / 2, vistaActual[1] + vistaActual[3] / 2];

  // Navegación: arrastrar con el ratón o un dedo, rueda, pellizco y botones. Tocar el mapa pausa el avance.
  const punteros = new Map();
  mapaSvg.addEventListener("pointerdown", (e) => {
    if (!mapaListo) return;
    cancelAnimationFrame(animMapa);
    pausar();
    mapaSvg.setPointerCapture(e.pointerId);
    punteros.set(e.pointerId, [e.clientX, e.clientY]);
    mapaSvg.classList.add("arrastrando");
  });
  mapaSvg.addEventListener("pointermove", (e) => {
    const antes = punteros.get(e.pointerId);
    if (!antes) return;
    if (punteros.size === 1) {
      const k = vistaActual[2] / (mapaSvg.clientWidth || 600);
      const [x, y, w, h] = vistaActual;
      aplicarVista(limitar([x - (e.clientX - antes[0]) * k, y - (e.clientY - antes[1]) * k, w, h]));
    } else {
      const otro = [...punteros].find(([id]) => id !== e.pointerId)[1];
      const dAntes = Math.hypot(antes[0] - otro[0], antes[1] - otro[1]);
      const dAhora = Math.hypot(e.clientX - otro[0], e.clientY - otro[1]);
      if (dAntes && dAhora) aplicarVista(vistaZoom(dAntes / dAhora, puntoMapa((e.clientX + otro[0]) / 2, (e.clientY + otro[1]) / 2)));
    }
    punteros.set(e.pointerId, [e.clientX, e.clientY]);
  });
  const soltar = (e) => {
    punteros.delete(e.pointerId);
    if (!punteros.size) mapaSvg.classList.remove("arrastrando");
  };
  mapaSvg.addEventListener("pointerup", soltar);
  mapaSvg.addEventListener("pointercancel", soltar);
  mapaSvg.addEventListener("wheel", (e) => {
    if (!mapaListo) return;
    e.preventDefault();
    cancelAnimationFrame(animMapa);
    pausar();
    const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    aplicarVista(vistaZoom(Math.pow(1.0018, delta), puntoMapa(e.clientX, e.clientY)));
  }, { passive: false });
  mapaSvg.addEventListener("dblclick", (e) => animarVista(vistaZoom(0.5, puntoMapa(e.clientX, e.clientY)), 300));
  $("#mapa-mas").addEventListener("click", () => { pausar(); animarVista(vistaZoom(0.6, centroVista()), 300); });
  $("#mapa-menos").addEventListener("click", () => { pausar(); animarVista(vistaZoom(1 / 0.6, centroVista()), 300); });
  $("#mapa-mundo").addEventListener("click", () => { pausar(); animarVista(ajustarVista([0, 0, MAPA.w, MAPA.h])); });
  $("#mapa-pais").addEventListener("click", () => { pausar(); if (vistaPais) animarVista(ajustarVista(vistaPais)); });
  // Si cambia el tamaño del mapa (ventana, móvil girado), se mantiene lo que se estaba viendo.
  if (window.ResizeObserver) new ResizeObserver(() => { if (mapaListo && mapaSvg.clientWidth) aplicarVista(ajustarVista(vistaActual)); }).observe(mapaSvg);

  /** Proyección Natural Earth, la misma de scripts/construir_mapa.mjs, para situar puntos nuevos. */
  function proyectar(lon, lat) {
    const { k, tx, ty } = MAPA.proy;
    const l = (lon * Math.PI) / 180;
    const f = (lat * Math.PI) / 180;
    const f2 = f * f, f4 = f2 * f2;
    const x = l * (0.8707 - 0.131979 * f2 + f4 * (-0.013791 + f4 * (0.003971 * f2 - 0.001529 * f4)));
    const y = f * (1.007226 + f2 * (0.015085 + f4 * (-0.044475 + 0.028874 * f2 - 0.005916 * f4)));
    return [tx + k * x, ty - k * y];
  }

  /** Ruta más corta (círculo máximo) entre dos capitales, proyectada y partida si cruza el antimeridiano. */
  function rutaEntre(a, b, pasos = 48) {
    const rad = Math.PI / 180;
    const vector = (x) => [Math.cos(x.lat * rad) * Math.cos(x.lon * rad), Math.cos(x.lat * rad) * Math.sin(x.lon * rad), Math.sin(x.lat * rad)];
    const v0 = vector(a), v1 = vector(b);
    const d = distanciaKm(a, b) / 6371; // ángulo entre ambas capitales
    const tramos = [[]];
    let previo = null;
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      const A = d ? Math.sin((1 - t) * d) / Math.sin(d) : 1 - t;
      const B = d ? Math.sin(t * d) / Math.sin(d) : t;
      const [x, y, z] = [0, 1, 2].map((j) => A * v0[j] + B * v1[j]);
      const punto = proyectar(Math.atan2(y, x) / rad, Math.atan2(z, Math.hypot(x, y)) / rad);
      if (previo && Math.abs(punto[0] - previo[0]) > MAPA.w / 2) tramos.push([]);
      tramos[tramos.length - 1].push(punto);
      previo = punto;
    }
    return tramos;
  }

  /** Zona que abarca varias zonas y puntos, con un poco de margen. */
  function unirVistas(vistas, puntos) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y, w, h] of vistas) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); }
    for (const [x, y] of puntos) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const w = (x1 - x0) * 1.08, h = (y1 - y0) * 1.08;
    return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
  }
  // Países cuya caja cruza el antimeridiano o es enorme: se centra en una zona fija.
  const VISTAS_ESPECIALES = { RU: [300, 20, 640, 400], US: [40, 60, 470, 294], FJ: null, KI: null, NZ: null, TV: null, TO: null, WS: null };
  /** Zona del mapa que enseña un país con algo de contexto alrededor (se ajusta luego a la proporción del mapa). */
  function vistaDe(id) {
    if (VISTAS_ESPECIALES[id]) return VISTAS_ESPECIALES[id];
    const [cx, cy] = MAPA.capitales[id];
    const caja = MAPA.cajas[id];
    if (!caja || id in VISTAS_ESPECIALES || caja[2] - caja[0] > 450) {
      const w = caja && caja[2] - caja[0] > 450 ? 240 : 150;
      return [cx - w / 2, cy - w / 3.2, w, w / 1.6];
    }
    const w = Math.max((caja[2] - caja[0]) * 2.4, 120);
    const h = Math.max((caja[3] - caja[1]) * 2.4, 75);
    return [(caja[0] + caja[2]) / 2 - w / 2, (caja[1] + caja[3]) / 2 - h / 2, w, h];
  }
  /** Sitúa el país correcto y, si el jugador lo confundió con otro, también ese otro y la ruta entre ambos. */
  function mostrarMapa(p, otro = null) {
    construirMapa();
    mapaSvg.querySelectorAll(".destino, .confundido").forEach((e) => e.classList.remove("destino", "confundido"));
    const capas = mapaSvg.querySelector(".ruta-error");
    for (const [x, clase] of [[otro, "confundido"], [p, "destino"]]) {
      const forma = x && mapaSvg.querySelector(`.pais[data-id="${x.id}"]`);
      if (forma) { forma.classList.add(clase); mapaSvg.insertBefore(forma, capas); }
    }
    let destino = vistaDe(p.id);
    const ruta = mapaSvg.querySelector(".ruta-error");
    const pinOtro = mapaSvg.querySelector(".pin-otro");
    ruta.toggleAttribute("hidden", !otro);
    pinOtro.toggleAttribute("hidden", !otro);
    if (otro) {
      const tramos = rutaEntre(otro, p);
      ruta.setAttribute("d", tramos.map((t) => "M" + t.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")).join(""));
      // Si la ruta cruza el antimeridiano se enseña el mundo entero.
      destino = tramos.length > 1 ? [0, 0, MAPA.w, MAPA.h] : unirVistas([destino, vistaDe(otro.id)], tramos[0]);
    }
    const colocar = (c, [cx, cy]) => { c.setAttribute("cx", cx); c.setAttribute("cy", cy); };
    for (const c of mapaSvg.querySelectorAll(".pin, .onda-pin")) colocar(c, MAPA.capitales[p.id]);
    if (otro) colocar(pinOtro, MAPA.capitales[otro.id]);
    vistaPais = destino;
    aplicarVista(ajustarVista(vistaActual)); // por si el mapa ha cambiado de tamaño
    animarVista(ajustarVista(destino), 1100);
    $("#mapa-pie").innerHTML = otro
      ? `<span class="leyenda destino"></span>${escapar(p.capital)}, ${escapar(p.pais)} ` +
        `<span class="leyenda confundido"></span>${escapar(otro.capital)}, ${escapar(otro.pais)} · unos ${formatoKm(distanciaKm(otro, p))} km`
      : `${escapar(p.capital)}, ${escapar(p.pais)} · ${escapar(CONTINENTES[p.cont])}`;
  }

  /* ------------------------------------------------------------------
     Ajustes
     ------------------------------------------------------------------ */
  const AJUSTES_POR_DEFECTO = {
    tipo: "ronda", conts: Object.keys(CONTINENTES), n: 10, dir: "pc", modo: "escribir",
    tiempo: 0, erratas: true, auto: true, taiwan: false,
  };
  /** Ajustes válidos a partir de lo guardado (o de una copia cargada): lo que no se reconoce se ignora. */
  function limpiarAjustes(a, base = AJUSTES_POR_DEFECTO) {
    const r = { ...base, conts: [...base.conts] };
    if (!a || typeof a !== "object") return r;
    if (Array.isArray(a.conts)) { const c = a.conts.filter((x) => x in CONTINENTES); if (c.length) r.conts = c; }
    if (["ronda", "maraton"].includes(a.tipo)) r.tipo = a.tipo;
    if ([0, 10, 25, 50, 100].includes(a.n)) r.n = a.n;
    if (["pc", "cp", "mix"].includes(a.dir)) r.dir = a.dir;
    if (["escribir", "opciones"].includes(a.modo)) r.modo = a.modo;
    if ([0, 10, 20, 30].includes(a.tiempo)) r.tiempo = a.tiempo;
    for (const k of ["erratas", "auto", "taiwan"]) if (typeof a[k] === "boolean") r[k] = a[k];
    return r;
  }
  let ajustes = limpiarAjustes(almacen.leer("capitales.ajustes", {}));

  const paisesDisponibles = () => PAISES.filter((p) => ajustes.taiwan || !p.limitado);
  const poolActual = () => paisesDisponibles().filter((p) => ajustes.conts.includes(p.cont));
  /** Preguntas de la ronda: la opción elegida, o todas si el grupo tiene menos países. */
  const nEfectivo = () => { const total = poolActual().length; return ajustes.n && ajustes.n < total ? ajustes.n : total; };
  const firmaAjustes = () => [ajustes.conts.slice().sort().join("+"), nEfectivo(), ajustes.dir, ajustes.modo, ajustes.taiwan ? "tw" : ""].join("|");
  const TEXTO_DIR = { pc: "País → capital", cp: "Capital → país", mix: "Mezcla" };
  const TEXTO_MODO = { escribir: "Escribiendo", opciones: "4 opciones" };
  const zonaActual = () => (ajustes.conts.length === Object.keys(CONTINENTES).length ? "todo"
    : Object.keys(CONTINENTES).filter((c) => ajustes.conts.includes(c)).join("+"));
  const textoZona = (zona) => (zona === "todo" ? "Todo el mundo" : zona.split("+").map((c) => CONTINENTES[c] || c).join(" + "));

  function pintarChipsContinentes() {
    const caja = $("#chips-continentes");
    caja.textContent = "";
    const disp = paisesDisponibles();
    const todos = document.createElement("button");
    todos.type = "button";
    todos.className = "chip todos";
    const todosActivos = ajustes.conts.length === Object.keys(CONTINENTES).length;
    todos.setAttribute("aria-pressed", String(todosActivos));
    todos.innerHTML = `Todo el mundo <small>${disp.length}</small>`;
    todos.addEventListener("click", () => {
      ajustes.conts = Object.keys(CONTINENTES);
      refrescarOpciones();
    });
    caja.appendChild(todos);
    for (const [clave, nombre] of Object.entries(CONTINENTES)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.id = "cont-" + clave;
      b.setAttribute("aria-pressed", String(ajustes.conts.includes(clave)));
      b.innerHTML = `${nombre} <small>${disp.filter((p) => p.cont === clave).length}</small>`;
      b.addEventListener("click", () => {
        if (todosActivos) ajustes.conts = [clave];
        else if (ajustes.conts.includes(clave)) ajustes.conts = ajustes.conts.filter((c) => c !== clave);
        else ajustes.conts = [...ajustes.conts, clave];
        if (!ajustes.conts.length) ajustes.conts = [clave];
        refrescarOpciones();
      });
      caja.appendChild(b);
    }
  }

  function refrescarOpciones() {
    const maraton = ajustes.tipo === "maraton";
    if (maraton && ajustes.dir === "mix") ajustes.dir = "pc"; // en la maratón no hay mezcla
    pintarChipsContinentes();
    const total = poolActual().length;
    $("#resumen-pool").textContent = `${total} ${total === 1 ? "país seleccionado" : "países seleccionados"}`;
    $("#talon-modo").textContent = TEXTO_DIR[ajustes.dir] + (ajustes.modo === "opciones" ? " · 4 opc." : "");
    $("#n-todas").nextElementSibling.textContent = `Todas (${total})`;
    for (const v of [10, 25, 50, 100]) $("#n-" + v).disabled = v > total;
    $(`input[name="n"][value="${ajustes.n && ajustes.n <= total ? ajustes.n : 0}"]`).checked = true;
    $(`input[name="dir"][value="${ajustes.dir}"]`).checked = true;
    $(`input[name="modo"][value="${ajustes.modo}"]`).checked = true;
    $("#sel-tiempo").value = String(ajustes.tiempo);
    $("#chk-erratas").checked = ajustes.erratas;
    $("#chk-auto").checked = ajustes.auto;
    $("#chk-taiwan").checked = ajustes.taiwan;
    $("#chk-erratas").disabled = ajustes.modo === "opciones";
    const record = almacen.leer("capitales.records", {})[firmaAjustes()];
    $("#talon-record").textContent = record ? formatoNumero(record.puntos) : "—";
    $("#talon-n").textContent = nEfectivo();
    $(`input[name="tipo"][value="${ajustes.tipo}"]`).checked = true;
    $("#ayuda-tipo").hidden = !maraton;
    $("#grupo-n").hidden = maraton;
    $("#dir-mix").disabled = maraton;
    $("#aviso-mezcla").hidden = !maraton;
    $("#talon-n-etq").textContent = maraton ? "Países" : "Paradas";
    if (maraton) $("#talon-n").textContent = total;
    $("#talon-record-caja").hidden = maraton;
    $("#btn-empezar").textContent = maraton ? "Empezar maratón" : "Empezar ronda";
    $("#confirmar-nueva").hidden = true;
    almacen.guardar("capitales.ajustes", ajustes);
  }

  $("#form-opciones").addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "tipo") ajustes.tipo = t.value;
    if (t.name === "n") ajustes.n = Number(t.value);
    if (t.name === "dir") ajustes.dir = t.value;
    if (t.name === "modo") ajustes.modo = t.value;
    if (t.name === "tiempo") ajustes.tiempo = Number(t.value);
    if (t.name === "erratas") ajustes.erratas = t.checked;
    if (t.name === "auto") ajustes.auto = t.checked;
    if (t.name === "taiwan") ajustes.taiwan = t.checked;
    refrescarOpciones();
  });
  $("#form-opciones").addEventListener("submit", (e) => {
    e.preventDefault();
    if (ajustes.tipo !== "maraton") { empezarRonda(poolActual()); return; }
    const actual = leerMaraton();
    if (actual) {
      $("#confirmar-nueva-texto").textContent = `Ya tienes una maratón en curso (${P.dominados(actual)} de ${P.total(actual)} países dominados). Si empiezas otra, se borrará.`;
      $("#confirmar-nueva").hidden = false;
      $("#btn-nueva-no").focus();
      return;
    }
    nuevaMaraton();
  });
  $("#btn-nueva-si").addEventListener("click", () => { $("#confirmar-nueva").hidden = true; nuevaMaraton(); });
  $("#btn-nueva-no").addEventListener("click", () => {
    $("#confirmar-nueva").hidden = true;
    const m = leerMaraton();
    if (m) empezarMaraton(m);
  });

  /* ------------------------------------------------------------------
     Panel de salidas de la portada
     ------------------------------------------------------------------ */
  let temporizadorDemo = 0;
  function pintarDemo() {
    const caja = $("#panel-demo");
    if (!caja.children.length) {
      for (let i = 0; i < 3; i++) {
        const fila = document.createElement("div");
        fila.className = "panel-fila";
        fila.innerHTML = '<div class="tablero pais"></div><div class="tablero capital"></div>';
        caja.appendChild(fila);
      }
    }
    const largo = caja.clientWidth && caja.clientWidth < 330 ? 8 : 11; // en móviles estrechos, nombres cortos
    const elegidos = barajar(PAISES.filter((p) => !p.limitado && p.pais.length <= largo && p.capital.length <= largo)).slice(0, 3);
    [...caja.children].forEach((fila, i) => {
      const [a, b] = fila.children;
      setTimeout(() => {
        pintarTablero(a, elegidos[i].pais, { anchoMax: 22, conSonido: false, unaLinea: true });
        pintarTablero(b, elegidos[i].capital, { anchoMax: 22, conSonido: false, unaLinea: true });
      }, i * 260);
    });
  }
  function iniciarDemo() {
    clearInterval(temporizadorDemo);
    pintarDemo();
    if (!movimientoReducido) temporizadorDemo = setInterval(() => { if (!document.hidden) pintarDemo(); }, 4200);
  }

  /* ------------------------------------------------------------------
     Pantallas
     ------------------------------------------------------------------ */
  const pantallas = ["inicio", "juego", "final", "tabla", "muro"];
  const NAV = { tabla: "#nav-tabla", muro: "#nav-muro" };
  function mostrarPantalla(nombre) {
    for (const p of pantallas) $("#pantalla-" + p).hidden = p !== nombre;
    for (const sel of ["#nav-jugar", "#nav-tabla", "#nav-muro"]) $(sel).removeAttribute("aria-current");
    $(NAV[nombre] || "#nav-jugar").setAttribute("aria-current", "page");
    if (nombre === "inicio") { iniciarDemo(); pintarMaratonCurso(); pintarMisDatos(); } else clearInterval(temporizadorDemo);
    window.scrollTo({ top: 0, behavior: movimientoReducido ? "auto" : "smooth" });
  }

  /* ------------------------------------------------------------------
     Ronda
     ------------------------------------------------------------------ */
  let ronda = null;
  // El tiempo solo corre mientras el juego espera tu respuesta: se para al responder y al cambiar de pestaña.
  const MAX_PENSAR = 5 * 60 * 1000; // más de 5 minutos en una sola pregunta ya no cuenta
  const tiempoJugado = (r) => r.activo + (r.desde ? Math.min(performance.now() - r.desde, MAX_PENSAR) : 0);
  function arrancarCrono() { if (ronda && !ronda.desde) ronda.desde = performance.now(); }
  function pararCrono() {
    if (!ronda || !ronda.desde) return 0;
    const pensado = Math.min(performance.now() - ronda.desde, MAX_PENSAR);
    ronda.activo += pensado;
    ronda.desde = null;
    return pensado;
  }
  document.addEventListener("visibilitychange", () => {
    if (!ronda || $("#pantalla-juego").hidden) return;
    if (document.hidden && ronda.desde) { pararCrono(); ronda.oculta = true; }
    else if (!document.hidden && ronda.oculta) { ronda.oculta = false; if (!ronda.respondida) arrancarCrono(); }
  });
  // Tiempo que se ve la respuesta antes de pasar sola a la siguiente: un fallo, el doble que un acierto.
  const PAUSA_ACIERTO = 2600;
  const PAUSA_FALLO = PAUSA_ACIERTO * 2;
  const PAUSA_DOMINADO = 6000; // da tiempo a ver la animación de país dominado
  let temporizadorSiguiente = 0;
  let temporizadorReloj = 0;
  let temporizadorCrono = 0;

  function empezarRonda(pool, { repaso = false } = {}) {
    if (!pool.length) return;
    const n = repaso ? pool.length : nEfectivo();
    const preguntas = barajar(pool).slice(0, n).map((p) => ({
      p, dir: ajustes.dir === "mix" ? (Math.random() < 0.5 ? "pc" : "cp") : ajustes.dir,
    }));
    ronda = {
      preguntas, i: 0, aciertos: 0, fallos: 0, racha: 0, mejorRacha: 0, puntos: 0,
      activo: 0, desde: null, historial: [], respondida: false, pista: 0, repaso, abandonada: false,
      modalidad: {
        dir: ajustes.dir, modo: ajustes.modo, limite: ajustes.tiempo,
        zona: zonaActual(),
      },
    };
    promesaFotos = precargarFotos(preguntas.map((q) => q.p.wiki));
    arrancarPantallaJuego();
    mostrarPregunta();
  }

  function arrancarPantallaJuego() {
    mostrarPantalla("juego");
    const maraton = !!ronda.maraton;
    $("#hud-puntos-etq").textContent = maraton ? "Dominados" : "Puntos";
    $("#hud-de").hidden = maraton;
    $("#btn-abandonar").textContent = maraton ? "Pausar maratón" : "Terminar ronda";
    clearInterval(temporizadorCrono);
    temporizadorCrono = setInterval(() => { if (ronda) $("#hud-tiempo").textContent = formatoTiempo(tiempoJugado(ronda)); }, 250);
    $("#hud-tiempo").textContent = "0:00";
  }

  /* ------------------------------------------------------------------
     Maratón: cada país hasta acertarlo tres veces seguidas (lógica en js/progreso.js)
     ------------------------------------------------------------------ */
  const PAIS = Object.fromEntries(PAISES.map((p) => [p.id, p]));
  const IDS = new Set(PAISES.map((p) => p.id));
  /** Ajuste de respuesta en uso: el de la maratón si se está jugando una, si no el elegido. */
  const modoActual = () => (ronda && ronda.maraton ? ronda.maraton.modo : ajustes.modo);

  function leerMaraton() {
    const m = almacen.leer("capitales.maraton", null);
    if (!m) return null;
    const r = P.validar({ app: "capitales", version: P.VERSION, maraton: m }, IDS);
    return r.ok ? r.datos.maraton : null;
  }
  const guardarMaraton = (m) => almacen.guardar("capitales.maraton", m);

  function nuevaMaraton() {
    const m = P.crearMaraton({
      ids: poolActual().map((p) => p.id), dir: ajustes.dir === "mix" ? "pc" : ajustes.dir,
      modo: ajustes.modo, zona: zonaActual(), taiwan: ajustes.taiwan,
    });
    guardarMaraton(m);
    empezarMaraton(m);
  }

  function empezarMaraton(m) {
    ronda = {
      maraton: m, preguntas: [], i: -1, aciertos: 0, fallos: 0, racha: 0, mejorRacha: 0, puntos: 0,
      activo: 0, desde: null, historial: [], respondida: true, pista: 0, repaso: false, abandonada: false,
      modalidad: { dir: m.dir, modo: m.modo, limite: ajustes.tiempo, zona: m.zona },
    };
    promesaFotos = precargarFotos(P.pendientes(m).map((id) => PAIS[id].wiki));
    arrancarPantallaJuego();
    siguienteMaraton();
  }

  function siguienteMaraton() {
    const m = ronda.maraton;
    const id = P.siguienteId(m);
    if (!id) { terminarMaraton(); return; }
    ronda.preguntas.push({ p: PAIS[id], dir: m.dir });
    ronda.i = ronda.preguntas.length - 1;
    mostrarPregunta();
  }

  function pausarMaraton() {
    if (ronda && ronda.maraton) guardarMaraton(ronda.maraton);
    detenerRonda();
    ronda = null;
    refrescarOpciones();
    mostrarPantalla("inicio");
  }

  /** Símbolo de aciertos seguidos: círculo vacío, una diagonal, la otra (X) y el asterisco completo. */
  function pintarContador(racha, { animar = false } = {}) {
    const c = $("#contador-maraton");
    c.classList.remove("explota", "reinicia", "suma");
    if (!animar) c.classList.add("sin-transicion");
    c.dataset.racha = racha;
    const texto = `${racha} de ${P.OBJETIVO} aciertos seguidos`;
    c.setAttribute("aria-label", texto);
    c.title = texto;
    if (!animar) { void c.offsetWidth; c.classList.remove("sin-transicion"); }
  }

  function pintarMaratonCurso() {
    const m = leerMaraton();
    const caja = $("#maraton-curso");
    caja.hidden = !m;
    $("#mc-confirmar").hidden = true;
    if (!m) return;
    const total = P.total(m), dom = P.dominados(m), cam = P.enCamino(m);
    $("#mc-modalidad").textContent = [TEXTO_DIR[m.dir], TEXTO_MODO[m.modo], textoZona(m.zona)].join(" · ");
    $("#mc-dominados").textContent = dom;
    $("#mc-total").textContent = total;
    $("#mc-barra-dom").style.width = (dom / total) * 100 + "%";
    $("#mc-barra-cam").style.width = (cam / total) * 100 + "%";
    const pct = m.turno ? Math.round((m.aciertos / m.turno) * 100) : 0;
    $("#mc-datos").textContent = m.turno
      ? `${formatoNumero(m.turno)} preguntas · ${pct} % de aciertos · ${formatoDuracion(m.segundos)} jugando · empezada ${hace(m.creada)}`
      : `Empezada ${hace(m.creada)}. Aún no has respondido ninguna pregunta.`;
  }
  $("#btn-continuar-maraton").addEventListener("click", () => { const m = leerMaraton(); if (m) empezarMaraton(m); });
  $("#btn-abandonar-maraton").addEventListener("click", () => { $("#mc-confirmar").hidden = false; $("#btn-cancelar-abandono").focus(); });
  $("#btn-cancelar-abandono").addEventListener("click", () => { $("#mc-confirmar").hidden = true; });
  $("#btn-confirmar-abandono").addEventListener("click", () => {
    guardarMaraton(null);
    pintarMaratonCurso();
    pintarMisDatos();
  });

  function actualizarHud(saltar) {
    const r = ronda;
    let avance;
    if (r.maraton) {
      const m = r.maraton;
      $("#hud-i").textContent = formatoNumero(m.turno + (r.respondida ? 0 : 1));
      $("#hud-aciertos").textContent = formatoNumero(m.aciertos);
      $("#hud-fallos").textContent = formatoNumero(m.fallos);
      $("#hud-puntos").textContent = `${P.dominados(m)}/${P.total(m)}`;
      avance = P.dominados(m) / P.total(m);
    } else {
      const total = r.preguntas.length;
      $("#hud-i").textContent = Math.min(r.i + 1, total);
      $("#hud-n").textContent = total;
      $("#hud-aciertos").textContent = r.aciertos;
      $("#hud-fallos").textContent = r.fallos;
      $("#hud-puntos").textContent = formatoNumero(r.puntos);
      avance = (r.i + (r.respondida ? 1 : 0)) / total;
    }
    $("#hud-racha").textContent = r.racha;
    $("#hud-racha-caja").classList.toggle("en-llamas", r.racha >= 5);
    $("#ruta-hecha").style.width = avance * 100 + "%";
    $("#avion").style.left = `clamp(13px, ${avance * 100}%, calc(100% - 13px))`;
    if (saltar) {
      const caja = $(saltar).closest(".dato-hud");
      caja.classList.remove("salta"); void caja.offsetWidth; caja.classList.add("salta");
    }
  }

  function mostrarPregunta() {
    const r = ronda;
    const q = r.preguntas[r.i];
    r.respondida = false;
    r.pista = 0;
    clearTimeout(temporizadorSiguiente);
    const esPais = q.dir === "pc";
    const etiqueta = $("#etiqueta-tipo");
    etiqueta.textContent = esPais ? "País" : "Capital";
    etiqueta.classList.toggle("capital", !esPais);
    const opciones = modoActual() === "opciones";
    $("#contador-maraton").hidden = !r.maraton;
    $("#caja-pregunta").classList.toggle("con-contador", !!r.maraton);
    if (r.maraton) pintarContador(r.maraton.paises[q.p.id].racha);
    $("#instruccion").innerHTML = (esPais
      ? (opciones ? "¿Cuál es su capital?" : "Escribe su capital")
      : (opciones ? "¿De qué país es capital?" : "Escribe el país del que es capital")) +
      (r.maraton && P.esRelleno(r.maraton, q.p.id) ? "<small>Repaso de uno ya dominado: no cuenta</small>" : "");
    const bandera = $("#bandera-pregunta");
    // La bandera solo se enseña cuando no delata la respuesta.
    if (esPais) { bandera.src = rutaBandera(q.p.id); bandera.alt = `Bandera de ${q.p.pais}`; bandera.hidden = false; }
    else bandera.hidden = true;
    $("#sello").hidden = true;
    $("#caja-pregunta").classList.remove("dominado");
    $("#revelado").hidden = true;
    $("#acciones-pregunta").hidden = false;
    $("#btn-pista").disabled = false;
    $("#texto-pista").hidden = true;
    pintarTablero($("#tablero"), esPais ? q.p.pais : q.p.capital, { anchoMax: 40, preferirLinea: true });
    anunciar(`${esPais ? "País" : "Capital"}: ${esPais ? q.p.pais : q.p.capital}`);

    if (opciones) {
      $("#form-respuesta").hidden = true;
      pintarOpciones(q);
    } else {
      $("#opciones4").hidden = true;
      $("#form-respuesta").hidden = false;
      const entrada = $("#entrada");
      entrada.value = "";
      entrada.disabled = false;
      entrada.placeholder = esPais ? "Escribe la capital…" : "Escribe el país…";
      $("#entrada-etiqueta").textContent = esPais ? `Capital de ${q.p.pais}` : `País cuya capital es ${q.p.capital}`;
      $("#btn-comprobar").disabled = false;
      entrada.focus({ preventScroll: true });
    }
    actualizarHud();
    iniciarReloj();
    arrancarCrono();
  }

  function pintarOpciones(q) {
    const caja = $("#opciones4");
    caja.hidden = false;
    caja.textContent = "";
    const campo = q.dir === "pc" ? "capital" : "pais";
    const candidatos = paisesDisponibles().filter((x) => x !== q.p);
    const cercanos = barajar(candidatos.filter((x) => x.cont === q.p.cont));
    const lejanos = barajar(candidatos.filter((x) => x.cont !== q.p.cont));
    const opciones = barajar([q.p, ...[...cercanos, ...lejanos].slice(0, 3)]);
    q.opciones = opciones;
    opciones.forEach((x, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opcion";
      b.dataset.id = x.id;
      b.innerHTML = `<kbd>${i + 1}</kbd><span>${escapar(x[campo])}</span>`;
      b.addEventListener("click", () => responderOpcion(x));
      caja.appendChild(b);
    });
  }

  function iniciarReloj() {
    clearInterval(temporizadorReloj);
    const reloj = $("#reloj");
    if (!ajustes.tiempo) { reloj.hidden = true; return; }
    reloj.hidden = false;
    const limite = ajustes.tiempo * 1000;
    const t0 = performance.now();
    const arco = $("#reloj-arco");
    const pintar = () => {
      const resta = Math.max(0, limite - (performance.now() - t0));
      $("#reloj-num").textContent = Math.ceil(resta / 1000);
      arco.style.strokeDashoffset = String(97.4 * (1 - resta / limite));
      reloj.classList.toggle("urgente", resta < 5000);
      ronda.restante = resta / 1000;
      if (resta <= 0) { clearInterval(temporizadorReloj); tiempoAgotado(); }
    };
    pintar();
    temporizadorReloj = setInterval(pintar, 100);
  }

  function tiempoAgotado() {
    if (ronda.respondida) return;
    registrar({ ok: false, agotado: true }, "");
  }

  $("#form-respuesta").addEventListener("submit", (e) => {
    e.preventDefault();
    if (ronda.respondida) { siguiente(); return; }
    const entrada = $("#entrada");
    const texto = entrada.value;
    const q = ronda.preguntas[ronda.i];
    const res = evaluar(texto, q, ajustes.erratas);
    if (res.vacia) {
      entrada.classList.remove("tiembla"); void entrada.offsetWidth; entrada.classList.add("tiembla");
      entrada.focus();
      return;
    }
    registrar(res, texto);
  });

  function responderOpcion(x) {
    if (ronda.respondida) return;
    const q = ronda.preguntas[ronda.i];
    const ok = x === q.p;
    for (const b of $("#opciones4").children) {
      b.disabled = true;
      if (b.dataset.id === q.p.id) b.classList.add("correcta");
      else if (b.dataset.id === x.id) b.classList.add("elegida-mal");
    }
    const campo = q.dir === "pc" ? "capital" : "pais";
    const res = ok ? { ok: true, exacta: true, nombre: x[campo] } : { ok: false, eleccion: x };
    registrar(res, x[campo]);
  }

  function registrar(res, texto, pasada = false) {
    const r = ronda;
    const q = r.preguntas[r.i];
    r.respondida = true;
    const pensado = pararCrono();
    $("#hud-tiempo").textContent = formatoTiempo(tiempoJugado(r));
    clearInterval(temporizadorReloj);
    let ganados = 0;
    if (r.maraton) {
      // Maratón: suma el acierto (con pista no suma), un fallo vuelve a 0, y se guarda al momento.
      const m = r.maraton;
      m.segundos += pensado / 1000;
      q.cambio = P.registrarRespuesta(m, q.p.id, res.ok ? (r.pista ? "pista" : "acierto") : "fallo");
      guardarMaraton(m);
      pintarContador(q.cambio.despues, { animar: true });
      const c = $("#contador-maraton");
      if (q.cambio.despues > q.cambio.antes && !q.cambio.dominado) c.classList.add("suma");
      if (!res.ok && q.cambio.antes > 0 && !q.cambio.relleno) c.classList.add("reinicia");
      if (q.cambio.dominado) {
        // Asterisco completo: gira, brilla, estalla tres veces y se queda latiendo con «¡Dominado!» (unos 3 segundos)
        c.classList.add("explota");
        $("#caja-pregunta").classList.add("dominado");
        setTimeout(() => { confeti(90, c); sonido.fanfarria(); }, 800);
        setTimeout(() => confeti(170, c), 2100);
      }
    }
    if (res.ok) {
      r.aciertos++;
      r.racha++;
      r.mejorRacha = Math.max(r.mejorRacha, r.racha);
      ganados = res.exacta ? 100 : 80;
      if (r.pista) ganados = Math.round(ganados / 2);
      ganados += Math.min(r.racha - 1, 10) * 10;
      if (ajustes.tiempo && r.restante) ganados += Math.round(r.restante * 3);
      r.puntos += ganados;
    } else {
      r.fallos++;
      r.racha = 0;
    }
    r.historial.push({ q, ok: res.ok, texto, exacta: res.exacta, pasada, agotado: res.agotado });
    actualizarHud(res.ok ? "#hud-aciertos" : "#hud-fallos");
    if (res.ok && (!r.maraton || q.cambio.dominado)) actualizarHud("#hud-puntos");

    // Entrada y acciones
    $("#entrada").disabled = true;
    $("#btn-comprobar").disabled = true;
    $("#acciones-pregunta").hidden = true;
    if (modoActual() === "opciones") {
      for (const b of $("#opciones4").children) {
        b.disabled = true;
        if (b.dataset.id === q.p.id) b.classList.add("correcta");
      }
    }

    // Sello
    const sello = $("#sello");
    sello.className = "sello" + (res.ok ? (res.exacta ? "" : " casi") : " mal");
    $("#sello-texto").textContent = res.ok ? (res.exacta ? "Correcto" : "Casi") : pasada ? "Pasada" : res.agotado ? "Tiempo" : "Fallo";
    sello.hidden = false;
    sello.style.animation = "none"; void sello.offsetWidth; sello.style.animation = "";
    if (res.ok) {
      res.exacta ? sonido.acierto() : sonido.casi();
      confeti(r.racha >= 5 ? 90 : 36, sello);
    } else {
      sonido.fallo();
      const caja = $("#caja-pregunta");
      caja.classList.remove("tiembla"); void caja.offsetWidth; caja.classList.add("tiembla");
    }

    mostrarRevelado(q, res, texto, ganados, pasada);
  }

  function mostrarRevelado(q, res, texto, ganados, pasada) {
    const p = q.p;
    const v = $("#veredicto");
    const esPais = q.dir === "pc";
    const par = esPais
      ? `${escapar(p.pais)}<span class="flecha">→</span>${escapar(p.capital)}`
      : `${escapar(p.capital)}<span class="flecha">→</span>${escapar(p.pais)}`;
    let detalle = "";
    const enMaraton = !!ronda.maraton;
    if (res.ok && res.exacta) {
      detalle = enMaraton ? "¡Bien!" : `¡Bien! <strong>+${ganados}</strong> puntos${ronda.racha > 1 ? ` · racha de ${ronda.racha}` : ""}.`;
      const principal = esPais ? p.capital : p.pais;
      if (normalizar(res.nombre) !== normalizar(principal)) detalle += ` También se dice <strong>${escapar(principal)}</strong>.`;
    } else if (res.ok) {
      detalle = `Te lo damos por bueno${enMaraton ? "" : ` (<strong>+${ganados}</strong>)`}, pero se escribe <strong>${escapar(res.nombre)}</strong>.`;
    } else if (pasada) {
      detalle = "Pregunta pasada.";
    } else if (res.agotado) {
      detalle = "Se acabó el tiempo.";
    } else if (res.eleccion) {
      const x = res.eleccion;
      detalle = esPais
        ? `<strong>${escapar(x.capital)}</strong> es la capital de ${escapar(x.pais)}.`
        : `La capital de <strong>${escapar(x.pais)}</strong> es ${escapar(x.capital)}.`;
    } else {
      const escrito = `«${escapar(texto.trim())}»`;
      if (res.comoCapital && res.comoCapital !== p) {
        detalle = `Has escrito ${escrito}: es la capital de <strong>${escapar(res.comoCapital.pais)}</strong>.`;
      } else if (res.comoPais && res.comoPais !== p) {
        detalle = `Has escrito ${escrito}: eso es un país (su capital es <strong>${escapar(res.comoPais.capital)}</strong>).`;
      } else if (res.comoPais === p) {
        detalle = `Has escrito ${escrito}: eso es el país, y se pedía su capital.`;
      } else if (res.comoCapital === p) {
        detalle = `Has escrito ${escrito}: esa es la capital, y se pedía el país.`;
      } else {
        detalle = `Has escrito ${escrito}. No es correcto.`;
      }
    }
    // Si la respuesta es otro país (o la capital de otro), se dice a qué distancia está del correcto.
    const otro = res.ok ? null
      : res.eleccion || [res.comoCapital, res.comoPais].find((x) => x && x !== p) || null;
    let distancia = "";
    if (otro) {
      const km = formatoKm(distanciaKm(otro, p));
      const vecinos = (p.vecinos || []).includes(otro.id);
      distancia = `Entre ${escapar(otro.pais)} ${yE(p.pais)} ${escapar(p.pais)} hay unos <strong>${km} km</strong> ` +
        `(de ${escapar(otro.capital)} a ${escapar(p.capital)})${vecinos ? ", y son países vecinos" : ""}.`;
    }
    let lineaMaraton = "";
    if (enMaraton && q.cambio) {
      const { antes, despues, dominado, relleno } = q.cambio;
      const nombre = escapar(p.pais);
      const quedan = P.pendientes(ronda.maraton).length;
      if (relleno) {
        lineaMaraton = `<p class="detalle linea-maraton">Pregunta de repaso: ${nombre} ya lo tenías dominado, así que no cuenta. ` +
          "Sale para que no se repitan seguidos los pocos países que te quedan.</p>";
      } else if (dominado) {
        lineaMaraton = `<p class="detalle linea-maraton dominado">¡Dominado! ${nombre} ya no te saldrá más: tres aciertos seguidos. ` +
          (quedan ? `Te ${quedan === 1 ? "queda 1 país" : `quedan ${quedan} países`}.` : "¡Era el último!") + "</p>";
      } else if (despues > antes) {
        lineaMaraton = `<p class="detalle linea-maraton">Llevas ${despues} de 3 aciertos seguidos con ${nombre}.</p>`;
      } else if (res.ok) {
        lineaMaraton = `<p class="detalle linea-maraton">Con pista no suma: sigues con ${antes} de 3 con ${nombre}.</p>`;
      } else {
        lineaMaraton = `<p class="detalle linea-maraton">${antes ? `Vuelves a empezar con ${nombre}: tenías ${antes} de 3 seguidos.` : `${nombre} sigue en 0 de 3.`}</p>`;
      }
    }
    const extra = [formatoPoblacion(p.pob), CONTINENTES[p.cont]].filter(Boolean).join(" · ");
    v.innerHTML =
      `<p class="par">${par}</p>` +
      `<p class="detalle">${detalle}</p>` +
      lineaMaraton +
      (distancia ? `<p class="detalle distancia">${distancia}</p>` : "") +
      (extra ? `<p class="detalle">${escapar(p.capital)}: ${escapar(extra)}</p>` : "") +
      (p.nota ? `<p class="nota">${escapar(p.nota)}</p>` : "");

    $("#revelado").hidden = false;
    mostrarFoto(p);
    mostrarMapa(p, otro);
    if (!esPais) { const b = $("#bandera-pregunta"); b.src = rutaBandera(p.id); b.alt = `Bandera de ${p.pais}`; b.hidden = false; }

    const btn = $("#btn-siguiente");
    const ultima = enMaraton ? !P.pendientes(ronda.maraton).length : ronda.i + 1 >= ronda.preguntas.length;
    btn.querySelector("span").textContent = ultima ? "Ver resultado" : "Siguiente";
    btn.focus({ preventScroll: true });
    $("#revelado").scrollIntoView({ behavior: movimientoReducido ? "auto" : "smooth", block: "nearest" });
    programarSiguiente(!res.ok ? PAUSA_FALLO : q.cambio && q.cambio.dominado ? PAUSA_DOMINADO : PAUSA_ACIERTO);
  }

  function mostrarFoto(p) {
    const marco = $(".foto-marco");
    const img = $("#foto-img");
    const pie = $("#foto-pie");
    img.classList.remove("cargada");
    img.removeAttribute("src");
    img.onload = () => img.classList.add("cargada");
    // Sin foto (sin conexión o sin imagen en Wikipedia) la postal lleva la bandera.
    const ponerBandera = () => {
      marco.classList.add("bandera");
      img.onerror = null;
      img.alt = `Bandera de ${p.pais}`;
      img.src = rutaBandera(p.id);
      fotoGrande = img.src;
      pie.textContent = `Bandera de ${p.pais}`;
    };
    const poner = (dato) => {
      if (!dato) { ponerBandera(); return; }
      marco.classList.remove("bandera");
      img.onerror = ponerBandera;
      img.alt = `Vista de ${p.capital}`;
      img.src = dato.src;
      // Las miniaturas de Wikimedia se piden a 800 px; para ampliar, la de 1600 px.
      fotoGrande = /\/\d+px-[^/]+$/.test(dato.src) ? dato.src.replace(/\/\d+px-([^/]+)$/, "/1600px-$1") : dato.src;
      pie.innerHTML = `${escapar(p.capital)} · Foto: <a href="${dato.url}" target="_blank" rel="noopener">Wikipedia / Wikimedia Commons</a>`;
    };
    if (fotos.has(p.wiki)) { poner(fotos.get(p.wiki)); return; }
    if (!fotosDisponibles) { ponerBandera(); return; }
    // Aún cargando: se muestra el marco vacío y se rellena al llegar.
    marco.classList.remove("bandera");
    pie.textContent = "Buscando foto…";
    promesaFotos.then(() => (fotos.has(p.wiki) ? null : precargarFotos([p.wiki]))).then(() => {
      if (ronda && ronda.preguntas[ronda.i].p === p) poner(fotosDisponibles ? fotos.get(p.wiki) || null : null);
    });
  }

  function programarSiguiente(ms) {
    clearTimeout(temporizadorSiguiente);
    const barra = $("#cuenta-atras");
    barra.classList.remove("activa");
    $("#pausa-aviso").hidden = true;
    if (!ajustes.auto) return;
    barra.style.setProperty("--duracion", ms + "ms");
    void barra.offsetWidth;
    barra.classList.add("activa");
    temporizadorSiguiente = setTimeout(siguiente, ms);
  }
  function pausar() {
    if (!temporizadorSiguiente || !ronda || !ronda.respondida) return;
    clearTimeout(temporizadorSiguiente);
    temporizadorSiguiente = 0;
    $("#cuenta-atras").classList.remove("activa");
    $("#pausa-aviso").hidden = false;
  }
  // Caja de luz: la foto (o la bandera) al doble de tamaño
  let fotoGrande = "";
  function abrirCajaLuz() {
    const img = $("#foto-img");
    if (!img.getAttribute("src")) return;
    pausar();
    const grande = $("#caja-luz-img");
    grande.style.width = Math.round($("#foto-ampliar").getBoundingClientRect().width * 2) + "px";
    grande.alt = img.alt;
    grande.onerror = () => { grande.onerror = null; grande.src = img.src; }; // si no hay versión grande, la normal
    grande.src = fotoGrande || img.src;
    $("#caja-luz-pie").innerHTML = $("#foto-pie").innerHTML;
    $("#caja-luz").hidden = false;
    $("#caja-luz-cerrar").focus();
  }
  function cerrarCajaLuz() {
    $("#caja-luz").hidden = true;
    $("#foto-ampliar").focus({ preventScroll: true });
  }
  $("#foto-ampliar").addEventListener("click", abrirCajaLuz);
  $("#caja-luz").addEventListener("click", (e) => { if (!e.target.closest("a")) cerrarCajaLuz(); });
  $("#veredicto").addEventListener("click", pausar);

  function siguiente() {
    clearTimeout(temporizadorSiguiente);
    temporizadorSiguiente = 0;
    if (!ronda || !ronda.respondida) return;
    if (ronda.maraton) { siguienteMaraton(); return; }
    if (ronda.i + 1 >= ronda.preguntas.length) { terminar(); return; }
    ronda.i++;
    mostrarPregunta();
  }
  $("#btn-siguiente").addEventListener("click", siguiente);

  $("#btn-pasar").addEventListener("click", () => {
    if (ronda.respondida) return;
    registrar({ ok: false }, "", true);
  });
  $("#btn-abandonar").addEventListener("click", () => {
    if (!ronda) return;
    if (ronda.maraton) { pausarMaraton(); return; }
    if (!ronda.historial.length) { clearInterval(temporizadorReloj); clearInterval(temporizadorCrono); mostrarPantalla("inicio"); return; }
    ronda.preguntas = ronda.preguntas.slice(0, ronda.historial.length);
    ronda.respondida = true;
    ronda.abandonada = true;
    terminar();
  });
  $("#btn-pista").addEventListener("click", () => {
    if (ronda.respondida || ronda.pista) return;
    const q = ronda.preguntas[ronda.i];
    ronda.pista = 1;
    $("#btn-pista").disabled = true;
    if (modoActual() === "opciones") {
      // 50 %: se descartan dos opciones incorrectas.
      const malas = barajar([...$("#opciones4").children].filter((b) => b.dataset.id !== q.p.id)).slice(0, 2);
      for (const b of malas) { b.classList.add("descartada"); b.disabled = true; }
    } else {
      const respuesta = q.dir === "pc" ? q.p.capital : q.p.pais;
      const oculta = [...respuesta].map((c, i) => (i === 0 || c === " " || c === "-" ? c : "_")).join("");
      const pista = $("#texto-pista");
      pista.textContent = `${oculta}  (${respuesta.replace(/[\s-]/g, "").length} letras)`;
      pista.hidden = false;
      $("#entrada").focus();
    }
  });

  /* ------------------------------------------------------------------
     Final de ronda
     ------------------------------------------------------------------ */
  function terminar() {
    const r = ronda;
    clearInterval(temporizadorReloj);
    clearInterval(temporizadorCrono);
    clearTimeout(temporizadorSiguiente);
    const total = r.historial.length;
    const pct = total ? Math.round((r.aciertos / total) * 100) : 0;
    pararCrono();
    const tiempo = tiempoJugado(r);
    const titulo = pct === 100 ? "Diplomático de carrera" : pct >= 80 ? "Trotamundos" : pct >= 60 ? "Viajero frecuente" : pct >= 40 ? "Turista con mapa" : "Toca repasar el atlas";
    $("#final-titulo").textContent = titulo;
    $("#final-antetitulo").textContent = r.repaso ? "Repaso terminado" : `Ronda terminada · ${TEXTO_DIR[ajustes.dir]}`;
    etiquetasFinal(["puntos", "mejor racha", "tiempo total", "Para repasar"]);
    $("#btn-otra").hidden = false;
    $("#f-puntos").textContent = formatoNumero(r.puntos);
    $("#f-aciertos").textContent = `${r.aciertos}/${total}`;
    $("#f-pct").textContent = `${pct} % de aciertos`;
    $("#f-racha").textContent = r.mejorRacha;
    $("#f-tiempo").textContent = formatoTiempo(tiempo);

    // Récord por combinación de ajustes (solo rondas completas, no repasos)
    let nuevoRecord = false;
    if (!r.repaso && total) {
      const records = almacen.leer("capitales.records", {});
      const firma = firmaAjustes();
      if (!records[firma] || r.puntos > records[firma].puntos) {
        nuevoRecord = !!records[firma];
        records[firma] = { puntos: r.puntos, pct, fecha: new Date().toISOString().slice(0, 10) };
        almacen.guardar("capitales.records", records);
      }
    }
    $("#final-record").hidden = !nuevoRecord;

    // Historial de rondas (se guarda en el navegador y va en la copia de seguridad)
    if (!r.repaso && total) {
      const historial = almacen.leer("capitales.historial", []);
      historial.push({
        fecha: new Date().toISOString(), ...r.modalidad, preguntas: total, aciertos: r.aciertos,
        puntos: r.puntos, segundos: Math.round(tiempo / 1000), completa: !r.abandonada,
      });
      almacen.guardar("capitales.historial", historial.slice(-P.MAX_HISTORIAL));
    }

    const sellos = $("#sellos");
    sellos.textContent = "";
    r.historial.forEach((h, i) => {
      const d = document.createElement("div");
      d.className = "sello-pais" + (h.ok ? "" : " mal");
      d.style.animationDelay = Math.min(i * 25, 1500) + "ms";
      d.title = `${h.q.p.pais} — ${h.q.p.capital}`;
      d.innerHTML = `<img src="${rutaBandera(h.q.p.id)}" alt="" loading="lazy"><i>${h.ok ? "✓" : "✕"}</i><span>${escapar(h.q.p.pais)}</span>`;
      sellos.appendChild(d);
    });

    const fallos = r.historial.filter((h) => !h.ok);
    const lista = $("#lista-fallos");
    lista.textContent = "";
    for (const h of fallos) {
      const li = document.createElement("li");
      const tu = h.pasada ? "pasada" : h.agotado ? "sin tiempo" : h.texto ? `tu respuesta: «${escapar(h.texto.trim())}»` : "";
      li.innerHTML = `<img src="${rutaBandera(h.q.p.id)}" alt=""><strong>${escapar(h.q.p.pais)}</strong> → ${escapar(h.q.p.capital)}` +
        (tu ? `<span class="tu">${tu}</span>` : "");
      lista.appendChild(li);
    }
    $("#caja-fallos").hidden = !fallos.length;
    $("#btn-repetir-fallos").hidden = !fallos.length;
    // Solo las rondas completas (ni repasos ni rondas terminadas antes de tiempo) van al muro.
    window.Muro.alTerminar({
      publicable: !r.repaso && !r.abandonada && total > 0,
      ...r.modalidad, puntos: r.puntos, aciertos: r.aciertos, preguntas: total,
      segundos: Math.max(1, Math.round(tiempo / 1000)),
    });
    mostrarPantalla("final");
    if (pct >= 80 || nuevoRecord) { confeti(160); sonido.fanfarria(); }
  }

  function etiquetasFinal([puntos, racha, tiempo, fallos]) {
    $("#f-puntos-etq").textContent = puntos;
    $("#f-racha-etq").textContent = racha;
    $("#f-tiempo-etq").textContent = tiempo;
    $("#fallos-titulo").textContent = fallos;
  }

  function terminarMaraton() {
    const m = ronda.maraton;
    detenerRonda();
    const maratones = almacen.leer("capitales.maratones", []);
    maratones.push(P.resumenMaraton(m));
    almacen.guardar("capitales.maratones", maratones.slice(-100));
    guardarMaraton(null);

    const total = P.total(m);
    const pct = m.turno ? Math.round((m.aciertos / m.turno) * 100) : 0;
    const dias = Math.max(1, Math.ceil((Date.now() - new Date(m.creada)) / 86400000));
    $("#final-antetitulo").textContent = `Maratón · ${TEXTO_DIR[m.dir]} · ${TEXTO_MODO[m.modo]} · ${textoZona(m.zona)}`;
    $("#final-titulo").textContent = "¡Maratón completada!";
    $("#final-record").hidden = true;
    etiquetasFinal(["países dominados", "preguntas", dias === 1 ? "jugando, en 1 día" : `jugando, en ${dias} días`, "Los que más te costaron"]);
    $("#f-puntos").textContent = total;
    $("#f-aciertos").textContent = `${formatoNumero(m.aciertos)}/${formatoNumero(m.turno)}`;
    $("#f-pct").textContent = `${pct} % de aciertos`;
    $("#f-racha").textContent = formatoNumero(m.turno);
    $("#f-tiempo").textContent = formatoDuracion(m.segundos);

    const sellos = $("#sellos");
    sellos.textContent = "";
    Object.keys(m.paises).map((id) => PAIS[id]).sort((a, b) => a.pais.localeCompare(b.pais, "es")).forEach((p, i) => {
      const d = document.createElement("div");
      d.className = "sello-pais";
      d.style.animationDelay = Math.min(i * 10, 1500) + "ms";
      d.title = `${p.pais} — ${p.capital}`;
      d.innerHTML = `<img src="${rutaBandera(p.id)}" alt="" loading="lazy"><i>✓</i><span>${escapar(p.pais)}</span>`;
      sellos.appendChild(d);
    });
    const lista = $("#lista-fallos");
    lista.textContent = "";
    const dificiles = P.masFallados(m, 10);
    for (const { id, fallos } of dificiles) {
      const p = PAIS[id];
      const li = document.createElement("li");
      li.innerHTML = `<img src="${rutaBandera(id)}" alt=""><strong>${escapar(p.pais)}</strong> → ${escapar(p.capital)}` +
        `<span class="tu">${fallos} ${fallos === 1 ? "fallo" : "fallos"}</span>`;
      lista.appendChild(li);
    }
    $("#caja-fallos").hidden = !dificiles.length;
    $("#btn-repetir-fallos").hidden = true;
    $("#btn-otra").hidden = true;
    window.Muro.alTerminar({ publicable: false });
    ronda = null;
    mostrarPantalla("final");
    confeti(220);
    sonido.fanfarria();
  }

  $("#btn-repetir-fallos").addEventListener("click", () => {
    const pool = ronda.historial.filter((h) => !h.ok).map((h) => h.q.p);
    empezarRonda(pool, { repaso: true });
  });
  $("#btn-otra").addEventListener("click", () => empezarRonda(poolActual()));
  $("#btn-opciones").addEventListener("click", () => { refrescarOpciones(); mostrarPantalla("inicio"); });

  /* ------------------------------------------------------------------
     Teclado
     ------------------------------------------------------------------ */
  document.addEventListener("keydown", (e) => {
    if (!$("#caja-luz").hidden) {
      if (e.key === "Escape" || e.key === "Enter") { e.preventDefault(); cerrarCajaLuz(); }
      return;
    }
    if ($("#pantalla-juego").hidden || !ronda) return;
    if (e.key === "Enter" && ronda.respondida && document.activeElement !== $("#entrada")) {
      e.preventDefault();
      siguiente();
      return;
    }
    if (modoActual() === "opciones" && !ronda.respondida && /^[1-4]$/.test(e.key)) {
      const b = $("#opciones4").children[Number(e.key) - 1];
      if (b && !b.disabled) b.click();
    }
  });

  /* ------------------------------------------------------------------
     Tabla bidireccional
     ------------------------------------------------------------------ */
  const estadoTabla = { conts: new Set(Object.keys(CONTINENTES)), orden: "pais", desc: false };
  function pintarChipsTabla() {
    const caja = $("#chips-tabla");
    caja.textContent = "";
    for (const [clave, nombre] of Object.entries(CONTINENTES)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.setAttribute("aria-pressed", String(estadoTabla.conts.has(clave)));
      b.innerHTML = `${nombre} <small>${PAISES.filter((p) => p.cont === clave).length}</small>`;
      b.addEventListener("click", () => {
        if (estadoTabla.conts.size === Object.keys(CONTINENTES).length) estadoTabla.conts = new Set([clave]);
        else if (estadoTabla.conts.has(clave)) estadoTabla.conts.delete(clave);
        else estadoTabla.conts.add(clave);
        if (!estadoTabla.conts.size) estadoTabla.conts = new Set(Object.keys(CONTINENTES));
        pintarChipsTabla();
        pintarTabla();
      });
      caja.appendChild(b);
    }
  }
  function resaltar(texto, consulta) {
    if (!consulta) return escapar(texto);
    const n = normalizar(texto);
    const i = n.indexOf(consulta);
    // normalizar() conserva la longitud salvo en apóstrofos; si no cuadra, no se resalta
    if (i < 0 || n.length !== texto.length) return escapar(texto);
    return escapar(texto.slice(0, i)) + "<mark>" + escapar(texto.slice(i, i + consulta.length)) + "</mark>" + escapar(texto.slice(i + consulta.length));
  }
  function pintarTabla() {
    const consulta = normalizar($("#buscar").value);
    const filas = PAISES.filter((p) => estadoTabla.conts.has(p.cont)).filter((p) => {
      if (!consulta) return true;
      return [p.pais, p.capital, ...p.paisAlt, ...p.capitalAlt].some((n) => normalizar(n).includes(consulta));
    });
    filas.sort((a, b) => a[estadoTabla.orden].localeCompare(b[estadoTabla.orden], "es") * (estadoTabla.desc ? -1 : 1));
    const cuerpo = $("#tabla-cuerpo");
    cuerpo.innerHTML = filas.map((p) => `
      <tr>
        <td><img src="${rutaBandera(p.id)}" alt="" loading="lazy" width="36" height="27"></td>
        <td>${resaltar(p.pais, consulta)}${p.limitado ? '<span class="limitado">Reconocimiento limitado</span>' : ""}</td>
        <td class="c-capital">${resaltar(p.capital, consulta)}${p.nota ? `<span class="c-nota">${escapar(p.nota)}</span>` : ""}</td>
        <td class="c-cont">${CONTINENTES[p.cont]}</td>
        <td class="c-fuentes">${p.fuentes}</td>
      </tr>`).join("") || `<tr><td colspan="5">Nada coincide con «${escapar($("#buscar").value)}».</td></tr>`;
    for (const b of document.querySelectorAll(".orden")) {
      if (b.dataset.orden === estadoTabla.orden) b.setAttribute("aria-sort", estadoTabla.desc ? "descending" : "ascending");
      else b.removeAttribute("aria-sort");
    }
    // Respuesta directa usando la tabla clave-valor en los dos sentidos
    const texto = $("#buscar").value.trim();
    const directa = $("#respuesta-directa");
    const porPais = texto && capitalDe(texto);
    const porCapital = texto && paisDe(texto);
    if (porPais && porCapital && porPais === porCapital) directa.innerHTML = `${escapar(porPais.capital)} es la capital de <em>${escapar(porPais.pais)}</em>`;
    else if (porPais) directa.innerHTML = `La capital de ${escapar(porPais.pais)} es <em>${escapar(porPais.capital)}</em>`;
    else if (porCapital) directa.innerHTML = `${escapar(porCapital.capital)} es la capital de <em>${escapar(porCapital.pais)}</em>`;
    else directa.textContent = texto ? `${filas.length} ${filas.length === 1 ? "resultado" : "resultados"}` : `${filas.length} países`;
  }
  $("#buscar").addEventListener("input", pintarTabla);
  for (const b of document.querySelectorAll(".orden")) {
    b.addEventListener("click", () => {
      if (estadoTabla.orden === b.dataset.orden) estadoTabla.desc = !estadoTabla.desc;
      else { estadoTabla.orden = b.dataset.orden; estadoTabla.desc = false; }
      pintarTabla();
    });
  }

  /* ------------------------------------------------------------------
     Tus datos: lo guardado en el navegador y la copia de seguridad en JSON
     ------------------------------------------------------------------ */
  function estadoDatos(texto, error = false) {
    const e = $("#md-estado");
    e.textContent = texto;
    e.classList.toggle("error", error);
  }
  function pintarMisDatos() {
    const historial = almacen.leer("capitales.historial", []);
    const maratones = almacen.leer("capitales.maratones", []);
    const m = leerMaraton();
    const partes = [historial.length ? `${historial.length} ${historial.length === 1 ? "ronda jugada" : "rondas jugadas"}` : "aún ninguna ronda"];
    if (m) partes.push(`una maratón en curso (${P.dominados(m)} de ${P.total(m)})`);
    if (maratones.length) partes.push(`${maratones.length} ${maratones.length === 1 ? "maratón completada" : "maratones completadas"}`);
    $("#md-resumen").textContent = `Se guardan solos en este navegador: ${partes.join(", ")}. ` +
      "Descarga una copia para seguir en otro ordenador o por si borras los datos del navegador.";
    const lista = $("#lista-historial");
    lista.textContent = "";
    for (const h of historial.slice(-10).reverse()) {
      const li = document.createElement("li");
      const fecha = new Date(h.fecha);
      const modalidad = [TEXTO_DIR[h.dir], TEXTO_MODO[h.modo], `${h.preguntas} preguntas`, h.zona ? textoZona(h.zona) : ""].filter(Boolean).join(" · ");
      li.innerHTML = `<span class="fecha"></span><span class="modalidad"></span><span>${h.aciertos}/${h.preguntas}</span><span class="puntos">${formatoNumero(h.puntos || 0)} puntos</span>`;
      li.querySelector(".fecha").textContent = isNaN(fecha) ? "" : fecha.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + ", " + fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
      li.querySelector(".modalidad").textContent = modalidad + (h.completa === false ? " (sin terminar)" : "");
      lista.appendChild(li);
    }
    $("#md-historial").hidden = !historial.length;
  }

  function datosGuardados() {
    return {
      ajustes, records: almacen.leer("capitales.records", {}), historial: almacen.leer("capitales.historial", []),
      maraton: leerMaraton(), maratones: almacen.leer("capitales.maratones", []),
    };
  }
  // Dentro de claude.ai las descargas pasan por la plataforma (pide confirmación); en la web, un enlace normal.
  let descargasClaude = null;
  const enClaude = !!(window.claude && typeof window.claude.use === "function");
  if (enClaude) {
    window.claude.use("downloads").then((d) => {
      descargasClaude = d;
      if (!d) $("#btn-descargar").hidden = true; // esta vista no permite guardar archivos
    }).catch(() => { $("#btn-descargar").hidden = true; });
  }
  $("#btn-descargar").addEventListener("click", async () => {
    const copia = JSON.stringify(P.exportar(datosGuardados()), null, 1);
    const nombre = `capitales-progreso-${new Date().toISOString().slice(0, 10)}.json`;
    if (enClaude) {
      if (!descargasClaude) { estadoDatos("Aquí no se pueden guardar archivos. Descarga la copia desde la web del juego.", true); return; }
      try {
        await descargasClaude.save({ filename: nombre, data: copia });
        estadoDatos("Copia guardada. Para recuperarla, usa «Cargar mi progreso».");
      } catch (e) {
        if (e && e.code === "declined") estadoDatos("Has cancelado la descarga.");
        else if (e && e.code === "rate_limited") estadoDatos("Ya hay una descarga pendiente de confirmar.", true);
        else estadoDatos("No se ha podido guardar la copia. Prueba desde la web del juego.", true);
      }
      return;
    }
    const url = URL.createObjectURL(new Blob([copia], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    estadoDatos("Copia descargada. Para recuperarla, usa «Cargar mi progreso».");
  });

  let cargaPendiente = null;
  function describirCopia(d) {
    const fecha = d.exportado ? new Date(d.exportado) : null;
    const partes = [`${d.historial.length} ${d.historial.length === 1 ? "ronda" : "rondas"}`];
    if (d.maraton) partes.unshift(`una maratón con ${P.dominados(d.maraton)} de ${P.total(d.maraton)} países dominados`);
    return `Copia${fecha && !isNaN(fecha) ? ` del ${fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}` : ""}: ${partes.join(" y ")}.`;
  }
  function aplicarCarga() {
    const d = cargaPendiente;
    cargaPendiente = null;
    $("#md-confirmar").hidden = true;
    if (!d) return;
    if (d.ajustes) ajustes = limpiarAjustes(d.ajustes, ajustes);
    almacen.guardar("capitales.records", d.records);
    almacen.guardar("capitales.historial", d.historial);
    almacen.guardar("capitales.maratones", d.maratones);
    guardarMaraton(d.maraton);
    refrescarOpciones();
    pintarMaratonCurso();
    pintarMisDatos();
    estadoDatos("Progreso cargado." + (d.maraton ? " Pulsa «Continuar maratón» para seguir donde lo dejaste." : ""));
  }
  $("#btn-cargar").addEventListener("click", () => $("#archivo-progreso").click());
  $("#archivo-progreso").addEventListener("change", async (e) => {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    let texto;
    try { texto = await archivo.text(); } catch { estadoDatos("No se ha podido leer el archivo.", true); return; }
    const r = P.validar(texto, IDS);
    if (!r.ok) { estadoDatos(r.error, true); return; }
    cargaPendiente = r.datos;
    const actual = datosGuardados();
    const hayAlgo = actual.maraton || actual.historial.length || actual.maratones.length || Object.keys(actual.records).length;
    if (!hayAlgo) { aplicarCarga(); return; }
    estadoDatos("");
    $("#md-confirmar-texto").textContent = `${describirCopia(r.datos)} Sustituirá lo que hay guardado ahora en este navegador.`;
    $("#md-confirmar").hidden = false;
    $("#btn-cancelar-carga").focus();
  });
  $("#btn-confirmar-carga").addEventListener("click", aplicarCarga);
  $("#btn-cancelar-carga").addEventListener("click", () => { cargaPendiente = null; $("#md-confirmar").hidden = true; });

  /* ------------------------------------------------------------------
     Navegación y arranque
     ------------------------------------------------------------------ */
  function irAInicio() {
    if (ronda && ronda.maraton && !$("#pantalla-juego").hidden) { pausarMaraton(); return; }
    if (ronda && !$("#pantalla-juego").hidden && ronda.historial.length) {
      // Salir a mitad de ronda la cierra con lo jugado hasta ahora.
      $("#btn-abandonar").click();
      return;
    }
    clearInterval(temporizadorReloj);
    clearInterval(temporizadorCrono);
    clearTimeout(temporizadorSiguiente);
    refrescarOpciones();
    mostrarPantalla("inicio");
  }
  $("#btn-marca").addEventListener("click", irAInicio);
  $("#nav-jugar").addEventListener("click", irAInicio);
  function detenerRonda() {
    clearInterval(temporizadorReloj);
    clearInterval(temporizadorCrono);
    clearTimeout(temporizadorSiguiente);
  }
  $("#nav-tabla").addEventListener("click", () => {
    detenerRonda();
    ronda = null;
    pintarChipsTabla();
    pintarTabla();
    mostrarPantalla("tabla");
    $("#buscar").focus({ preventScroll: true });
  });
  $("#nav-muro").addEventListener("click", () => {
    if (!$("#pantalla-juego").hidden) { detenerRonda(); ronda = null; }
    window.Muro.abrir();
  });
  window.JUEGO = { mostrarPantalla, proyectar };
  const botonSonido = $("#btn-sonido");
  function pintarBotonSonido() {
    botonSonido.setAttribute("aria-pressed", String(sonido.activo));
    botonSonido.setAttribute("aria-label", sonido.activo ? "Sonido activado" : "Sonido desactivado");
  }
  botonSonido.addEventListener("click", () => {
    sonido.activo = !sonido.activo;
    almacen.guardar("capitales.sonido", sonido.activo);
    pintarBotonSonido();
    if (sonido.activo) sonido.acierto();
  });

  $("#total-paises").textContent = PAISES.filter((p) => !p.limitado).length;
  pintarBotonSonido();
  refrescarOpciones();
  if (location.hash === "#tabla") $("#nav-tabla").click();
  else if (location.hash === "#muro" && window.Muro.activo) window.Muro.abrir();
  else mostrarPantalla("inicio");
})();
