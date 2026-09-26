/* Capitales del mundo — muro público de resultados y ranking.
   Guarda los resultados en Supabase (config en js/muro-config.js). Sin configuración, el muro no aparece.
   Depende de window.CONTINENTES, window.TABLA y, al navegar, de window.JUEGO. */
(() => {
  "use strict";

  const config = window.MURO_CONFIG;
  const activo = !!(config && config.url && config.clave);
  const CONTINENTES = window.CONTINENTES;
  const { normalizar } = window.TABLA;
  const $ = (s) => document.querySelector(s);

  const TEXTO_DIR = { pc: "País → capital", cp: "Capital → país", mix: "Mezcla" };
  const TEXTO_MODO = { escribir: "Escribiendo", opciones: "4 opciones" };
  const CAMPOS = "id,creado,nombre,puntos,aciertos,preguntas,dir,modo,zona,limite,segundos";
  const leer = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };

  /* ------------------------------------------------------------------
     Textos
     ------------------------------------------------------------------ */
  function textoZona(zona) {
    if (zona === "todo") return "Todo el mundo";
    return zona.split("+").map((c) => CONTINENTES[c] || c).join(" + ");
  }
  function textoModalidad(x) {
    return [TEXTO_DIR[x.dir], TEXTO_MODO[x.modo], `${x.preguntas} preguntas`, textoZona(x.zona),
      x.limite ? `${x.limite} s por pregunta` : ""].filter(Boolean).join(" · ");
  }
  const formatoNumero = (n) => n.toLocaleString("es-ES");
  const formatoTiempo = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const relativo = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  function hace(fecha) {
    const s = (new Date(fecha) - Date.now()) / 1000;
    for (const [unidad, seg] of [["day", 86400], ["hour", 3600], ["minute", 60]]) {
      if (Math.abs(s) >= seg) return relativo.format(Math.round(s / seg), unidad);
    }
    return "ahora mismo";
  }

  /* ------------------------------------------------------------------
     Nombres: limpieza y filtro básico de insultos
     ------------------------------------------------------------------ */
  // Raíces que no pueden empezar ninguna palabra del nombre, y palabras prohibidas solo si van enteras.
  const RAICES = ["puta", "puto", "mierda", "gilipoll", "cabron", "polla", "follar", "joder", "maricon", "nazi",
    "hitler", "zorra", "verga", "pendej", "culero", "pinche", "chinga", "idiota", "imbecil", "subnormal",
    "retrasad", "fuck", "shit", "bitch", "nigg", "cunt", "hijoputa", "malparid", "huevon"];
  const ENTERAS = ["cono", "culo", "tonto", "tonta", "sex", "porno"];
  function limpiarNombre(texto) {
    return texto.normalize("NFC").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
  }
  function problemaNombre(nombre) {
    if (nombre.length < 2) return "Escribe un nombre de al menos 2 letras.";
    const palabras = normalizar(nombre).split(" ");
    const junto = palabras.join("");
    const prohibido = RAICES.some((r) => junto.startsWith(r) || palabras.some((w) => w.startsWith(r))) ||
      ENTERAS.some((w) => junto === w || palabras.includes(w));
    if (prohibido) return "Ese nombre no se puede publicar. Prueba con otro.";
    return "";
  }

  /* ------------------------------------------------------------------
     Acceso a Supabase (API REST)
     ------------------------------------------------------------------ */
  const base = () => config.url.replace(/\/+$/, "") + "/rest/v1/resultados";
  function cabeceras(extra = {}) {
    const h = { apikey: config.clave, ...extra };
    // Las claves antiguas (JWT «anon») van también en Authorization; las nuevas «sb_publishable_…» no.
    if (!config.clave.startsWith("sb_")) h.Authorization = "Bearer " + config.clave;
    return h;
  }
  async function pedir(url, opciones = {}) {
    const control = new AbortController();
    const plazo = setTimeout(() => control.abort(), 10000);
    try {
      const r = await fetch(url, { ...opciones, signal: control.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    } finally {
      clearTimeout(plazo);
    }
  }
  function filtros(f) {
    const q = [];
    if (f.preguntas === "otras") q.push("preguntas=not.in.(10,25,50,100)");
    else if (f.preguntas) q.push("preguntas=eq." + Number(f.preguntas));
    if (f.dir) q.push("dir=eq." + f.dir);
    if (f.modo) q.push("modo=eq." + f.modo);
    return q;
  }
  const modalidadExacta = (x) => ({ preguntas: x.preguntas, dir: x.dir, modo: x.modo });

  async function cargarRanking(f, limite = 25) {
    const q = [`select=${CAMPOS}`, "order=puntos.desc,segundos.asc,creado.asc", `limit=${limite}`, ...filtros(f)];
    return (await pedir(`${base()}?${q.join("&")}`, { headers: cabeceras() })).json();
  }
  async function cargarUltimos(limite = 8) {
    return (await pedir(`${base()}?select=${CAMPOS}&order=creado.desc&limit=${limite}`, { headers: cabeceras() })).json();
  }
  async function contar(q) {
    const r = await pedir(`${base()}?select=id&limit=1&${q.join("&")}`, { headers: cabeceras({ Prefer: "count=exact" }) });
    const n = Number((r.headers.get("content-range") || "").split("/")[1]);
    return Number.isFinite(n) ? n : null;
  }
  async function publicar(fila) {
    const r = await pedir(base(), {
      method: "POST",
      headers: cabeceras({ "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify(fila),
    });
    return (await r.json())[0];
  }

  /* ------------------------------------------------------------------
     Publicar al terminar una ronda
     ------------------------------------------------------------------ */
  let pendiente = null; // resultado de la última ronda, listo para publicar
  let ultimoPublicado = null;

  function alTerminar(resumen) {
    const caja = $("#caja-publicar");
    if (!activo || !resumen.publicable) { caja.hidden = true; pendiente = null; return; }
    pendiente = resumen;
    caja.hidden = false;
    $("#publicar-modalidad").textContent = textoModalidad(resumen);
    $("#form-publicar").hidden = false;
    $("#publicado").hidden = true;
    const entrada = $("#nombre-muro");
    entrada.value = leer("capitales.nombre", "");
    entrada.disabled = false;
    $("#btn-publicar").disabled = false;
    $("#publicar-estado").textContent = "Se verá en público: mejor un apodo que tu nombre completo.";
    $("#publicar-estado").classList.remove("error");
  }

  $("#form-publicar").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pendiente) return;
    const estado = $("#publicar-estado");
    const entrada = $("#nombre-muro");
    const nombre = limpiarNombre(entrada.value);
    const problema = problemaNombre(nombre);
    if (problema) {
      estado.textContent = problema;
      estado.classList.add("error");
      entrada.focus();
      return;
    }
    const boton = $("#btn-publicar");
    boton.disabled = true;
    entrada.disabled = true;
    estado.classList.remove("error");
    estado.textContent = "Publicando…";
    const { publicable, ...datos } = pendiente;
    try {
      const fila = await publicar({ ...datos, nombre });
      guardar("capitales.nombre", nombre);
      ultimoPublicado = fila;
      pendiente = null;
      const f = filtros(modalidadExacta(fila));
      const [mejores, total] = await Promise.all([
        contar([...f, "puntos=gt." + fila.puntos]).catch(() => null),
        contar(f).catch(() => null),
      ]);
      $("#form-publicar").hidden = true;
      $("#publicado").hidden = false;
      $("#publicado-texto").textContent = mejores === null
        ? "¡Publicado en el muro!"
        : `¡Publicado! Vas en el puesto ${mejores + 1} de ${total} en esta modalidad.`;
      $("#btn-ver-muro").focus();
    } catch {
      boton.disabled = false;
      entrada.disabled = false;
      estado.textContent = "No se ha podido publicar. Comprueba tu conexión y vuelve a intentarlo.";
      estado.classList.add("error");
    }
  });

  /* ------------------------------------------------------------------
     Pantalla del muro
     ------------------------------------------------------------------ */
  const filtroActual = { preguntas: "10", dir: "", modo: "" };

  function filaRanking(x, puesto) {
    const li = document.createElement("li");
    li.className = "fila-ranking" + (puesto <= 3 ? ` podio p${puesto}` : "") + (ultimoPublicado && x.id === ultimoPublicado.id ? " tuyo" : "");
    const pct = Math.round((x.aciertos / x.preguntas) * 100);
    li.innerHTML = `
      <span class="puesto">${puesto}</span>
      <div class="quien"><strong></strong><span class="modalidad"></span></div>
      <div class="marca-puntos"><strong>${formatoNumero(x.puntos)}</strong><span>${x.aciertos}/${x.preguntas} · ${pct} % · ${formatoTiempo(x.segundos)}</span></div>`;
    li.querySelector(".quien strong").textContent = x.nombre; // texto del jugador: nunca como HTML
    li.querySelector(".modalidad").textContent = `${textoModalidad(x)} · ${hace(x.creado)}`;
    return li;
  }

  async function pintarMuro() {
    const lista = $("#ranking");
    const estado = $("#muro-estado");
    estado.textContent = "Cargando…";
    estado.classList.remove("error");
    try {
      const [ranking, ultimos] = await Promise.all([cargarRanking(filtroActual), cargarUltimos()]);
      lista.textContent = "";
      ranking.forEach((x, i) => lista.appendChild(filaRanking(x, i + 1)));
      estado.textContent = ranking.length ? "" : "Aún no hay resultados con estos filtros. ¡Juega una ronda y sé el primero!";
      const ul = $("#ultimos");
      ul.textContent = "";
      for (const x of ultimos) {
        const li = document.createElement("li");
        li.innerHTML = "<strong></strong> <span class=\"ultimo-puntos\"></span><span class=\"modalidad\"></span>";
        li.querySelector("strong").textContent = x.nombre;
        li.querySelector(".ultimo-puntos").textContent = `${formatoNumero(x.puntos)} puntos · ${x.aciertos}/${x.preguntas}`;
        li.querySelector(".modalidad").textContent = `${TEXTO_DIR[x.dir]} · ${TEXTO_MODO[x.modo]} · ${hace(x.creado)}`;
        ul.appendChild(li);
      }
      $("#caja-ultimos").hidden = !ultimos.length;
    } catch {
      lista.textContent = "";
      estado.textContent = "No se ha podido cargar el muro. Comprueba tu conexión y vuelve a intentarlo.";
      estado.classList.add("error");
    }
  }

  function sincronizarFiltros() {
    $("#filtro-preguntas").value = filtroActual.preguntas;
    $("#filtro-dir").value = filtroActual.dir;
    $("#filtro-modo").value = filtroActual.modo;
  }
  for (const [id, campo] of [["#filtro-preguntas", "preguntas"], ["#filtro-dir", "dir"], ["#filtro-modo", "modo"]]) {
    $(id).addEventListener("change", (e) => { filtroActual[campo] = e.target.value; pintarMuro(); });
  }

  function abrir() {
    if (!activo) return;
    sincronizarFiltros();
    window.JUEGO.mostrarPantalla("muro");
    pintarMuro();
  }
  $("#btn-ver-muro").addEventListener("click", () => {
    if (ultimoPublicado) {
      const n = ultimoPublicado.preguntas;
      filtroActual.preguntas = [10, 25, 50, 100].includes(n) ? String(n) : "otras";
      filtroActual.dir = ultimoPublicado.dir;
      filtroActual.modo = ultimoPublicado.modo;
    }
    abrir();
  });

  $("#nav-muro").hidden = !activo;
  window.Muro = { activo, abrir, alTerminar, textoModalidad };
})();
