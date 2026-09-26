#!/usr/bin/env python3
"""Construye el dataset país ⇄ capital del juego contrastando varias fuentes.

Fuentes (se descargan en scripts/.cache la primera vez):
  1. mledoze/countries        https://github.com/mledoze/countries
  2. CIA World Factbook (JSON) https://github.com/factbook/factbook.json
  3. GeoNames (geonamescache)  https://pypi.org/project/geonamescache/
  4. annexare/Countries        https://github.com/annexare/Countries
  5. REST Countries v2         https://github.com/apilayer/restcountries
  + Unicode CLDR (es) para validar los exónimos en español.

La tabla curada en español vive en data/paises_es.tsv. Este script:
  * comprueba, país por país, que la capital curada coincide con lo que dicen
    las fuentes y deja constancia de cada discrepancia en data/informe-fuentes.md;
  * valida la grafía española contra CLDR y los nombres alternativos de GeoNames;
  * añade coordenadas de la capital y código numérico ISO (para el mapa);
  * genera data/paises.json y js/datos.js (lo que carga el juego).

Uso:  python3 scripts/construir_datos.py
"""
import csv
import glob
import html
import io
import json
import os
import re
import subprocess
import sys
import unicodedata
import urllib.request
import zipfile
from collections import Counter

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(RAIZ, "scripts", ".cache")

URLS = {
    "mledoze.json": "https://raw.githubusercontent.com/mledoze/countries/master/countries.json",
    "annexare.ts": "https://raw.githubusercontent.com/annexare/Countries/main/packages/countries/src/data/countries.ts",
    "restcountries_v2.json": "https://raw.githubusercontent.com/apilayer/restcountries/master/src/main/resources/countriesV2.json",
    "cldr_es_tz.json": "https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-dates-full/main/es/timeZoneNames.json",
}

CONTINENTES = {
    "AF": "África",
    "NC": "América del Norte y Central",
    "CB": "Caribe",
    "SA": "América del Sur",
    "AS": "Asia",
    "EU": "Europa",
    "OC": "Oceanía",
}

# Coordenadas fijadas a mano cuando las fuentes apuntan a otra ciudad
# (p. ej. el Factbook da Rangún para Birmania o Malabo para Guinea Ecuatorial).
COORDS_MANUALES = {
    "GQ": (1.5925, 10.8236),    # Ciudad de la Paz (GeoNames)
    "MM": (19.7450, 96.1297),   # Naipyidó
    "BO": (-19.0333, -65.2627), # Sucre
    "PS": (31.8996, 35.2042),   # Ramala (GeoNames)
    "NR": (-0.5508, 166.9252),  # Yaren (GeoNames)
    "PW": (7.5008, 134.6238),   # Ngerulmud (GeoNames)
    "BI": (-3.4271, 29.9246),   # Gitega (GeoNames)
    "KI": (1.3290, 172.9790),   # Tarawa Sur
    "LK": (6.9271, 79.8612),    # Colombo
}


# Cómo se ha resuelto cada discrepancia entre fuentes (aparece en el informe).
RESOLUCION = {
    "GQ": "Cambio reciente: el Decreto-Ley 1/2026 trasladó la capital a Ciudad de la Paz el 2-1-2026 "
          "(Africanews, 5-1-2026; ArchDaily). Solo GeoNames está actualizado; el resto aún dice Malabo.",
    "KZ": "GeoNames y REST Countries v2 conservan «Nur-Sultan», nombre que la ciudad tuvo entre 2019 y 2022.",
    "LK": "Dos capitales oficiales. Se elige Colombo (mayoría de fuentes) y se acepta Sri Jayawardenapura Kotte.",
    "MD": "Misma ciudad; el Factbook añade el nombre ruso.",
    "MM": "El Factbook recoge que el Gobierno de EE. UU. sigue citando Rangún; el resto de fuentes (y la mayoría de "
          "gobiernos occidentales) da Naipyidó.",
    "NR": "Sin capital oficial; todas las fuentes que dan un nombre coinciden en Yaren.",
    "PS": "Disputa: Palestina proclama Jerusalén Este; la sede administrativa es Ramala (mayoría de fuentes). "
          "Se aceptan ambas. El Factbook no trata Palestina como país.",
    "PW": "GeoNames da Melekeok, el estado donde está Ngerulmud.",
}


