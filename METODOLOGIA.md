# ALLERE ALUMNAE | Fuentes y metodología (corte 2026-10-28)

## Origen y definición
1. `data/escuelas.json`: 1,501 CCT devueltas por el filtro **Sonora** y **ciclo 2025–2026** del tablero IMSS `Peso y talla (IMC) Escuela` el 28/10/2026. Cruce con catálogos SEP 2024–2026.
2. De estas CCT, 1,497 tienen coordenadas referenciales de SEP. Cuatro CCT adicionales tienen coincidencias históricas, pero se omite su posición geográfica hasta verificarla.
3. `estadoExtraccion` procede del archivo local `ESTADO_CCT_ACTUAL.csv` de 28/10/2026. Significa completada, fallida o pendiente a nivel de **operación de captura**, NO que los datos estén epidemiológicamente validados.
4. `data/salud_agregada.json` resume exclusivamente un ZIP de resultados anterior con **194 CCT**, fechado 24/10/2026. El ZIP contiene registros de consultas confirmadas en ese corte, aunque el campo ciclo escolar no está disponible por CCT en esos CSV.

## Cifras del inventario
- 1,501 CCT en Tableau Sonora; 1,497 coincidentes con el padrón SEP 2026; cuatro recuperadas de catálogos SEP históricos.
- 1,393 completadas en el checkpoint, 17 fallidas, 87 pendientes, cuatro sin estado actual por estar ausentes en el padrón 2026.
- **No** están aquí las tablas epidemiológicas de las 1,393 CCT completadas. Hasta recibir el ZIP actualizado, no se puede calcular cobertura real de menores ni indicadores de IMC del universo.

## Indicadores de muestra parcial
- 194 CCT en ZIP del 24/10/2026.
- 20,787 registros de menores evaluados según la medida total de esas hojas.
- 20,188 clasificaciones IMC dentro de las cuatro categorías reportadas. La diferencia de 599 no debe clasificarse sin más información.
- Categorías: normal 10,984; sobrepeso 3,981; obesidad 4,651; peso bajo 572.
- En la vista municipal sólo hay valores de municipios con **al menos cinco CCT y 50 menores evaluados** en el respaldo. Los conteos de subgrupos inferiores a 11 se suprimen.
- Estas cifras no son indicadores de prevalencia municipal o estatal, pues representan un subconjunto no aleatorio y con distinto corte temporal.

## Privacidad y mapa público
- GitHub Pages es de acceso público. **Nunca** subir filas nominales con nombres de alumnos, CURP, direcciones, teléfonos, sexo/edad individuales, muestras pequeñas o expedientes.
- El archivo `escuelas.json` sólo contiene CCT, nombre de escuela, municipio, localidad, posición SEP referencial y estado técnico de captura.
- La información clínica agregada se almacena separada de las escuelas para impedir reconstrucción de información de grupos pequeños.
- No geolocalizar viviendas ni a menores. Revisar nuevas fuentes con un procedimiento formal de minimización y autorización antes de publicarlas.

## Actualizaciones
1. Exportar un nuevo `RESULTADOS_IMSS_TABLEAU_RESCATE.zip` desde la computadora local.
2. Revisar el checkpoint y el manifiesto; no confundir el número de CCT procesadas con los archivos realmente entregados.
3. Recalcular agregados con validación de filtros, eliminación de duplicados y supresión estadística.
4. Actualizar sólo el JSON público, sin transmitir archivos nominales o cookies.

## Estado de despliegue
El sitio es estático y está preparado para GitHub Pages desde la rama `main`, carpeta `/(root)`. GitHub Pages debe habilitarse en la configuración del repositorio, si aún no lo está.
