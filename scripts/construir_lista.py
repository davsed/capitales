#!/usr/bin/env python3
"""Genera lista.html (lista estática de países y capitales, legible por buscadores) y sitemap.xml.

Uso:  python3 scripts/construir_lista.py   (después de construir_datos.py)
"""
import datetime
import html
import json
import os
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "https://davsed.github.io/capitales/"
CONTINENTES = {
    "AF": "África", "NC": "América del Norte y Central", "CB": "Caribe", "SA": "América del Sur",
    "AS": "Asia", "EU": "Europa", "OC": "Oceanía",
}
ANCLAS = {"AF": "africa", "NC": "america-norte-central", "CB": "caribe", "SA": "america-sur",
          "AS": "asia", "EU": "europa", "OC": "oceania"}

e = html.escape


def orden(texto):
    """Clave de orden alfabético español: sin tildes (Bélgica va antes que Bulgaria)."""
    return unicodedata.normalize("NFD", texto).encode("ascii", "ignore").decode().lower()


def main():
    # Taiwán (reconocimiento limitado) no entra en la lista, igual que en el juego por defecto.
    paises = [p for p in json.load(open(os.path.join(RAIZ, "data", "paises.json"), encoding="utf-8")) if not p["limitado"]]
    total = len(paises)
    desc = (f"Lista completa y actualizada de los {total} países del mundo y sus capitales, por continentes. "
            "Contrastada en cinco fuentes y con los cambios de 2026.")

    indice = "\n".join(
        f'        <li><a class="chip" href="#{ANCLAS[c]}">{n} <small>{sum(1 for p in paises if p["cont"] == c)}</small></a></li>'
        for c, n in CONTINENTES.items())

    secciones = []
    for c, nombre in CONTINENTES.items():
        filas = []
        for p in sorted((p for p in paises if p["cont"] == c), key=lambda p: orden(p["pais"])):
            nota = f'<span class="c-nota">{e(p["nota"])}</span>' if p["nota"] else ""
            filas.append(
                f'          <tr><td><img src="flags/{p["id"].lower()}.svg" alt="Bandera de {e(p["pais"])}" '
                f'width="36" height="27" loading="lazy"></td><td>{e(p["pais"])}</td>'
                f'<td class="c-capital">{e(p["capital"])}{nota}</td></tr>')
        secciones.append(f'''    <section class="lista-seccion" id="{ANCLAS[c]}">
      <h2>{nombre}</h2>
      <div class="tabla-envoltura">
        <table class="tabla">
          <thead><tr><th scope="col" class="col-bandera"><span class="solo-lector">Bandera</span></th><th scope="col">País</th><th scope="col">Capital</th></tr></thead>
          <tbody>
{chr(10).join(filas)}
          </tbody>
        </table>
      </div>
    </section>''')

    pagina = f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Lista de países y capitales del mundo (2026)</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{URL}lista.html">
<link rel="icon" href="img/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#13213a">
<meta property="og:type" content="article">
<meta property="og:locale" content="es_ES">
<meta property="og:title" content="Lista de países y capitales del mundo">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{URL}lista.html">
<meta property="og:image" content="{URL}img/portada.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&display=swap">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="css/estilos.css">
</head>
<body>
<!-- Generado por scripts/construir_lista.py a partir de data/paises.json. No editar a mano. -->
<header class="barra">
  <a class="marca" href="./">
    <svg viewBox="0 0 32 32" aria-hidden="true" class="marca-globo">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2.4"/>
      <ellipse cx="16" cy="16" rx="5.5" ry="13" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M3.5 12h25M3.5 20h25" stroke="currentColor" stroke-width="2" fill="none"/>
    </svg>
    <span>Capitales</span>
  </a>
  <nav class="nav" aria-label="Secciones">
    <a class="nav-btn" href="./">Jugar</a>
    <a class="nav-btn" href="lista.html" aria-current="page">Lista</a>
  </nav>
</header>
<main class="contenedor">
  <div class="lista-intro">
    <p class="antetitulo">{total} países · actualizada en {datetime.date.today().year}</p>
    <h1 class="titular pequeno">Países y capitales del mundo</h1>
    <p>Los 193 países miembros de la ONU, el Vaticano, Palestina y Kosovo, con su capital. Cada capital se ha contrastado en cinco fuentes y, donde hay disputa, se sigue el consenso occidental. Si un país tiene varias capitales, se explica en la nota.</p>
    <p><a href="./">Pon a prueba lo que sabes con el juego de capitales</a>.</p>
    <ul class="lista-indice">
{indice}
    </ul>
  </div>
{chr(10).join(secciones)}
  <p class="ayuda pie-tabla">Taiwán (capital: Taipéi) no figura en la lista porque la mayoría de países occidentales no lo reconoce formalmente; en el juego puede activarse como opción. Fuentes: mledoze/countries, CIA World Factbook, GeoNames, annexare/Countries y REST Countries. Banderas: flag-icons (MIT).</p>
</main>
<footer class="pie">
  <a href="./">Jugar a las capitales</a>
  <span aria-hidden="true">·</span>
  <a href="https://github.com/davsed/capitales">Código en GitHub</a>
</footer>
</body>
</html>
'''
    with open(os.path.join(RAIZ, "lista.html"), "w", encoding="utf-8") as f:
        f.write(pagina)

    hoy = datetime.date.today().isoformat()
    with open(os.path.join(RAIZ, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n'
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                f"  <url><loc>{URL}</loc><lastmod>{hoy}</lastmod></url>\n"
                f"  <url><loc>{URL}lista.html</loc><lastmod>{hoy}</lastmod></url>\n"
                "</urlset>\n")
    print(f"lista.html ({total} países) y sitemap.xml generados")


if __name__ == "__main__":
    main()
