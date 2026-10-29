# ALLERE ALUMNAE | Continuidad del visor territorial

## Estado del proyecto (28 de octubre de 2026)

- **1,501 CCT** observadas en el filtro IMSS Sonora, ciclo 2025–2026.
- **1,497 escuelas** con coordenadas SEP referenciales; las otras cuatro se mantienen sin ubicación hasta verificarlas.
- **1,393 completadas** en el checkpoint recibido; **17 fallidas, 87 pendientes y 4 sin estado** (no están en el padrón SEP 2026).
- Respaldo epidemiológico disponible en el repositorio: **194 CCT**. Es un corte previo, no representa el total completado en el checkpoint.
- Panorama nutricional publicado **sólo en agregados de muestra**, con celdas pequeñas suprimidas.
- Los datos del filtro Tableau, el checkpoint y los resultados sanitarios son **fuentes diferentes** y se mantienen separados.

## Mapa municipal

Interfaz: seleccione *Mostrar polígonos municipales*. Puede colorear los municipios por:
- Número de CCT del filtro IMSS asociadas al municipio.
- Porcentaje de CCT **completadas en el checkpoint**, indicador de avance técnico, **no** de prevalencia sanitaria.

Haga clic en un polígono para filtrar las escuelas del municipio. Si un municipio no tiene CCT dentro del subconjunto Tableau consultado, el mapa puede mostrar cero escuelas; eso no significa que no tenga planteles.

Los límites se leen primero de `data/municipios_sonora.geojson` si GitHub Actions lo generó. Si no existe, el visor intenta leer la fuente externa `https://raw.githubusercontent.com/MacWilliXD/INEGI-geojson/main/geojson_descargas/AGEM_26.geojson`. Si ambas fuentes fallan, los marcadores escolares siguen funcionando.

El workflow `generar_poligonos.yml` descarga y valida la cartografía de Sonora y la simplifica para uso web. Confirme la ejecución en la pestaña Actions del repositorio. Si sus permisos de GitHub Actions impiden hacer commit, los polígonos remotos siguen siendo un respaldo, pero no se debe afirmar que el GeoJSON local exista.

**Procedencia:** [MacWilliXD/INEGI-geojson](https://github.com/MacWilliXD/INEGI-geojson), recopilación comunitaria atribuida a insumos cartográficos INEGI (2025). Estas geometrías son aproximadas para visualización y no sirven como deslindes jurídicos.

## Actualizar el estado de extracción sin publicar microdatos

Este proceso **NO transfiere a GitHub los CSV epidemiológicos ni los expedientes**:

1. En Windows, desde la V2.7, genere o actualice `AUDITORIA_LOCAL/ESTADO_CCT_ACTUAL.csv`.
2. Descargue el repositorio (o haga `git pull` si ya lo tiene clonado).
3. Dentro de la carpeta del repositorio ejecute:

```powershell
py scripts/actualizar_estado_local.py --dry-run
py scripts/actualizar_estado_local.py
```

El programa lee por defecto:
`%USERPROFILE%\IMSS_TABLEAU_RESCATE_SONORA\AUDITORIA_LOCAL\ESTADO_CCT_ACTUAL.csv`.

Si está en otra ruta, use `--csv "RUTA_COMPLETA.csv"`. Conserva 1,501 CCT y cambia únicamente la última columna `estadoExtraccion`. El archivo `data/escuelas.json.bak` queda sólo en su computadora, **nunca lo suba a GitHub**.

Verifique el `git diff` y publique sólo `data/escuelas.json` y `data/estado_corte.json` cuando corresponda.

## Incorporar los resultados clínicos cuando el IMSS regrese

1. Respalde la carpeta completa de extracción en ZIP.
2. Compruebe que las consultas en `MANIFEST_EXTRACCION.csv` tengan filtro CCT confirmado y un único ciclo escolar atribuible.
3. Audite duplicados, categorías IMC y denominadores entre hojas. Un checkpoint «completado» no significa que las medidas sean correctas.
4. Agregue únicamente resultados públicos permitidos por municipio y por periodo. Aplique supresión de subgrupos pequeños antes de cualquier publicación.
5. Actualice `data/salud_agregada.json` después de revisar la consistencia con el informe de auditoría.

**No** suba `RESULTADOS_IMSS_TABLEAU_RESCATE.zip`, `CHECKPOINT.json`, `ERRORES.csv` ni bases nominales al repositorio público.

## Despliegue

GitHub Settings → Pages → Deploy from a branch → `main` / `/(root)`.
La URL esperada para Pages, cuando GitHub confirme el despliegue, es:
`https://doctopanda.github.io/allere_alumnae/`.

El estado real del despliegue debe verificarse en GitHub Pages o Actions.