def descargar():
    os.makedirs(CACHE, exist_ok=True)
    for nombre, url in URLS.items():
        ruta = os.path.join(CACHE, nombre)
        if not os.path.exists(ruta):
            print("descargando", url)
            urllib.request.urlretrieve(url, ruta)
    fb = os.path.join(CACHE, "factbook")
    if not os.path.isdir(fb):
        subprocess.check_call(["git", "clone", "--depth", "1", "-q",
                               "https://github.com/factbook/factbook.json", fb])
    gn = os.path.join(CACHE, "geonamescache")
    if not os.path.isdir(gn):
        subprocess.check_call([sys.executable, "-m", "pip", "download", "geonamescache",
                               "--no-deps", "-q", "-d", CACHE])
        rueda = glob.glob(os.path.join(CACHE, "geonamescache-*.whl"))[0]
        zipfile.ZipFile(rueda).extractall(CACHE)


def norm(s):
    """Normaliza para comparar: sin tildes, minúsculas, solo letras."""
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]", "", s)


def partes(valor):
    """'La Paz (administrative capital); Sucre (constitutional ...)' -> ['La Paz', 'Sucre']"""
    if not valor:
        return []
    valor = re.sub(r"\([^)]*\)", "", valor)
    valor = re.sub(r" in (Romanian|Russian)", "", valor)
    valor = valor.split("; note")[0].split("note -")[0]
    trozos = re.split(r"[;,]| and ", valor)
    return [t.strip() for t in trozos if t.strip() and t.strip() not in ("D.C.", "D.C")]


def dms(texto):
    m = re.match(r"(\d+) (\d+) ([NS]), (\d+) (\d+) ([EW])", texto or "")
    if not m:
        return None
    lat = int(m[1]) + int(m[2]) / 60
    lon = int(m[4]) + int(m[5]) / 60
    return (round(-lat if m[3] == "S" else lat, 4), round(-lon if m[6] == "W" else lon, 4))


def cargar_fuentes():
    ml = json.load(open(os.path.join(CACHE, "mledoze.json")))
    gn_paises = json.load(open(os.path.join(CACHE, "geonamescache", "data", "countries.json")))
    gn_ciudades = json.load(open(os.path.join(CACHE, "geonamescache", "data", "cities500.json")))
    rc = json.load(open(os.path.join(CACHE, "restcountries_v2.json")))
    ts = open(os.path.join(CACHE, "annexare.ts")).read()

    ann = {}
    for m in re.finditer(r"\n  (\w\w): \{(.*?)\n  \}", ts, re.S):
        cap = re.search(r"capital: '((?:[^'\\]|\\.)*)'", m.group(2))
        ann[m.group(1)] = cap.group(1).replace("\\'", "'") if cap else ""

    fips_iso = {v["fips"]: v["iso"] for v in gn_paises.values() if v.get("fips")}
    fips_iso["KV"] = "XK"
    fb, fb_coords = {}, {}
    for f in glob.glob(os.path.join(CACHE, "factbook", "*", "*.json")):
        codigo = os.path.basename(f)[:-5].upper()
        iso = fips_iso.get(codigo)
        if not iso:
            continue
        cap = json.load(open(f)).get("Government", {}).get("Capital", {})
        if not isinstance(cap, dict):
            continue
        nombre = cap.get("name", {}).get("text", "") if isinstance(cap.get("name"), dict) else ""
        fb[iso] = html.unescape(re.sub("<[^>]+>", "", nombre))
        coords = cap.get("geographic coordinates", {})
        if isinstance(coords, dict):
            fb_coords[iso] = dms(coords.get("text"))

    fuentes = {
        "mledoze/countries": {c["cca2"]: ", ".join(c.get("capital", [])) for c in ml},
        "CIA World Factbook": fb,
        "GeoNames": {v["iso"]: v["capital"] for v in gn_paises.values()},
        "annexare/Countries": ann,
        "REST Countries v2": {c["alpha2Code"]: c.get("capital", "") for c in rc},
    }
    return ml, gn_ciudades, fuentes, fb_coords


