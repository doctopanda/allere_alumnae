# ALLERE ALUMNAE | Atlas escolar nutricional de Sonora

Mapa público de escuelas identificadas en el filtro del tablero IMSS de Sonora, con capas de **cobertura de consulta** y **distribución parcial de categorías IMC**. Sitio estático en GitHub Pages.

## Visor
- [Abrir ALLERE ALUMNAE](https://doctopanda.github.io/allere_alumnae/)
- 72 polígonos municipales simplificados y almacenados en `data/municipios_sonora.geojson`.
- 1,501 CCT detectadas en el filtro IMSS; 1,497 con coordenadas SEP referenciales. El cruce de polígonos coincide para 1,496 de ellas, con una CCT por revisar.
- Filtro de municipio, CCT y estado de extracción. Los puntos escolares no publican datos clínicos por escuela.
- Mapa **nutricional**: cambiar entre Peso bajo / Sobrepeso / Obesidad; colores por porcentaje de cada categoría entre las clasificaciones IMC del **respaldo parcial de 194 CCT**.
- Sólo **siete municipios** cuentan con denominadores IMC completos y adecuados para ese mapa descriptivo. Los demás aparecen en gris (sin datos públicos utilizables).
- **AGEB urbanas y rurales**: activación por municipio con geometrías del servicio de INEGI, para mostrar ubicación de escuelas por AGEB; **no** se colorean tasas IMC por AGEB porque no existen agregados suficientes y autorizados.
- No se presenta un mapa de “grado de desnutrición”. Peso bajo es una categoría del tablero, no una clasificación clínica de gravedad.

## GitHub Pages
Settings → Pages → Deploy from a branch → `main` / `/(root)`.

## Geografía
- GeoJSON municipal simplificado derivado de [MacWilliXD/INEGI-geojson](https://github.com/MacWilliXD/INEGI-geojson), atributos `cvegeo`, `cve_agem`, `nom_agem`; geometría de referencia, no deslinde legal.
- AGEB de referencia: [servicio oficial INEGI](https://www.inegi.org.mx/servicios/catalogounico.html), `agebu` (urbanas) y `agebr` (rurales), clave territorial municipal. Para reducir dependencia de CORS, use **Actions → Descargar AGEB urbanas de Sonora** y genere una copia local por municipio. Si el servicio no responde, el mapa municipal permanece operativo.
- Una escuela se puede asociar al **AGEB donde está su plantel**, no al AGEB de residencia de sus alumnos. **No inferir tasas de habitantes del AGEB a partir de la escuela**.

## Datos nutricionales
- `data/nutricion_municipal_parcial.json`: siete municipios con numerador, denominador y proporción verificada por categoría. El denominador es la suma de categorías IMC cuando la clasificación está completa, **no** población municipal ni matrícula estatal.
- Corte: respaldo del **24/10/2026**, 194 CCT. No se dispone en el repositorio de las hojas epidemiológicas de las 1,393 CCT que constaban como completadas en el checkpoint posterior.
- `data/nutricion_ageb_autorizada.json`: estructura reservada, **sin registros**, para eventuales indicadores AGEB validados y autorizados.
- Años/ciclos: el tablero de inventario reportó 2025–2026, pero los CSV del respaldo no contienen ciclo verificado por CCT; no se asumen homogéneos por escuela.
- El mapa representa un **subconjunto no aleatorio**, sin estimar prevalencia municipal o estatal ni comparar riesgo poblacional.

## Seguridad y actualización
- No publicar microdatos, nombres de alumnos, CURP, expedientes, cookies, contraseñas ni CSV nominales en GitHub Pages.
- Subgrupos pequeños se suprimen. Para una capa AGEB nutricional futura exigiremos mínimo cinco CCT, 50 clasificados, categorías completas, filtros confirmados y autorización de publicación.
- Consulte [ACTUALIZACION.md](ACTUALIZACION.md) y [METODOLOGIA.md](METODOLOGIA.md).
