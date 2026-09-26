# Informe de fuentes

Generado por `scripts/construir_datos.py`. Cada capital de `data/paises_es.tsv` se contrasta con cinco fuentes:

- mledoze/countries
- CIA World Factbook
- GeoNames
- annexare/Countries
- REST Countries v2

Total de países: **197** (196 en el juego por defecto + Taiwán como opción).

## Discrepancias y cómo se han resuelto

Criterio: se sigue la mayoría de las fuentes y, si hay disputa política, el consenso occidental. Cuando un país tiene varias capitales oficiales se aceptan todas como respuesta.

| País | Capital elegida | Fuentes de acuerdo | Lo que dice cada fuente | Resolución |
|---|---|---|---|---|
| Birmania | Naipyidó | 4/5 | **mledoze/countries**: Naypyidaw<br>**CIA World Factbook**: Rangoon (aka Yangon, continues to be recognized as the primary Burmese capital by the US Government); Nay Pyi Taw is the administrative capital<br>**GeoNames**: Nay Pyi Taw<br>**annexare/Countries**: Naypyidaw<br>**REST Countries v2**: Naypyidaw | El Factbook recoge que el Gobierno de EE. UU. sigue citando Rangún; el resto de fuentes (y la mayoría de gobiernos occidentales) da Naipyidó. |
| Guinea Ecuatorial | Ciudad de la Paz | 1/5 | **mledoze/countries**: Malabo<br>**CIA World Factbook**: Malabo; note - Malabo is on the island of Bioko; some months of the year, the government operates out of Bata on the mainland region.<br>**GeoNames**: Ciudad de la Paz<br>**annexare/Countries**: Malabo<br>**REST Countries v2**: Malabo | Cambio reciente: el Decreto-Ley 1/2026 trasladó la capital a Ciudad de la Paz el 2-1-2026 (Africanews, 5-1-2026; ArchDaily). Solo GeoNames está actualizado; el resto aún dice Malabo. |
| Kazajistán | Astaná | 3/5 | **mledoze/countries**: Astana<br>**CIA World Factbook**: Astana<br>**GeoNames**: Nur-Sultan<br>**annexare/Countries**: Astana<br>**REST Countries v2**: Nur-Sultan | GeoNames y REST Countries v2 conservan «Nur-Sultan», nombre que la ciudad tuvo entre 2019 y 2022. |
| Nauru | Yaren | 4/5 | **mledoze/countries**: Yaren<br>**CIA World Factbook**: no official capital; government offices in the Yaren District<br>**GeoNames**: Yaren<br>**annexare/Countries**: Yaren<br>**REST Countries v2**: Yaren | Sin capital oficial; todas las fuentes que dan un nombre coinciden en Yaren. |
| Palaos | Ngerulmud | 4/5 | **mledoze/countries**: Ngerulmud<br>**CIA World Factbook**: Ngerulmud<br>**GeoNames**: Melekeok<br>**annexare/Countries**: Ngerulmud<br>**REST Countries v2**: Ngerulmud | GeoNames da Melekeok, el estado donde está Ngerulmud. |
| Sri Lanka | Colombo | 4/5 | **mledoze/countries**: Colombo<br>**CIA World Factbook**: Colombo (commercial capital); Sri Jayewardenepura Kotte (legislative capital)<br>**GeoNames**: Colombo<br>**annexare/Countries**: Colombo<br>**REST Countries v2**: Sri Jayawardenepura Kotte | Dos capitales oficiales. Se elige Colombo (mayoría de fuentes) y se acepta Sri Jayawardenapura Kotte. |

## Casos especiales (varias capitales o disputas)

Aunque las fuentes coincidan, estos países tienen matices que el juego explica al responder:

