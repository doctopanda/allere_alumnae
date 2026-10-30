# ALLERE ALUMNAE | Identidad BOOBOK · paquete integrado 30/10/2026

**ALLERE ALUMNAE** es la plataforma madre de nutrición y cuidado infantil, con mapas, captura, análisis, seguimiento y visualización territorial.

**BOOBOK** es el sapo guardián de la infancia y el nombre del motor de vigilancia nutricional, detección de riesgos y seguimiento. No reemplaza el nombre ni los indicadores de ALLERE ALUMNAE.

## Identidad gráfica seleccionada

Se integró `BOOBOK_Paquete_Extraccion_Datos_Escolares(1).zip` después de leer `LEEME_INTEGRACION.md` y `MENSAJE_PARA_EL_OTRO_CHAT.txt`. El diseño seleccionado es **Venusaur**, con formas orgánicas planas, contraste crema/turquesa, flor rosa, hojas verdes y tratamiento de emblema simplificado tipo BALAM. Las variantes Blastoise, Charizard y Gengar no se usan como marca principal.

Paleta: `#409993` turquesa, `#7BB7B7` azul agua, `#5E9569` verde, `#EC889B` rosa, `#817060` tierra.

## Recursos gráficos integrados

| Archivo en GitHub | Derivado del ZIP | Uso |
|---|---|---|
| `assets/boobok/BOOBOK_avatar_128.png` | `02_Interfaz/BOOBOK_avatar_128.png` | Avatar de cabecera y miniatura del mapa |
| `assets/boobok/BOOBOK_avatar_256.png` | `02_Interfaz/BOOBOK_avatar_256.png` | Avatar de alta densidad y tarjeta de sidebar |
| `assets/boobok/BOOBOK_ficha_vertical.webp` | `02_Interfaz/BOOBOK_ficha_vertical.png` (conversión WebP para optimizar carga) | Modal «Conocer identidad y funciones» |
| `assets/boobok/BOOBOK_pin_48x72.png` | `03_Mapa_Leaflet/BOOBOK_pin_48x72.png` | Icono `L.icon` reservado para eventos autorizados del motor |

No se muestran círculos de Pantone en el visor. Las ilustraciones del paquete pueden contener texto previo de marca, por lo que la definición funcional se presenta en texto HTML separado.

## Acrónimo funcional (propuesta pendiente de aprobación final)

- **B**: Búsqueda activa
- **O**: Observación del crecimiento
- **O**: Orientación nutricional
- **B**: Bienestar infantil
- **O**: Oportunidad de intervención
- **K**: Kárdex de seguimiento

No presentar el acrónimo como traducción de la tradición yoeme-yaqui. **Lema propuesto:** BOOBOK: Cada infancia cuenta. Cada crecimiento importa.

## Usos en el visor

1. Avatar de BOOBOK en la cabecera, manteniendo destacado ALLERE ALUMNAE.
2. Tarjeta de vigilancia nutricional en la barra lateral, con acceso a la ficha vertical.
3. Miniatura independiente arriba a la izquierda del mapa, accesible con teclado; zoom Leaflet permanece arriba a la derecha.
4. Ventana con imagen vertical, propuesta de acrónimo y guía de iconografía.
5. `boobokMarkerIcon = L.icon({iconUrl:'./assets/boobok/BOOBOK_pin_48x72.png',iconSize:[48,72],iconAnchor:[24,70],popupAnchor:[0,-65]})` en `atlas.js`. El pin se renderiza **sólo** para eventos públicos validados incluidos en `data/boobok_eventos_publicos.json`.
6. El archivo de eventos comienza vacío. **No se inventan alertas ni ubicaciones.** No se sustituye ningún marcador escolar.

El motor de procesamiento de eventos es una arquitectura preparada para futuras integraciones y no debe describirse como sistema de vigilancia automatizada ya conectado a fuentes en tiempo real.

## Fuentes y privacidad

El atlas mantiene sin cambios los JSON de IMSS, SEP, INEGI, CONAPO y límites municipales. Una consulta de CCT completada no significa evaluación completa de los menores, y la geografía escolar no representa domicilios. No publicar expedientes ni intervenciones identificables.
