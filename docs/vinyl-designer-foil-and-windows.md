# Foil y ventanas del sleeve

Implementado localmente el 2026-10-29. No se desplegó en esta tarea.

## Ventanas independientes

Project settings → Sleeve windows: `A side window` y `B side window`. Abiertas por defecto, también al importar proyectos anteriores. Se pueden cerrar ambas o solo una.

Sleeve view, export SVG/PNG/PDF/PSD y geometría GLB respetan cada lado. En PSD, la galleta de un lado cerrado queda como capa oculta. Cookie view permite seguir editando esa galleta aunque esté cubierta; no se elimina su diseño ni se modifica el agujero del vinilo. En 3D se construye un panel realmente sólido, no una tapa encima de un agujero.

## Acabado de capas

Project settings → Sleeve material conserva `Matte` como valor por defecto (incluidos proyectos antiguos) y permite `Printed cardboard — soft sheen`: cartón impreso con reflejo amplio/difuso y grano procedural fino mediante normal map. Se aplica a ambas caras y pliegues, no al foil ni a la galleta. Se guarda en JSON/versiones/undo y en el material del GLB; no modifica las separaciones de impresión ni el arte plano. Textura compartida y liberada con el preview; entorno de estudio habilitado para percibir el acabado. La apariencia exacta requiere revisión visual.

Seleccionar texto, texto arqueado, imagen o asset → Print finish:

- Ink Matte.
- Hot Foil Silver.

La selección múltiple aplica el acabado a todos los textos seleccionados. En imágenes y assets, el foil sustituye los colores originales usando exclusivamente el canal alfa: un PNG transparente conserva su silueta y una imagen opaca genera un rectángulo completo. Crop y esquinas redondeadas siguen aplicándose. Opacidad, blur, contraste y textura se ignoran y se ocultan mientras hay foil; sus valores se conservan para volver a Ink. En imágenes mate, Blur aparece debajo de Opacity. Las siluetas de imágenes también se incluyen en las máscaras de material 3D y las separaciones para imprenta.

2D muestra un degradado metálico estático. En 3D, la captura base excluye las capas foil. Una superficie metálica independiente usa una máscara de cobertura de 2048 px como alfa de su textura RGBA, con metalness constante 1 y roughness 0.035. Los píxeles parcialmente cubiertos mezclan metal y fondo real, sin interpolar entre papel y metal (lo que provocaba un halo blanco). No se umbraliza ni expande la silueta. La superficie comparte geometría con la galleta para seguir los pressing rings; en el sleeve se limita a los grupos de geometría impresa. Un pequeño polygon offset evita z-fighting sin separar físicamente el acabado. Los elementos delante del foil lo ocultan en la máscara. La textura RGBA y el material viajan en el GLB estándar (sin depender de alphaMap, que GLTFExporter no exporta). Las miniaturas de GLB reflectantes añaden un entorno de estudio y liberan sus recursos tras la captura. Falta comprobar visualmente este ajuste: no hay navegador disponible en la sesión.

Las opciones se conservan en JSON, guardado de versiones, recuperación local, copiar capas y undo/redo. Cambiar las ventanas o las máscaras invalida el enlace compartido en caché para volver a exportar el modelo actualizado con el mismo ID por versión.

## Preparación de foil para imprenta

Export → Foil masks — ZIP of black SVG plates. Elegir lado actual o ambos. Include sleeve añade las separaciones del sleeve además de las de Cookie, en archivos independientes.

El ZIP contiene una máscara negra por color de foil, lado y superficie, más README. Negro = cobertura de foil; no se exportan los degradados metálicos del preview. Usa un enmascarado de luminancia para recortar las partes cubiertas por elementos delante del foil. Las fuentes están embebidas, no convertidas a contornos. Custom colors diferentes producen separaciones diferentes.

**No es un PDF certificado de imprenta ni una tinta plana/spot color ya configurada.** Confirmar con la imprenta el material real (foil no es un RGB exacto), contornos, separaciones, trapping, grosores mínimos y formato requerido. Blur, transparencias y efectos gráficos pueden producir cobertura parcial que la imprenta necesite convertir a una máscara binaria. Photoshop muestra la apariencia rasterizada del foil; no crea una capa de tinta plana automáticamente.

## Verificación

`npm test` incluye `test-foil-windows.mjs`: persistencia/importación/undo, defaults antiguos, selección de foil válida, SVG de texto/arco/extrusión, oclusión de máscaras, cuatro combinaciones de ventanas con raycasts sobre geometría real, canales lineales de material y comprobaciones de export/composición. Typecheck y build se ejecutan aparte.

No hubo navegador conectado disponible para inspección visual en esta sesión; no se presenta una captura ni una verificación visual como realizada. Antes de publicar, revisar reflejos, lectura y controles en claro/oscuro y móvil.