- **Benín** — Porto Novo: Porto Novo es la capital oficial; la sede del Gobierno está en Cotonú.
- **Birmania** — Naipyidó: El Gobierno de EE. UU. sigue citando Rangún como capital; el resto de fuentes da Naipyidó.
- **Bolivia** — Sucre: Sucre es la capital constitucional; La Paz es la sede del Gobierno (también se acepta).
- **Burundi** — Gitega: Gitega es la capital política desde 2019; Buyumbura sigue siendo la capital económica.
- **Costa de Marfil** — Yamusukro: Yamusukro es la capital oficial; Abiyán es la capital económica.
- **Egipto** — El Cairo: El Gobierno se ha ido trasladando a la Nueva Capital (renombrada en 2025), pero El Cairo sigue siendo la capital oficial.
- **Esuatini** — Mbabane: Mbabane es la capital administrativa; Lobamba, la real y legislativa (también se acepta).
- **Guinea Ecuatorial** — Ciudad de la Paz: Capital desde el 2 de enero de 2026 (Decreto-Ley 1/2026); antes lo era Malabo.
- **Indonesia** — Yakarta: Nusantara está en construcción, pero Yakarta sigue siendo la capital hasta que un decreto presidencial formalice el traslado.
- **Israel** — Jerusalén: Capital proclamada por Israel y la que recogen las fuentes; su reconocimiento internacional es limitado y muchas embajadas están en Tel Aviv.
- **Kazajistán** — Astaná: Entre 2019 y 2022 se llamó Nur-Sultán.
- **Kosovo** — Pristina: Reconocido por la mayoría de países occidentales (EE. UU., Reino Unido, Francia, Alemania…), aunque no por España ni por la ONU.
- **Malasia** — Kuala Lumpur: Putrajaya es el centro administrativo, pero la capital es Kuala Lumpur.
- **Nauru** — Yaren: Nauru no tiene capital oficial: el Gobierno está en el distrito de Yaren.
- **Países Bajos** — Ámsterdam: Ámsterdam es la capital constitucional; el Gobierno está en La Haya.
- **Palestina** — Ramala: Palestina proclama Jerusalén Este como capital (también se acepta); la sede administrativa está en Ramala.
- **Sri Lanka** — Colombo: Colombo es la capital ejecutiva y judicial; Sri Jayawardenapura Kotte, la legislativa (también se acepta).
- **Sudáfrica** — Pretoria: Sudáfrica tiene tres capitales: Pretoria (ejecutiva), Ciudad del Cabo (legislativa) y Bloemfontein (judicial). Se aceptan las tres.
- **Sudán** — Jartum: Por la guerra civil, el Gobierno ha operado desde Puerto Sudán, pero Jartum sigue siendo la capital oficial.
- **Suiza** — Berna: Berna es oficialmente la «ciudad federal»: Suiza no designa capital en su Constitución.
- **Taiwán** — Taipéi: Reconocimiento limitado: la mayoría de países occidentales no lo reconocen formalmente como Estado. Solo aparece si activas la opción correspondiente.
- **Tanzania** — Dodoma: Dar es Salaam sigue siendo la mayor ciudad y capital económica.
- **Yemen** — Saná: Saná, bajo control hutí, es la capital oficial; el Gobierno reconocido opera desde Adén.

## Tabla completa

