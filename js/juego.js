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

  const { normalizar, variantes, capitalDe, paisDe, evaluar, ARTICULO } = window.TABLA;

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
  const escapar = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const anunciar = (texto) => { $("#anuncio").textContent = texto; };

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
  function pintarTablero(el, texto, { anchoMax = 46, conSonido = true, unaLinea = false } = {}) {
    const palabras = texto.toUpperCase().split(/\s+/).filter(Boolean);
    const larga = unaLinea ? Math.max(texto.length + 0.5 * (palabras.length - 1), 8) : Math.max(...palabras.map((w) => w.length), 6);
    const disponible = (el.clientWidth || 600) - 36;
    const ancho = Math.max(14, Math.min(anchoMax, Math.floor(disponible / (larga + 0.6)) - 3));
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
  let animMapa = 0;
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
    const onda = document.createElementNS(NS, "circle");
    onda.setAttribute("class", "onda-pin");
    const pin = document.createElementNS(NS, "circle");
    pin.setAttribute("class", "pin");
    mapaSvg.append(onda, pin);
    mapaListo = true;
  }
  // Países cuya caja cruza el antimeridiano o es enorme: se centra en una vista fija.
  const VISTAS_ESPECIALES = { RU: [300, 20, 640, 400], US: [40, 60, 470, 294], FJ: null, KI: null, NZ: null, TV: null, TO: null, WS: null };
  function vistaDe(id) {
    const RATIO = 1.6;
    if (VISTAS_ESPECIALES[id]) return VISTAS_ESPECIALES[id];
    const [cx, cy] = MAPA.capitales[id];
    const caja = MAPA.cajas[id];
    let x, y, w;
    if (!caja || id in VISTAS_ESPECIALES || caja[2] - caja[0] > 450) {
      w = caja && caja[2] - caja[0] > 450 ? 220 : 110;
      x = cx; y = cy;
    } else {
      const bw = caja[2] - caja[0], bh = caja[3] - caja[1];
      w = Math.max(bw * 1.9, bh * 1.9 * RATIO, 70);
      x = (caja[0] + caja[2]) / 2; y = (caja[1] + caja[3]) / 2;
    }
    w = Math.min(w, MAPA.w);
    const h = w / RATIO;
    return [x - w / 2, y - h / 2, w, h];
  }
  function mostrarMapa(p) {
    construirMapa();
    mapaSvg.querySelectorAll(".destino").forEach((e) => e.classList.remove("destino"));
    const forma = mapaSvg.querySelector(`.pais[data-id="${p.id}"]`);
    if (forma) { forma.classList.add("destino"); mapaSvg.insertBefore(forma, mapaSvg.querySelector(".onda-pin")); }
    const destino = vistaDe(p.id);
    const [cx, cy] = MAPA.capitales[p.id];
    const r = Math.max(destino[2] / 110, 1.2);
    for (const c of mapaSvg.querySelectorAll(".pin, .onda-pin")) {
      c.setAttribute("cx", cx); c.setAttribute("cy", cy); c.setAttribute("r", r);
    }
    // Zoom animado: primero se aleja un poco y luego se acerca al destino.
    cancelAnimationFrame(animMapa);
    const inicio = [...vistaActual];
    const t0 = performance.now();
    const dur = movimientoReducido ? 1 : 1100;
    const suave = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (ahora) => {
      const t = Math.min(1, (ahora - t0) / dur);
      const e = suave(t);
      vistaActual = inicio.map((v, i) => v + (destino[i] - v) * e);
      mapaSvg.setAttribute("viewBox", vistaActual.map((v) => v.toFixed(2)).join(" "));
      if (t < 1) animMapa = requestAnimationFrame(tick);
    };
    animMapa = requestAnimationFrame(tick);
    $("#mapa-pie").textContent = `${p.capital}, ${p.pais} · ${CONTINENTES[p.cont]}`;
  }

  /* ------------------------------------------------------------------
     Ajustes
     ------------------------------------------------------------------ */
  const AJUSTES_POR_DEFECTO = {
    conts: Object.keys(CONTINENTES), n: 10, dir: "pc", modo: "escribir",
    tiempo: 0, erratas: true, auto: true, taiwan: false,
  };
  let ajustes = { ...AJUSTES_POR_DEFECTO, ...almacen.leer("capitales.ajustes", {}) };
  ajustes.conts = ajustes.conts.filter((c) => c in CONTINENTES);
  if (!ajustes.conts.length) ajustes.conts = Object.keys(CONTINENTES);

  const paisesDisponibles = () => PAISES.filter((p) => ajustes.taiwan || !p.limitado);
  const poolActual = () => paisesDisponibles().filter((p) => ajustes.conts.includes(p.cont));
  /** Preguntas de la ronda: la opción elegida, o todas si el grupo tiene menos países. */
  const nEfectivo = () => { const total = poolActual().length; return ajustes.n && ajustes.n < total ? ajustes.n : total; };
  const firmaAjustes = () => [ajustes.conts.slice().sort().join("+"), nEfectivo(), ajustes.dir, ajustes.modo, ajustes.taiwan ? "tw" : ""].join("|");
  const TEXTO_DIR = { pc: "País → capital", cp: "Capital → país", mix: "Mezcla" };

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
    almacen.guardar("capitales.ajustes", ajustes);
  }

  $("#form-opciones").addEventListener("change", (e) => {
    const t = e.target;
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
    empezarRonda(poolActual());
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
    const elegidos = barajar(PAISES.filter((p) => !p.limitado && p.pais.length <= 11 && p.capital.length <= 11)).slice(0, 3);
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
  const pantallas = ["inicio", "juego", "final", "tabla"];
  function mostrarPantalla(nombre) {
    for (const p of pantallas) $("#pantalla-" + p).hidden = p !== nombre;
    const enTabla = nombre === "tabla";
    $(enTabla ? "#nav-tabla" : "#nav-jugar").setAttribute("aria-current", "page");
    $(enTabla ? "#nav-jugar" : "#nav-tabla").removeAttribute("aria-current");
    if (nombre === "inicio") iniciarDemo(); else clearInterval(temporizadorDemo);
    window.scrollTo({ top: 0, behavior: movimientoReducido ? "auto" : "smooth" });
  }

  /* ------------------------------------------------------------------
     Ronda
     ------------------------------------------------------------------ */
  let ronda = null;
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
      inicio: performance.now(), historial: [], respondida: false, pista: 0, repaso,
    };
    promesaFotos = precargarFotos(preguntas.map((q) => q.p.wiki));
    mostrarPantalla("juego");
    clearInterval(temporizadorCrono);
    temporizadorCrono = setInterval(() => { $("#hud-tiempo").textContent = formatoTiempo(performance.now() - ronda.inicio); }, 500);
    $("#hud-tiempo").textContent = "0:00";
    actualizarHud();
    mostrarPregunta();
  }

  function actualizarHud(saltar) {
    const r = ronda;
    const total = r.preguntas.length;
    $("#hud-i").textContent = Math.min(r.i + 1, total);
    $("#hud-n").textContent = total;
    $("#hud-aciertos").textContent = r.aciertos;
    $("#hud-fallos").textContent = r.fallos;
    $("#hud-racha").textContent = r.racha;
    $("#hud-puntos").textContent = formatoNumero(r.puntos);
    $("#hud-racha-caja").classList.toggle("en-llamas", r.racha >= 5);
    const avance = (r.i + (r.respondida ? 1 : 0)) / total;
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
    const opciones = ajustes.modo === "opciones";
    $("#instruccion").textContent = esPais
      ? (opciones ? "¿Cuál es su capital?" : "Escribe su capital")
      : (opciones ? "¿De qué país es capital?" : "Escribe el país del que es capital");
    const bandera = $("#bandera-pregunta");
    // La bandera solo se enseña cuando no delata la respuesta.
    if (esPais) { bandera.src = rutaBandera(q.p.id); bandera.alt = `Bandera de ${q.p.pais}`; bandera.hidden = false; }
    else bandera.hidden = true;
    $("#sello").hidden = true;
    $("#revelado").hidden = true;
    $("#acciones-pregunta").hidden = false;
    $("#btn-pista").disabled = false;
    $("#texto-pista").hidden = true;
    pintarTablero($("#tablero"), esPais ? q.p.pais : q.p.capital);
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
    clearInterval(temporizadorReloj);
    let ganados = 0;
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
    if (res.ok) actualizarHud("#hud-puntos");

    // Entrada y acciones
    $("#entrada").disabled = true;
    $("#btn-comprobar").disabled = true;
    $("#acciones-pregunta").hidden = true;
    if (ajustes.modo === "opciones") {
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
    if (res.ok && res.exacta) {
      detalle = `¡Bien! <strong>+${ganados}</strong> puntos${ronda.racha > 1 ? ` · racha de ${ronda.racha}` : ""}.`;
      const principal = esPais ? p.capital : p.pais;
      if (normalizar(res.nombre) !== normalizar(principal)) detalle += ` También se dice <strong>${escapar(principal)}</strong>.`;
    } else if (res.ok) {
      detalle = `Te lo damos por bueno (<strong>+${ganados}</strong>), pero se escribe <strong>${escapar(res.nombre)}</strong>.`;
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
    const extra = [formatoPoblacion(p.pob), CONTINENTES[p.cont]].filter(Boolean).join(" · ");
    v.innerHTML =
      `<p class="par">${par}</p>` +
      `<p class="detalle">${detalle}</p>` +
      (extra ? `<p class="detalle">${escapar(p.capital)}: ${escapar(extra)}</p>` : "") +
      (p.nota ? `<p class="nota">${escapar(p.nota)}</p>` : "");

    $("#revelado").hidden = false;
    mostrarFoto(p);
    mostrarMapa(p);
    if (!esPais) { const b = $("#bandera-pregunta"); b.src = rutaBandera(p.id); b.alt = `Bandera de ${p.pais}`; b.hidden = false; }

    const btn = $("#btn-siguiente");
    btn.querySelector("span").textContent = ronda.i + 1 >= ronda.preguntas.length ? "Ver resultado" : "Siguiente";
    btn.focus({ preventScroll: true });
    $("#revelado").scrollIntoView({ behavior: movimientoReducido ? "auto" : "smooth", block: "nearest" });
    programarSiguiente(res.ok ? 2600 : 5200);
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
      pie.textContent = `Bandera de ${p.pais}`;
    };
    const poner = (dato) => {
      if (!dato) { ponerBandera(); return; }
      marco.classList.remove("bandera");
      img.onerror = ponerBandera;
      img.alt = `Vista de ${p.capital}`;
      img.src = dato.src;
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
  $(".postal").addEventListener("click", (e) => { if (!e.target.closest("a")) pausar(); });
  $("#veredicto").addEventListener("click", pausar);

  function siguiente() {
    clearTimeout(temporizadorSiguiente);
    temporizadorSiguiente = 0;
    if (!ronda || !ronda.respondida) return;
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
    if (!ronda.historial.length) { clearInterval(temporizadorReloj); clearInterval(temporizadorCrono); mostrarPantalla("inicio"); return; }
    ronda.preguntas = ronda.preguntas.slice(0, ronda.historial.length);
    ronda.respondida = true;
    terminar();
  });
  $("#btn-pista").addEventListener("click", () => {
    if (ronda.respondida || ronda.pista) return;
    const q = ronda.preguntas[ronda.i];
    ronda.pista = 1;
    $("#btn-pista").disabled = true;
    if (ajustes.modo === "opciones") {
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
    const tiempo = performance.now() - r.inicio;
    const titulo = pct === 100 ? "Diplomático de carrera" : pct >= 80 ? "Trotamundos" : pct >= 60 ? "Viajero frecuente" : pct >= 40 ? "Turista con mapa" : "Toca repasar el atlas";
    $("#final-titulo").textContent = titulo;
    $("#final-antetitulo").textContent = r.repaso ? "Repaso terminado" : `Ronda terminada · ${TEXTO_DIR[ajustes.dir]}`;
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
    mostrarPantalla("final");
    if (pct >= 80 || nuevoRecord) { confeti(160); sonido.fanfarria(); }
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
    if ($("#pantalla-juego").hidden || !ronda) return;
    if (e.key === "Enter" && ronda.respondida && document.activeElement !== $("#entrada")) {
      e.preventDefault();
      siguiente();
      return;
    }
    if (ajustes.modo === "opciones" && !ronda.respondida && /^[1-4]$/.test(e.key)) {
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
     Navegación y arranque
     ------------------------------------------------------------------ */
  function irAInicio() {
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
  $("#nav-tabla").addEventListener("click", () => {
    clearInterval(temporizadorReloj);
    clearInterval(temporizadorCrono);
    clearTimeout(temporizadorSiguiente);
    ronda = null;
    pintarChipsTabla();
    pintarTabla();
    mostrarPantalla("tabla");
    $("#buscar").focus({ preventScroll: true });
  });
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
  else mostrarPantalla("inicio");
})();
