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
- Raised Spot UV / 3D UV.
- Embossing.
- Debossing.

Los tres acabados nuevos se ofrecen para texto normal, arqueado, imágenes y assets, uno por capa. Se muestra un único control Height/Depth (0.02–0.8 mm, predeterminado 0.2), agrupado en un paso de undo durante el arrastre. La selección múltiple aplica acabado/profundidad a todos los textos seleccionados. Tinta y colores de imagen permanecen editables para UV/relieve; opacidad/blur/text surface/contrast y los efectos de texto se omiten mientras hay un acabado físico. En imágenes se utiliza el alfa original y se conservan crop y esquinas redondeadas: una imagen opaca cubre el rectángulo entero.

El canvas usa iluminación/sombras sutiles, sin contaminar las capturas de albedo para el modelo. En 3D, máscaras por acabado/superficie/cara codifican altura; se combinan en un campo firmado (emboss y UV positivos, deboss negativo) que genera normales Sobel. Este microrelieve cambia con luces/cámara y se exporta como normal map estándar en el GLB; **no desplaza la malla ni constituye geometría de fabricación**. UV conserva el color impreso y añade máscaras de roughness y clearcoat para barniz transparente localizado. Se conserva el grano fino del cartón. No cambia el contorno exterior de la malla. La profundidad física definitiva debe acordarse con la imprenta. Falta inspección visual en navegador de esta sesión.

Export → Print finish masks — ZIP contiene separaciones negras independientes para UV, emboss, deboss y foil por lado/superficie; no lleva luces, sombras ni profundidad de preview. El centro del cookie queda lleno en estas separaciones, igual que en los archivos de impresión. No son PDFs de prensa certificados.

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
