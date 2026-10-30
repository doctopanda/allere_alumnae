# ALLERE ALUMNAE | Escuelas y población censal 0–4 por AGEB

## Fechas y fuentes

- Escuelas: catálogo SEP Sonora 2026, **5,464 CCT**. De éstas:
  - **1,393** con consulta del Tableau IMSS extraída y filtro confirmado.
  - **104** presentes en la lista Tableau Sonora 2025–2026, pero sin extracción completa.
  - **3,967** presentes en padrón SEP y no observadas en el filtro Tableau recuperado.
- Fuera del padrón SEP 2026 hay otras **cuatro CCT históricas** presentes en Tableau; no se asignan coordenadas sin validación.
- INEGI: **Censo de Población y Vivienda 2020**, resultados por **AGEB y manzana urbana de Sonora**. Archivo: `ageb_mza_urbana_26_cpv2020_csv.zip` provisto por el usuario. Sólo se usan filas totales AGEB (`MZA=000`).
- CONAPO: proyecciones 2015–2030 por municipio. Nunca sustituyen una medición INEGI 2020 ni se interpolan automáticamente a AGEB.
- IMSS: corte local del 28/10/2026, tablas de `Peso y talla`. No son mediciones nominales ni tabulación por domicilio.

## Regla de edades 0–4 en Censo 2020

**No existe una variable directa P_0A4 en este producto AGEB urbano.**

Usamos la identidad algebraica exacta, cuando todos los componentes se publican numéricamente:

```text
P_0A4 = P_0A2 + P_3YMAS - P_5YMAS
```

Razonamiento: `P_3YMAS - P_5YMAS` representa personas de 3–4 años cumplidos.

Validaciones:
- El total estatal calculado coincide con el conteo oficial INEGI 2020: **218,345 residentes de 0–4 años**.
- Hay 72 municipios con cifras censales y la suma coincide con 218,345.
- En el archivo hay 3,206 filas de AGEB urbana; se publican **1,926** con recuentos calculables >=11.
- **700 AGEB** quedan ocultas por tener recuentos de 0–4 inferior a 11.
- **580 AGEB** presentan al menos un componente no divulgado y no se puede reconstruir el valor.
- Suma de 0–4 dentro de las 1,926 AGEB divulgables: **190,243**. Esta cifra es parcial, no debe compararse como si fuera la totalidad de residentes estatales.

## Interacción del mapa

- **Mostrar puntos de escuelas**: activa u oculta todos los puntos.
- **Escuelas visibles en el mapa**:
  1. Todas las escuelas SEP
  2. Extraídas
  3. En filtro Tableau, pendientes de extracción
  4. Sólo SEP, no observadas en Tableau
- Colores: verde, ámbar, gris azulado respectivamente.
- Los filtros de municipio y distrito aplican también a los puntos.
- En una AGEB con polígono disponible, se muestran las CCT cuyo **plantel** intersecta la geometría, no dónde viven sus alumnos.
- Si no llegan las geometrías, la sidebar mantiene un **buscador de AGEB con conteo censal**, sin inventar posiciones para esas claves.
- En nivel AGEB la capa `under5` y `under5_share` se alimenta de **INEGI 2020**; en municipio/distrito la serie anual 2015–2030 es **CONAPO**. El panel lateral muestra ambas fuentes separadas.
- Los indicadores nutricionales IMSS no se publican por AGEB, pues la extracción no trae domicilios ni totales adecuados para esa atribución.

## Límite clave

**No dividir los niños evaluados IMSS entre residentes de 0–4 años de INEGI o CONAPO.** La población del operativo escolar está centrada en otras edades; los universos no coinciden.

De la misma forma, **CCT extraída** ≠ **todos los niños del plantel evaluados**. La cobertura de evaluaciones usa los menores reportados por el propio Tableau, dentro de las CCT extraídas.

Fuente oficial cartográfica: https://www.inegi.org.mx/servicios/catalogounico.html
Censo 2020: https://www.inegi.org.mx/contenidos/programas/ccpv/2020/datosabiertos/ageb_manzana/ageb_mza_urbana_26_cpv2020_csv.zip
