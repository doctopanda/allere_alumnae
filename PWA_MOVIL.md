# ALLERE ALUMNAE · Webapp móvil (PWA)

**Entrada:** https://doctopanda.github.io/allere_alumnae/movil.html

La versión móvil usa los archivos `data/indicadores_20261028.json` y el visor territorial Leaflet existente (`index.html?app=1`) y conserva el tablero integral (`plataforma.html`) en paralelo.

## Funcionalidades
- Inicio: cuatro KPIs, cobertura de extracción/evaluación, tres pendientes diferenciados.
- Mapa: Leaflet interactivo con filtro desplegable y ficha territorial deslizable, y capas de escuelas bajo demanda. Sin replicar los datos del mapa.
- Visor: pestaña con la plataforma integral incrustada dentro de la webapp.
- Tablero: selección distrito/municipio, indicadores, barras de IMC con datos publicables, comparación entre los 6 distritos.
- Tarjetas clicables: formula, numerador, denominador y alcance del indicador.
- Instalación: Android Chrome (Instalar app) o iPhone Safari (Compartir → Añadir a pantalla de inicio).

## Privacidad y limitaciones
- No existe una base nominal en la webapp. Sólo datos agregados publicados.
- Mantiene supresión de nutrición municipal en datos no publicables. «S/D» no significa 0.
- No infiere prevalencia en la población general ni atribuye residencia infantil a las escuelas.
- PWA es instalable por HTTPS; **mapa, tiles y datos requieren conexión a internet**. El service worker guarda sólo la estructura básica de la webapp, nunca los JSON de datos ni la cartografía.
- La app muestra el corte fechado 28 OCT 2026; **no** es vigilancia en tiempo real.
- No se modifican los filtros, indicadores o controles de la versión escritorio fuera del modo `?app=1`.

## Archivos
`movil.html`, `movil.css`, `movil.js`, `mobile-map.css`, `mobile-map.js`, `manifest.webmanifest`, `sw.js`.
