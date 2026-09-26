# Capitales

Juego de capitales del mundo en español. Se pregunta un país al azar y escribes su capital (o al revés), el juego te dice si has acertado y pasa a la siguiente.

**Para jugar:** abre `index.html` en el navegador. No hace falta instalar nada ni servidor.

## Qué incluye

- **197 países**: los 193 miembros de la ONU, los dos Estados observadores (Vaticano y Palestina), Kosovo y, como opción, Taiwán.
- **Tres sentidos de pregunta**: país → capital, capital → país o mezcla. En la mezcla, una etiqueta te indica si lo que ves es un país o una capital.
- **Dos formas de responder**: escribiendo o eligiendo entre 4 opciones. Las opciones incorrectas salen del mismo continente, para que no sea tan fácil.
- **Continentes**: África, América del Norte y Central, Caribe, América del Sur, Asia, Europa y Oceanía, combinables entre sí.
- **Preguntas por ronda**: 10, 25, 50, 100 o todas, sin repetir ninguna.
- **Contador** de pregunta, aciertos, fallos, racha, puntos y tiempo. Guarda tu récord para cada combinación de opciones.
- **Más opciones**: tiempo límite por pregunta, perdonar erratas leves («Budapes» vale por «Budapest»), pasar solo a la siguiente e incluir Taiwán.
- **Corrección útil**: no importan tildes, mayúsculas ni artículos («Cairo» o «El Cairo»), y se aceptan nombres alternativos («Pekín» o «Beijing»). Si escribes otra capital te dice de qué país es. Por ejemplo: «Has escrito Berlín: es la capital de Alemania».
- **Al responder** ves la bandera, un mapa que hace zoom al país y marca la capital, y una foto de la ciudad sacada de Wikimedia Commons (necesita conexión; si no hay, se muestra la bandera).
- **Animaciones**: el nombre aparece letra a letra como en un panel de aeropuerto, con sellos de pasaporte al acertar o fallar, confeti con las rachas, un avión que avanza por la ronda y sonidos, que se pueden silenciar.
- **Al final** tienes el resumen, un «pasaporte» con las banderas de la ronda, la lista de fallos y un botón para repetir solo los fallos.
- **Tabla ⇄**: la tabla clave-valor bidireccional completa. Busca un país y te da su capital; busca una capital y te da su país.

## Datos

La tabla curada está en [`data/paises_es.tsv`](data/paises_es.tsv). Cada capital se ha contrastado con cinco fuentes:

1. [mledoze/countries](https://github.com/mledoze/countries)
2. [CIA World Factbook](https://github.com/factbook/factbook.json) (JSON)
3. [GeoNames](https://www.geonames.org/) (paquete `geonamescache`)
4. [annexare/Countries](https://github.com/annexare/Countries)
5. [REST Countries](https://github.com/apilayer/restcountries)

Los cambios recientes se han comprobado en prensa. En 191 países coinciden todas las fuentes que tienen el dato. Las 6 discrepancias, y cómo se han resuelto, están en [`data/informe-fuentes.md`](data/informe-fuentes.md). Estos son los casos más delicados:

- **Guinea Ecuatorial**: la capital es **Ciudad de la Paz** desde el 2 de enero de 2026 (Decreto-Ley 1/2026). Cuatro de las cinco fuentes aún dicen Malabo.
- **Kazajistán**: Astaná. «Nur-Sultán» fue su nombre solo entre 2019 y 2022.
- **Birmania**: Naipyidó. El Gobierno de EE. UU. sigue citando Rangún, pero el resto de fuentes da Naipyidó.
- **Palestina**: Ramala, y también se acepta Jerusalén Este.

Cuando había disputa se ha seguido el consenso occidental: Kosovo se incluye, Taiwán solo como opción e Israel con Jerusalén (con una nota). Si un país tiene varias capitales oficiales se aceptan todas: Bolivia (Sucre y La Paz), Sudáfrica (Pretoria, Ciudad del Cabo y Bloemfontein), Sri Lanka, Esuatini… Los nombres siguen la Ortografía de la RAE y las recomendaciones de la FundéuRAE, y se han validado con Unicode CLDR y GeoNames.

### Regenerar los datos

```sh
npm install            # d3-geo, topojson-client, world-atlas y flag-icons (solo para construir)
npm run datos          # descarga las fuentes, contrasta, y genera js/datos.js, js/mapa.js, lista.html y flags/
npm test               # pruebas de los datos y de la corrección de respuestas
```

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html`, `css/estilos.css` | Interfaz |
| `lista.html`, `sitemap.xml` | Generados: lista estática de países y capitales, y mapa del sitio para buscadores |
| `img/` | Icono e imagen para compartir en redes |
| `js/tabla.js` | Tabla bidireccional país ⇄ capital y corrección de respuestas |
| `js/juego.js` | Lógica del juego, animaciones, mapa y fotos |
| `js/datos.js`, `js/mapa.js` | Generados: países y mapamundi |
| `data/` | Tabla curada, dataset en JSON e informe de fuentes |
| `scripts/` | Scripts que construyen los datos |
| `flags/` | Banderas SVG ([flag-icons](https://github.com/lipis/flag-icons), MIT) |

El mapa es de [Natural Earth](https://www.naturalearthdata.com/) (dominio público, vía `world-atlas`). Las fotos son de Wikimedia Commons y se cargan en el navegador con la API de Wikipedia.
