# 🐆 ALLERE ALUMNAE · Atlas nutricional escolar y demográfico de Sonora

[**Abrir mapa en GitHub Pages**](https://doctopanda.github.io/allere_alumnae/)

## Estado de la versión 30/10/2026

La portada `index.html` carga `atlas.js` y `atlas.css`. Esta versión utiliza los datos reales de extracción IMSS, cartografía municipal y proyecciones municipales CONAPO.

| Insumo | Resultado | Fuente |
|---|---:|---|
| Catálogo SEP 2026 | 5,464 CCT | Catálogo SEP cruzado localmente |
| CCT ofrecidas por filtro Tableau | 1,501 | Sonora, ciclo mostrado 2025–2026 |
| CCT con diez hojas extraídas y filtros confirmados | 1,393 | Respaldo 28/10/2026, 16:40 |
| Menores registrados en CCT extraídas | 222,170 | Hoja Total Menores |
| Menores evaluados en CCT extraídas | 120,858 | Hoja Total Menores Evaluados |
| Clasificaciones IMC | 113,834 | Hoja Peso y Talla IMC Escuela |
| Municipios y distritos | 72 / 6 | Regionalización de Salud Sonora y polígonos municipales |
| Población proyectada de 0–4 años en Sonora en 2026 | 246,122 | Excel CONAPO 2015–2030 aportado por usuario |

## Funcionalidades

- **Mapa y tabla**: colorear municipios o distritos por porcentaje de CCT extraídas, menores evaluados, peso bajo, peso normal, sobrepeso y obesidad.
- **Panel territorial**: seleccionar municipio o distrito para consultar numerador, denominador, escuelas, evaluados y distribución nutricional del subconjunto capturado.
- **Población 0–4**: selector 2015–2030, mapa de conteos y porcentaje sobre población total proyectada, curvas municipal/distrital/estatal y desagregación por sexo. Datos en `data/conapo_0_4_2015_2030.json`.
- **AGEB**: consulta de geometría INEGI por municipio (urbanas/rurales). Cuenta planteles por ubicación SEP; no presupone residencia del alumnado. Si se importa una fuente censal urbana validada, muestra P_0A4 de INEGI **2020**, no una proyección 2026.
- **Curvas OMS**: enlace a las referencias 0–5 y 5–19. **No calcula puntuaciones Z individuales**, porque no contamos con peso, estatura, edad exacta y sexo por niño.

## Diferencias metodológicas fundamentales

1. **Cobertura de escuelas**: `CCT con extracción / CCT visibles en Tableau`. No representa la totalidad de escuelas SEP.
2. **Cobertura de menores**: `menores evaluados / menores registrados en las CCT extraídas`. No es cobertura poblacional infantil por municipio.
3. **CONAPO 0–4**: proyección demográfica de **residentes**, no escolares ni niños evaluados. No dividir las evaluaciones IMSS (edad 4–16) entre esta población.
4. **INEGI 2020**: recuentos **censales**. A nivel Sonora, el censo reporta **218,345 personas de 0–4 años en 2020**, mientras que la serie del Excel CONAPO proyecta **251,000 para 2020**. Diferentes fuentes, metodologías y procesos de medición. [Tabulado oficial INEGI](https://www.inegi.org.mx/app/tabulados/interactivos/?pxq=Poblacion_Poblacion_01_e60cd8cf-927f-4b94-823e-972457a12d4b).
5. **AGEB urbana 2020**: disponible oficialmente como resultados del CPV 2020, variable `P_0A4`. [Ficha oficial Sonora](https://www.inegi.org.mx/app/descarga/ficha.html?ag=0&f=csv&tit=326096). No se publica una cifra AGEB sin obtener y verificar el CSV.
6. **Grado de desnutrición**: no calculable con `Peso Bajo` agregado; requeriría referencias OMS y antropometría individual autorizada.

## Cómo publicar la capa INEGI 2020 AGEB

La cartografía AGEB puede abrirse desde el servicio público INEGI. Para agregar la población 0–4 real **por AGEB urbana**:

1. Abra [Actions → Censo INEGI 2020 · AGEB 0–4 Sonora](https://github.com/doctopanda/allere_alumnae/actions/workflows/inegi_ageb_2020.yml).
2. Ejecute `Run workflow`. Descarga el ZIP oficial (si está disponible), comprueba las claves y suprime celdas pequeñas.
3. Si termina correctamente, aparece `data/inegi_ageb_2020_0_4.json` y el visor lo lee automáticamente. **Hasta entonces no existen conteos P_0A4 cargados en el mapa.**
4. Si la descarga falla, no se publica nada. Puede descargarse manualmente el ZIP oficial y ejecutar `python scripts/inegi_ageb_2020.py --zip RUTA_DEL_ZIP`.

El dataset AGEB publicado se limita a información censal agregada, nunca información de menores evaluados por escuela.

## Privacidad, trazabilidad y advertencias

- GitHub Pages es público. **Jamás** subir microdatos, CURP, domicilios, registros nominales, cookies de sesión ni ZIP con información individual.
- Las categorías IMC son el resultado de un subconjunto escolar capturado, no prevalencia representativa de todos los residentes.
- Los territorios sin celdas suficientes se muestran como **sin dato**, no cero.
- La categoría `Peso Bajo` del Tableau no clasifica desnutrición moderada/severa.
- Para agregar indicadores nutricionales por AGEB se necesitarán límites comprobados, asignación escolar al polígono y umbrales de supresión.

## Archivos vigentes

- `index.html`, `atlas.js`, `atlas.css`: visor.
- `data/indicadores_20261028.json`: IMSS agregados por distrito y municipio.
- `data/escuelas_sep2026_ubicacion.json`: 5,464 CCT SEP y estado de consulta, sin datos clínicos por plantel.
- `data/conapo_0_4_2015_2030.json`: proyecciones 72 municipios, sexos y 16 años.
- `data/municipios_sonora.geojson`: 72 polígonos simplificados, referencia cartográfica.
- `scripts/inegi_ageb_2020.py`: importador censal AGEB.

Los anteriores archivos `app.js`, `styles.css` y `data/salud_agregada.json` quedan conservados como legado; `index.html` ya no los utiliza.