def cargar_curado():
    filas = [l for l in open(os.path.join(RAIZ, "data", "paises_es.tsv"), encoding="utf-8")
             if l.strip() and not l.startswith("#")]
    lector = csv.DictReader(io.StringIO("".join(filas)), delimiter="\t")
    lista = lambda s: [x.strip() for x in (s or "").split(";") if x.strip()]
    datos = []
    for f in lector:
        datos.append({
            "id": f["iso2"],
            "pais": f["pais"],
            "capital": f["capital"],
            "paisAlt": lista(f["pais_alt"]),
            "capitalAlt": lista(f["capital_alt"]),
            "cont": f["cont"],
            "wiki": f["wiki"],
            "nota": (f.get("nota") or "").strip(),
        })
    return datos


def main():
    descargar()
    ml, gn_ciudades, fuentes, fb_coords = cargar_fuentes()
    ml_por_iso = {c["cca2"]: c for c in ml}
    curado = cargar_curado()

    # Nombres españoles conocidos por CLDR (ciudades ejemplo de zonas horarias).
    tz = json.load(open(os.path.join(CACHE, "cldr_es_tz.json")))
    cldr_es = set()

    def recorrer(nodo):
        for v in nodo.values():
            if isinstance(v, dict):
                if "exemplarCity" in v:
                    cldr_es.add(norm(v["exemplarCity"]))
                else:
                    recorrer(v)
    recorrer(tz["main"]["es"]["dates"]["timeZoneNames"]["zone"])
    alternos_gn = {}
    for c in gn_ciudades.values():
        for n in [c["name"]] + c.get("alternatenames", []):
            alternos_gn.setdefault(c["countrycode"], set()).add(norm(n))

    ids = [d["id"] for d in curado]
    dup = [k for k, n in Counter(ids).items() if n > 1]
    assert not dup, f"ISO repetidos: {dup}"
    for campo in ("pais", "capital"):
        vistos = Counter(norm(d[campo]) for d in curado)
        rep = [k for k, n in vistos.items() if n > 1]
        assert not rep, f"{campo} repetido (la tabla debe ser bidireccional): {rep}"

    informe = []
    sin_validar = []
    for d in curado:
        i = d["id"]
        m = ml_por_iso[i]
        aceptadas = {norm(x) for x in [d["capital"]] + d["capitalAlt"] + [d["wiki"]]}
        aceptadas |= {norm(re.sub(r",.*", "", d["wiki"]))}
        votos, detalle = 0, {}
        for nombre_f, datos_f in fuentes.items():
            valor = datos_f.get(i, "")
            detalle[nombre_f] = valor
            if any(norm(p) in aceptadas for p in partes(valor)):
                votos += 1
        con_datos = sum(1 for v in detalle.values() if v)
        d["fuentes"] = f"{votos}/{con_datos}"
        if votos < con_datos:
            informe.append((d, detalle))

        # Validación de grafía española
        cap_n = norm(d["capital"])
        if cap_n not in cldr_es and cap_n not in alternos_gn.get(i, set()):
            sin_validar.append(f"{d['capital']} ({d['pais']})")

        # Coordenadas y datos del mapa
        coords = COORDS_MANUALES.get(i) or fb_coords.get(i)
        if not coords:
            coords = tuple(m["latlng"])
        d["lat"], d["lon"] = coords
        d["ccn3"] = m.get("ccn3", "")
        d["pob"] = None
        d["limitado"] = i == "TW"
        # Alternativas en inglés que aportan las fuentes (se aceptan como respuesta)
        ingles_pais = m["name"]["common"]
        if norm(ingles_pais) not in {norm(x) for x in [d["pais"]] + d["paisAlt"]}:
            d["paisAlt"].append(ingles_pais)

    # Población de la capital (GeoNames) para el dato curioso
    for d in curado:
        candidatos = {norm(x) for x in [d["capital"]] + d["capitalAlt"] + [re.sub(r",.*", "", d["wiki"])]}
        mejor = None
        for c in gn_ciudades.values():
            if c["countrycode"] != d["id"]:
                continue
            if norm(c["name"]) in candidatos and (mejor is None or c["population"] > mejor["population"]):
                mejor = c
        if mejor and mejor["population"]:
            d["pob"] = mejor["population"]

    salida = []
    for d in sorted(curado, key=lambda x: norm(x["pais"])):
        salida.append({k: d[k] for k in ("id", "pais", "capital", "paisAlt", "capitalAlt", "cont",
                                          "nota", "wiki", "lat", "lon", "ccn3", "pob", "limitado", "fuentes")})

    with open(os.path.join(RAIZ, "data", "paises.json"), "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=1)
    with open(os.path.join(RAIZ, "js", "datos.js"), "w", encoding="utf-8") as f:
        f.write("// Generado por scripts/construir_datos.py a partir de data/paises_es.tsv. No editar a mano.\n")
        f.write("window.CONTINENTES = " + json.dumps(CONTINENTES, ensure_ascii=False) + ";\n")
        f.write("window.PAISES = " + json.dumps(salida, ensure_ascii=False, separators=(",", ":")) + ";\n")

    # Informe de fuentes
    L = ["# Informe de fuentes", "",
         "Generado por `scripts/construir_datos.py`. Cada capital de `data/paises_es.tsv` se contrasta con cinco fuentes:",
         ""]
    for n in fuentes:
        L.append(f"- {n}")
    L += ["", f"Total de países: **{len(salida)}** "
          f"({sum(1 for d in salida if not d['limitado'])} en el juego por defecto + Taiwán como opción).", "",
          "## Discrepancias y cómo se han resuelto", "",
          "Criterio: se sigue la mayoría de las fuentes y, si hay disputa política, el consenso occidental. "
          "Cuando un país tiene varias capitales oficiales se aceptan todas como respuesta.", "",
          "| País | Capital elegida | Fuentes de acuerdo | Lo que dice cada fuente | Resolución |",
          "|---|---|---|---|---|"]
    for d, detalle in sorted(informe, key=lambda x: norm(x[0]["pais"])):
        det = "<br>".join(f"**{k}**: {v or '—'}" for k, v in detalle.items())
        L.append(f"| {d['pais']} | {d['capital']} | {d['fuentes']} | {det} | {RESOLUCION.get(d['id'], d['nota'])} |")
    L += ["", "## Casos especiales (varias capitales o disputas)", "",
          "Aunque las fuentes coincidan, estos países tienen matices que el juego explica al responder:", ""]
    for d in salida:
        if d["nota"]:
            L.append(f"- **{d['pais']}** — {d['capital']}: {d['nota']}")
    L += ["", "## Tabla completa", "", "| País | Capital | Continente | Fuentes |", "|---|---|---|---|"]
    for d in salida:
        L.append(f"| {d['pais']} | {d['capital']} | {CONTINENTES[d['cont']]} | {d['fuentes']} |")
    with open(os.path.join(RAIZ, "data", "informe-fuentes.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")

    print(f"{len(salida)} países escritos. Discrepancias: {len(informe)}")
    for d, detalle in informe:
        print(f"  {d['id']} {d['pais']:<28} {d['capital']:<22} {d['fuentes']}  {json.dumps(detalle, ensure_ascii=False)}")
    print("Grafías españolas no encontradas en CLDR/GeoNames (revisadas a mano):")
    print("  " + ", ".join(sin_validar))


if __name__ == "__main__":
    main()
