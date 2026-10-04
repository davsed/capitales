# Capitales

Juego de capitales del mundo en español. Se pregunta un país al azar y escribes su capital (o al revés), el juego te dice si has acertado y pasa a la siguiente.

**Para jugar:** abre `index.html` en el navegador. No hace falta instalar nada ni servidor.

## Qué incluye

- **197 países**: los 193 miembros de la ONU, los dos Estados observadores (Vaticano y Palestina), Kosovo y, como opción, Taiwán.
- **Tres sentidos de pregunta**: país → capital, capital → país o mezcla. En la mezcla, una etiqueta te indica si lo que ves es un país o una capital.
- **Dos formas de responder**: escribiendo o eligiendo entre 4 opciones. Las opciones incorrectas salen del mismo continente, para que no sea tan fácil.
- **Continentes**: África, América del Norte y Central, Caribe, América del Sur, Asia, Europa y Oceanía, combinables entre sí.
- **Preguntas por ronda**: 10, 25, 50, 100 o todas, sin repetir ninguna.
- **Maratón**: partida larga en la que cada país sale hasta que lo aciertas tres veces seguidas; si fallas, ese país vuelve a cero. En cada pregunta, un símbolo muestra cómo vas con ese país: círculo vacío, una diagonal, una X y, con el tercer acierto, un asterisco que estalla, y el país ya no vuelve a salir. La maratón va por vueltas: en cada vuelta salen, en un orden aleatorio nuevo, todos los países que te quedan por dominar. Un país acertado espera a la vuelta siguiente; uno fallado vuelve dentro de la misma vuelta, entre 3 y 8 preguntas después. Entre dos apariciones del mismo país siempre salen al menos otros tres (salvo cuando quedan menos), para que los tres aciertos no sean de memoria inmediata. Con todo el mundo son al menos 588 preguntas, así que se guarda sola y se puede seguir otro día. No tiene modo mezcla.
- **Contador** de pregunta, aciertos, fallos, racha, puntos y tiempo. Guarda tu récord para cada combinación de opciones.
- **Más opciones**: tiempo límite por pregunta, perdonar erratas leves («Budapes» vale por «Budapest»), pasar solo a la siguiente e incluir Taiwán.
- **Corrección útil**: no importan tildes, mayúsculas ni artículos («Cairo» o «El Cairo»), y se aceptan nombres alternativos («Pekín» o «Beijing»). Si escribes la capital de otro país (o eliges otra opción), te dice de qué país es, a cuántos kilómetros está del correcto (de capital a capital) y si son vecinos. Por ejemplo: «Has escrito Berlín: es la capital de Alemania. Entre Alemania y Francia hay unos 880 km, y son países vecinos». En el mapa se ven los dos países unidos por la ruta de vuelo. Un fallo se muestra el doble de tiempo que un acierto (5,2 s frente a 2,6 s).
- **Al responder** ves la bandera, un mapa que hace zoom al país y marca la capital, y una foto de la ciudad sacada de Wikimedia Commons (necesita conexión; si no hay, se muestra la bandera).
- **Animaciones**: el nombre aparece letra a letra como en un panel de aeropuerto, con sellos de pasaporte al acertar o fallar, confeti con las rachas, un avión que avanza por la ronda y sonidos, que se pueden silenciar.
- **Al final** tienes el resumen, un «pasaporte» con las banderas de la ronda, la lista de fallos y un botón para repetir solo los fallos.
- **Tabla ⇄**: la tabla clave-valor bidireccional completa. Busca un país y te da su capital; busca una capital y te da su país.
- **Muro público**: al terminar una ronda puedes publicar tu resultado con un apodo. El muro muestra un ranking de los mejores, con la modalidad de cada partida (qué se pregunta, cómo se responde, número de preguntas, continentes y tiempo), y se puede filtrar por modalidad.

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

## Tu progreso

Todo se guarda solo en el navegador (`localStorage`), así que sobrevive a cerrar la pestaña o apagar el ordenador: la maratón en curso, el historial de rondas, los récords y las opciones. En «Tus datos», en la portada:

- **Descargar mi progreso** baja un archivo `capitales-progreso-AAAA-MM-DD.json` con todo lo anterior.
- **Cargar mi progreso** lo recupera, por ejemplo en otro ordenador o navegador, o si se han borrado los datos de navegación. Antes de sustituir lo que haya guardado pide confirmación.

En la web la copia se descarga directamente; dentro de claude.ai el navegador pide confirmación antes de guardarla.

## Muro de resultados

Los resultados se guardan en [Supabase](https://supabase.com) (plan gratuito), porque GitHub Pages no puede guardar datos. Para activarlo:

1. Crea un proyecto en Supabase.
2. En **SQL Editor** ejecuta [`data/muro.sql`](data/muro.sql). Crea la tabla y deja que cualquiera lea el muro y añada resultados, pero no que modifique ni borre los existentes.
3. Copia la *Project URL* y la clave *anon* o *publishable* en [`js/muro-config.js`](js/muro-config.js). Esa clave es pública por diseño.

Mientras `js/muro-config.js` esté vacío, el muro no aparece en el juego. Solo se publican rondas completas (no los repasos ni las rondas terminadas antes de tiempo). Los nombres tienen como máximo 20 caracteres y pasan un filtro básico de insultos. Para borrar una entrada, usa el *Table Editor* de Supabase.

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html`, `css/estilos.css` | Interfaz |
| `lista.html`, `sitemap.xml` | Generados: lista estática de países y capitales, y mapa del sitio para buscadores |
| `img/` | Icono e imagen para compartir en redes |
| `js/tabla.js` | Tabla bidireccional país ⇄ capital y corrección de respuestas |
| `js/juego.js` | Lógica del juego, animaciones, mapa y fotos |
| `js/progreso.js` | Maratón (qué país toca y cuándo se domina), historial y copia de seguridad en JSON |
| `js/muro.js`, `js/muro-config.js`, `data/muro.sql` | Muro público de resultados (Supabase) |
| `js/datos.js`, `js/mapa.js` | Generados: países y mapamundi |
| `data/` | Tabla curada, dataset en JSON e informe de fuentes |
| `scripts/` | Scripts que construyen los datos |
| `flags/` | Banderas SVG ([flag-icons](https://github.com/lipis/flag-icons), MIT) |

El mapa es de [Natural Earth](https://www.naturalearthdata.com/) (dominio público, vía `world-atlas`). Las fotos son de Wikimedia Commons y se cargan en el navegador con la API de Wikipedia.
