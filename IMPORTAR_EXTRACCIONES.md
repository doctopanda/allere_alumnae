# Incorporación de extracciones IMSS a ALLERE ALUMNAE

## Ubicación exacta en Windows

**Datos de extracción:** `C:\Users\ibrah_vyrp0yd\IMSS_TABLEAU_RESCATE_SONORA`

- `VALIDADOS\CCT_PADRON_SONORA\Peso y Talla\DATA__Peso y talla (IMC) Escuela.csv`
- `VALIDADOS\CCT_PADRON_SONORA\Peso y Talla\DATA__Total Menores Evaluados.csv`
- `MANIFEST_EXTRACCION.csv`, `CHECKPOINT.json`, `ERRORES.csv`

**ZIP de respaldo creado con V2.7 opción 7:**
`C:\Users\ibrah_vyrp0yd\IMSS_RESPALDOS_SEGUROS\IMSS_SONORA_RESPALDO_FECHA_HORA.zip`.

La opción 7 genera un ZIP dentro de `IMSS_RESPALDOS_SEGUROS`. No confundirse con el respaldo anterior `RESULTADOS_IMSS_TABLEAU_RESCATE.zip` de 194 CCT.

## Estado del mapa hoy

- Ya se publicaron tres opciones de coloreado municipal: peso bajo, sobrepeso y obesidad.
- El respaldo del 24 de octubre de 2026 contiene **194 CCT**, **20,787 menores evaluados reportados**, **20,188 clasificaciones IMC** y resultados de **20 municipios**, de los cuales **7 reúnen el criterio para publicar proporciones descriptivas**. Los otros aparecen grises en el mapa nutricional.
- La sección **Panorama IMC parcial** incluye ahora una tabla municipal y la exportación de los agregados permitidos. El mapa muestra numerador y denominador para cada indicador.
- `data/auditoria_respaldo_20261024.json` documenta controles de validación.
- Los resultados posteriores de 1,393 CCT completadas **todavía no se han recibido** en esta conversación como tablas CSV. No sustituir esta distinción por una afirmación de cobertura epidemiológica.

## Importar un ZIP más reciente

1. Desde la V2.7, elegir la opción **7** para respaldar resultados.
2. Enviar el ZIP a la conversación para auditoría y actualización del mapa; si se trabaja de forma local, descargar el repositorio y ejecutar desde su raíz:

```powershell
py scripts/importar_zip_imss.py --zip "C:\Users\ibrah_vyrp0yd\IMSS_RESPALDOS_SEGUROS\IMSS_SONORA_RESPALDO_FECHA_HORA.zip"
```

3. Se generan exclusivamente dos archivos **locales** en `REPORTES_AUDITORIA_IMSS`:
   - `AUDITORIA_ZIP_IMSS.json`: integridad y recuentos por categoría.
   - `CANDIDATO_AGREGADO_MUNICIPAL_REVISAR.json`: posible agregado municipal con supresión.
4. No actualizar automáticamente GitHub: revisar filtros, numerador, denominador, fecha/ciclo y autorización institucional antes de incorporar los indicadores. Los errores generan una excepción y el archivo público permanece intacto.

## Interpretación y límites éticos

- Una escuela con consulta confirmada no implica necesariamente información nutricional completa.
- Los porcentajes de IMC por municipio son proporciones descriptivas del subconjunto recuperado, no prevalencia representativa del municipio ni del estado.
- Peso bajo del tablero no es una clasificación validada de desnutrición moderada/severa.
- Las AGEB geográficas localizan **planteles**, no domicilios de los niños. Sin tabulación autorizada y suficientemente agregada, las AGEB se muestran sin tasas de IMC.
- No subir ZIP originales del IMSS, archivos con datos individuales, credenciales, ni `REPORTES_AUDITORIA_IMSS` al repositorio público.