| País | Capital | Continente | Fuentes |
|---|---|---|---|
| Afganistán | Kabul | Asia | 5/5 |
| Albania | Tirana | Europa | 5/5 |
| Alemania | Berlín | Europa | 5/5 |
| Andorra | Andorra la Vieja | Europa | 5/5 |
| Angola | Luanda | África | 5/5 |
| Antigua y Barbuda | Saint John's | Caribe | 4/4 |
| Arabia Saudí | Riad | Asia | 5/5 |
| Argelia | Argel | África | 5/5 |
| Argentina | Buenos Aires | América del Sur | 5/5 |
| Armenia | Ereván | Asia | 5/5 |
| Australia | Canberra | Oceanía | 5/5 |
| Austria | Viena | Europa | 5/5 |
| Azerbaiyán | Bakú | Asia | 5/5 |
| Bahamas | Nasáu | Caribe | 5/5 |
| Bangladés | Daca | Asia | 5/5 |
| Barbados | Bridgetown | Caribe | 5/5 |
| Baréin | Manama | Asia | 5/5 |
| Bélgica | Bruselas | Europa | 5/5 |
| Belice | Belmopán | América del Norte y Central | 5/5 |
| Benín | Porto Novo | África | 5/5 |
| Bielorrusia | Minsk | Europa | 5/5 |
| Birmania | Naipyidó | Asia | 4/5 |
| Bolivia | Sucre | América del Sur | 5/5 |
| Bosnia y Herzegovina | Sarajevo | Europa | 5/5 |
| Botsuana | Gaborone | África | 5/5 |
| Brasil | Brasilia | América del Sur | 5/5 |
| Brunéi | Bandar Seri Begawan | Asia | 5/5 |
| Bulgaria | Sofía | Europa | 5/5 |
| Burkina Faso | Uagadugú | África | 5/5 |
| Burundi | Gitega | África | 5/5 |
| Bután | Timbu | Asia | 5/5 |
| Cabo Verde | Praia | África | 5/5 |
| Camboya | Nom Pen | Asia | 5/5 |
| Camerún | Yaundé | África | 5/5 |
| Canadá | Ottawa | América del Norte y Central | 5/5 |
| Catar | Doha | Asia | 5/5 |
| Chad | Yamena | África | 4/4 |
| Chequia | Praga | Europa | 5/5 |
| Chile | Santiago de Chile | América del Sur | 5/5 |
| China | Pekín | Asia | 5/5 |
| Chipre | Nicosia | Europa | 5/5 |
| Colombia | Bogotá | América del Sur | 5/5 |
| Comoras | Moroni | África | 5/5 |
| Corea del Norte | Pionyang | Asia | 5/5 |
| Corea del Sur | Seúl | Asia | 5/5 |
| Costa de Marfil | Yamusukro | África | 5/5 |
| Costa Rica | San José | América del Norte y Central | 5/5 |
| Croacia | Zagreb | Europa | 5/5 |
| Cuba | La Habana | Caribe | 5/5 |
| Dinamarca | Copenhague | Europa | 5/5 |
| Dominica | Roseau | Caribe | 5/5 |
| Ecuador | Quito | América del Sur | 5/5 |
| Egipto | El Cairo | África | 5/5 |
| El Salvador | San Salvador | América del Norte y Central | 5/5 |
| Emiratos Árabes Unidos | Abu Dabi | Asia | 5/5 |
| Eritrea | Asmara | África | 5/5 |
| Eslovaquia | Bratislava | Europa | 5/5 |
| Eslovenia | Liubliana | Europa | 5/5 |
| España | Madrid | Europa | 5/5 |
| Estados Unidos | Washington D. C. | América del Norte y Central | 5/5 |
| Estonia | Tallin | Europa | 5/5 |
| Esuatini | Mbabane | África | 5/5 |
| Etiopía | Adís Abeba | África | 5/5 |
| Filipinas | Manila | Asia | 5/5 |
| Finlandia | Helsinki | Europa | 5/5 |
| Fiyi | Suva | Oceanía | 5/5 |
| Francia | París | Europa | 5/5 |
| Gabón | Libreville | África | 5/5 |
| Gambia | Banjul | África | 5/5 |
| Georgia | Tiflis | Asia | 5/5 |
| Ghana | Acra | África | 5/5 |
| Granada | Saint George's | Caribe | 4/4 |
| Grecia | Atenas | Europa | 5/5 |
| Guatemala | Ciudad de Guatemala | América del Norte y Central | 5/5 |
| Guinea | Conakri | África | 5/5 |
| Guinea-Bisáu | Bisáu | África | 5/5 |
| Guinea Ecuatorial | Ciudad de la Paz | África | 1/5 |
| Guyana | Georgetown | América del Sur | 5/5 |
| Haití | Puerto Príncipe | Caribe | 5/5 |
| Honduras | Tegucigalpa | América del Norte y Central | 5/5 |
| Hungría | Budapest | Europa | 5/5 |
| India | Nueva Delhi | Asia | 5/5 |
| Indonesia | Yakarta | Asia | 5/5 |
| Irak | Bagdad | Asia | 5/5 |
| Irán | Teherán | Asia | 5/5 |
| Irlanda | Dublín | Europa | 5/5 |
| Islandia | Reikiavik | Europa | 5/5 |
| Islas Marshall | Majuro | Oceanía | 5/5 |
| Islas Salomón | Honiara | Oceanía | 5/5 |
| Israel | Jerusalén | Asia | 5/5 |
| Italia | Roma | Europa | 5/5 |
| Jamaica | Kingston | Caribe | 5/5 |
| Japón | Tokio | Asia | 5/5 |
| Jordania | Amán | Asia | 5/5 |
| Kazajistán | Astaná | Asia | 3/5 |
| Kenia | Nairobi | África | 5/5 |
| Kirguistán | Biskek | Asia | 5/5 |
| Kiribati | Tarawa | Oceanía | 5/5 |
| Kosovo | Pristina | Europa | 5/5 |
| Kuwait | Ciudad de Kuwait | Asia | 5/5 |
| Laos | Vientián | Asia | 5/5 |
| Lesoto | Maseru | África | 5/5 |
| Letonia | Riga | Europa | 5/5 |
| Líbano | Beirut | Asia | 5/5 |
| Liberia | Monrovia | África | 5/5 |
| Libia | Trípoli | África | 5/5 |
| Liechtenstein | Vaduz | Europa | 5/5 |
| Lituania | Vilna | Europa | 5/5 |
| Luxemburgo | Luxemburgo | Europa | 5/5 |
| Macedonia del Norte | Skopie | Europa | 5/5 |
| Madagascar | Antananarivo | África | 5/5 |
| Malasia | Kuala Lumpur | Asia | 5/5 |
| Malaui | Lilongüe | África | 5/5 |
| Maldivas | Malé | Asia | 5/5 |
| Malí | Bamako | África | 5/5 |
| Malta | La Valeta | Europa | 5/5 |
| Marruecos | Rabat | África | 5/5 |
| Mauricio | Port Louis | África | 5/5 |
| Mauritania | Nuakchot | África | 5/5 |
| México | Ciudad de México | América del Norte y Central | 5/5 |
| Micronesia | Palikir | Oceanía | 5/5 |
| Moldavia | Chisináu | Europa | 5/5 |
| Mónaco | Mónaco | Europa | 5/5 |
| Mongolia | Ulán Bator | Asia | 5/5 |
| Montenegro | Podgorica | Europa | 5/5 |
| Mozambique | Maputo | África | 5/5 |
| Namibia | Windhoek | África | 5/5 |
| Nauru | Yaren | Oceanía | 4/5 |
| Nepal | Katmandú | Asia | 5/5 |
| Nicaragua | Managua | América del Norte y Central | 5/5 |
| Níger | Niamey | África | 5/5 |
| Nigeria | Abuya | África | 5/5 |
| Noruega | Oslo | Europa | 5/5 |
| Nueva Zelanda | Wellington | Oceanía | 5/5 |
| Omán | Mascate | Asia | 5/5 |
| Países Bajos | Ámsterdam | Europa | 5/5 |
| Pakistán | Islamabad | Asia | 5/5 |
| Palaos | Ngerulmud | Oceanía | 4/5 |
| Palestina | Ramala | Asia | 4/4 |
| Panamá | Ciudad de Panamá | América del Norte y Central | 5/5 |
| Papúa Nueva Guinea | Port Moresby | Oceanía | 5/5 |
| Paraguay | Asunción | América del Sur | 5/5 |
| Perú | Lima | América del Sur | 5/5 |
| Polonia | Varsovia | Europa | 5/5 |
| Portugal | Lisboa | Europa | 5/5 |
| Reino Unido | Londres | Europa | 5/5 |
| República Centroafricana | Bangui | África | 5/5 |
| República del Congo | Brazzaville | África | 5/5 |
| República Democrática del Congo | Kinsasa | África | 5/5 |
| República Dominicana | Santo Domingo | Caribe | 5/5 |
| Ruanda | Kigali | África | 5/5 |
| Rumanía | Bucarest | Europa | 5/5 |
| Rusia | Moscú | Europa | 5/5 |
| Samoa | Apia | Oceanía | 5/5 |
| San Cristóbal y Nieves | Basseterre | Caribe | 5/5 |
| San Marino | San Marino | Europa | 5/5 |
| Santa Lucía | Castries | Caribe | 5/5 |
| Santo Tomé y Príncipe | Santo Tomé | África | 5/5 |
| San Vicente y las Granadinas | Kingstown | Caribe | 5/5 |
| Senegal | Dakar | África | 5/5 |
| Serbia | Belgrado | Europa | 5/5 |
| Seychelles | Victoria | África | 5/5 |
| Sierra Leona | Freetown | África | 5/5 |
| Singapur | Singapur | Asia | 5/5 |
| Siria | Damasco | Asia | 5/5 |
| Somalia | Mogadiscio | África | 5/5 |
| Sri Lanka | Colombo | Asia | 4/5 |
| Sudáfrica | Pretoria | África | 5/5 |
| Sudán | Jartum | África | 5/5 |
| Sudán del Sur | Yuba | África | 5/5 |
| Suecia | Estocolmo | Europa | 5/5 |
| Suiza | Berna | Europa | 5/5 |
| Surinam | Paramaribo | América del Sur | 5/5 |
| Tailandia | Bangkok | Asia | 5/5 |
| Taiwán | Taipéi | Asia | 5/5 |
| Tanzania | Dodoma | África | 5/5 |
| Tayikistán | Dusambé | Asia | 5/5 |
| Timor Oriental | Dili | Asia | 5/5 |
| Togo | Lomé | África | 5/5 |
| Tonga | Nukualofa | Oceanía | 4/4 |
| Trinidad y Tobago | Puerto España | Caribe | 5/5 |
| Túnez | Túnez | África | 5/5 |
| Turkmenistán | Asjabad | Asia | 5/5 |
| Turquía | Ankara | Asia | 5/5 |
| Tuvalu | Funafuti | Oceanía | 5/5 |
| Ucrania | Kiev | Europa | 5/5 |
| Uganda | Kampala | África | 5/5 |
| Uruguay | Montevideo | América del Sur | 5/5 |
| Uzbekistán | Taskent | Asia | 5/5 |
| Vanuatu | Port Vila | Oceanía | 5/5 |
| Vaticano | Ciudad del Vaticano | Europa | 5/5 |
| Venezuela | Caracas | América del Sur | 5/5 |
| Vietnam | Hanói | Asia | 5/5 |
| Yemen | Saná | Asia | 4/4 |
| Yibuti | Yibuti | África | 5/5 |
| Zambia | Lusaka | África | 5/5 |
| Zimbabue | Harare | África | 5/5 |
