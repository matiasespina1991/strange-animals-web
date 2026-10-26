# Auditoría de calidad — Vinyl Designer Configurator

Fecha: 2026-10-26. Alcance: únicamente el configurador de vinilos, sus renderers, modelo, exportadores, estilos, persistencia, enlaces y pruebas directamente asociadas. La página compartida de Typefaces/Fonts queda fuera de alcance, aunque el configurador la consuma como catálogo.

## Resumen ejecutivo

Los riesgos más importantes no son cosméticos: operaciones asíncronas pueden aplicar cambios a un documento distinto del que inició la operación; cada cambio del reducer serializa el diseño completo para detectar no-op; y el workflow de deploy construye, pero no ejecuta la suite del configurador. La mantenibilidad también está concentrada en archivos muy grandes: el editor mide 3.862 líneas y su CSS principal 3.601.

Las observaciones siguientes están ordenadas de mayor a menor impacto. “Defecto” indica comportamiento o contrato visible en el código; “riesgo” indica una consecuencia probable que aún requiere medición o una prueba de interacción para cuantificarla.

## Hallazgos priorizados

1. **P1 — Una importación asíncrona puede terminar sobre un documento/contexto distinto.** En [DesignConfiguratorEditor.tsx](../src/features/identity/DesignConfiguratorEditor.tsx#L1398), `importImage` captura lado y superficie, lee el archivo y decodifica la imagen con dos `await`; al terminar modifica el `design` actual sin comprobar que siga siendo el mismo proyecto o que la operación siga vigente. Cambiar de proyecto durante la lectura puede insertar el asset en el proyecto nuevo. El límite de 50 capas también se comprueba solo antes de los `await`, por lo que importaciones concurrentes iniciadas desde la capa 49 pueden excederlo. `selectFont` tiene un patrón parecido: captura lado/superficie/id antes de resolver la fuente y luego puede actualizar una capa con ese id en el documento actual. **Recomendación:** asociar la operación a una revisión/identidad del documento y validar contexto y límite inmediatamente antes del commit; cancelar o descartar resultados obsoletos.

2. **P1 — Los cambios de alta frecuencia serializan el documento completo.** `designReducer` compara `JSON.stringify(present)` con `JSON.stringify(state.present)` en cada acción de cambio, en [design-configurator-model.ts](../src/features/identity/design-configurator-model.ts#L644). El reducer se usa para cambios del editor, incluidos movimientos de capas; los proyectos pueden contener imágenes base64. Esto convierte gestos frecuentes en serialización y asignación de strings proporcionales al tamaño del proyecto, con riesgo de tirones durante drag y de picos de memoria. **Recomendación:** que los comandos no-op devuelvan la misma referencia; reservar la serialización para persistencia, exportación y comparaciones explícitas.

3. **P1 — La suite de regresión no es un gate de CI.** [deploy-hosting.yml](../.github/workflows/deploy-hosting.yml) ejecuta `npm run build`, y [package.json](../package.json) no define un script `test`; `scripts/test-design-configurator.mjs` se ejecuta solo de forma manual. El build sí ejecuta `tsc --noEmit`, pero no el script de pruebas del configurador. Un fallo de importación, historial o geometría puede llegar al deploy sin bloquearlo. **Recomendación:** agregar un comando de test estable y ejecutarlo antes del deploy; idealmente separar lint/typecheck/tests para saber qué gate falló.

4. **P1 — El límite de almacenamiento puede agotarse con proyectos válidos.** Las imágenes se incrustan como data URLs en el diseño; se aceptan archivos de hasta 5 MiB y hasta 50 capas por lado. La recuperación serializa el documento completo a `localStorage`, y el historial conserva hasta 100 snapshots. Un proyecto que respete cada límite individual puede exceder ampliamente la cuota del navegador y generar serializaciones grandes. El guardado local comunica el fallo, pero la arquitectura hace que el límite individual no garantice que un proyecto completo sea guardable. **Recomendación:** definir un presupuesto por documento y separar binarios de los datos serializados, por ejemplo en IndexedDB; medir el uso real antes de fijar cuotas.

5. **P1 — El editor concentra demasiadas responsabilidades.** [DesignConfiguratorEditor.tsx](../src/features/identity/DesignConfiguratorEditor.tsx) tiene 3.862 líneas y 54 apariciones de `useState`/`useEffect` en el archivo. Contiene selección, renombrado, drag/pan, autosave, recuperación, picker y carga de fuentes, importación, galería, fullscreen, exportación, atajos, diálogos y el layout principal. El problema no es solo el número de líneas: operaciones de estado, efectos de navegador y JSX comparten el mismo módulo. **Impacto:** alto acoplamiento, cambios difíciles de revisar y pruebas que requieren montar una superficie enorme. **Recomendación:** extraer por responsabilidad observable (persistencia/proyecto, picker, interacciones del canvas, layout/paneles), con contratos y tests por módulo; no dividir solo por rangos de líneas.

6. **P1 — `LabelLayer` no es una unión discriminada real.** [design-configurator-model.ts](../src/features/identity/design-configurator-model.ts#L67) define `kind: "text" | "circular" | "image"`, pero reúne en un mismo objeto propiedades de todos los tipos (`text`, `radius`, `image`, `imageRatio`, `textEffect`, etc.). TypeScript no impide combinar propiedades incompatibles ni garantiza que una capa de imagen tenga los datos que necesitan el renderer y el exportador. `TextEffectSettings` y `textEffect` también mantienen representaciones paralelas. **Recomendación:** tipos `TextLayer`, `CircularTextLayer` e `ImageLayer` con base compartida, más migraciones/validación en el límite JSON.

7. **P2 — El modelo de dominio mezcla contratos, render math, historial y parsing.** [design-configurator-model.ts](../src/features/identity/design-configurator-model.ts) mide 954 líneas y contiene tipos/defaults, gestión de superficies, geometría de texto circular/cilíndrico, opacidad/blur/shading, reducer de undo/redo, validación de JSON y nombres de archivo. Un cambio de schema queda cerca de cálculos de render e historial sin una frontera clara. **Recomendación:** separar tipos/límites, geometría, historial y codec/migraciones, manteniendo dependencias unidireccionales.

8. **P2 — El exportador también actúa como servicio de fuentes consumido por la UI.** [design-configurator-export.tsx](../src/features/identity/design-configurator-export.tsx) mide 637 líneas y combina generación SVG, filtros, render/descargas, impresión y resolución/carga/cache de fuentes. El editor importa `resolveLabelFont` desde ese archivo. Esto invierte la dirección conceptual: la UI depende de un módulo cuyo dueño aparente es la exportación. **Recomendación:** mover resolución/caché de fuentes a un servicio propio y mantener los exportadores como consumidores.

9. **P2 — Los renderers siguen siendo módulos grandes con muchas decisiones de presentación.** [LabelArtwork.tsx](../src/features/identity/LabelArtwork.tsx) tiene 772 líneas y maneja texto lineal/circular, cilindro, extrusión, filtros, selección, guías e imágenes; [Sleeve3DPreview.tsx](../src/features/identity/Sleeve3DPreview.tsx) tiene 734 líneas y combina geometría Three.js, texturas/capturas, controles de cámara, WebGL, exportación GLB y flujo de compartir/autenticación. Son límites de cambio distintos en un solo componente. **Recomendación:** separar geometría/materiales y export/share del componente de preview, y sub-renderers SVG por tipo solo si mantienen una API pequeña.

10. **P2 — La cascada CSS se ha convertido en una fuente difícil de predecir.** [design-configurator.css](../src/features/identity/design-configurator.css) tiene 3.601 líneas, 641 reglas y 2.165 declaraciones; un análisis PostCSS encontró 27 selectores repetidos dentro del mismo contexto, entre ellos `.dc-artboard .dc-disc` (3 veces) y `.dc-project-bar`, `.dc-layer-list` y `.dc-stage-top` (2 veces cada uno). No hay propiedades duplicadas dentro de una regla de ese archivo, así que no afirmo que cada repetición sea inútil; el problema es que overrides sucesivos hacen difícil localizar la fuente efectiva. El CSS móvil añade 471 líneas y contiene una declaración repetida. **Recomendación:** inventariar las reglas repetidas, consolidar solo duplicados demostrables y agrupar reglas por componente/breakpoint.

11. **P2 — El control `mark` parece modificable pero su dibujo está desactivado.** El editor sigue exponiendo `design.mark` en [DesignConfiguratorEditor.tsx](../src/features/identity/DesignConfiguratorEditor.tsx#L3687), mientras el bloque correspondiente está comentado en [LabelArtwork.tsx](../src/features/identity/LabelArtwork.tsx#L617). Si el toggle sigue visible, el usuario cambia estado sin ver una diferencia en preview/export. **Recomendación:** reactivar y probar el render o retirar/migrar el control y el campo; no mantener una opción aparentemente funcional sin efecto.

12. **P2 — El límite de 50 capas y el tamaño del sleeve están duplicados.** El máximo aparece en el parser y en varios comandos UI (crear, insertar asset e importar imagen), mientras `SLEEVE_SIZE_MM = 315` está definido tanto en el modelo como en `Sleeve3DPreview.tsx`. Una modificación parcial puede hacer que UI, parser o geometría discrepen. **Recomendación:** una fuente única para límites y dimensiones compartidas, importada por validación y presentación.

13. **P2 — Selección activa y multiselección son dos estados que requieren sincronización manual.** El editor mantiene `selected` y `selectedLayers`; el elemento efectivo además usa fallback a `layers[0]` y después a `initialDesign.A[0]`. Hay efectos que limpian multiselección al cambiar lado/elemento. Es posible que esto sea intencional, pero la semántica no está contenida en un único tipo/selector y cuesta razonar sobre selección vacía, borrado y cambios de superficie. **Recomendación:** modelar selección activa y conjunto seleccionado explícitamente, con un único selector que nunca confunda fallback visual con selección real.

14. **P3 — La suite es un script monolítico y reescribe imports para ejecutar módulos.** [test-design-configurator.mjs](../scripts/test-design-configurator.mjs) mide 1.843 líneas y 316 llamadas `assert`. Usa `typescript.transpileModule`, reemplazos de imports y módulos `data:` para montar partes del sistema. Esto valida lógica útil, pero depende de detalles de texto/import y no sustituye tests de React/DOM/Canvas, gestos ni exportaciones en navegador. **Recomendación:** conservar sus pruebas de modelo al migrarlas por grupos a un runner; añadir tests de interacción del canvas y flujos async, y evitar reemplazos de imports como mecanismo de composición.

15. **P3 — Hay duplicación editorial en la documentación de exportación.** [docs/design-configurator.md](design-configurator.md) repite la instrucción de exportar ambos lados y repite/solapa dos párrafos sobre RGB, texto vivo y PSD. No rompe código, pero reduce la confianza en la documentación operativa. **Recomendación:** una sola sección por formato con comportamiento, limitaciones y verificación.

## Métricas de tamaño actuales

| Archivo                          | Líneas | Observación                                   |
| -------------------------------- | -----: | --------------------------------------------- |
| `DesignConfiguratorEditor.tsx`   |  3.862 | Estado, efectos, servicios, handlers y layout |
| `design-configurator.css`        |  3.601 | 641 reglas; overrides repartidos              |
| `design-configurator-mobile.css` |    471 | Hoja responsive separada                      |
| `design-configurator-model.ts`   |    954 | Dominio, geometría, historial y parsing       |
| `LabelArtwork.tsx`               |    772 | Renderer SVG multipropósito                   |
| `Sleeve3DPreview.tsx`            |    734 | Escena, render y compartir modelo             |
| `design-configurator-export.tsx` |    637 | Exportación y servicio de fuentes             |
| `design-configurator-psd.ts`     |    420 | Construcción PSD                              |
| `test-design-configurator.mjs`   |  1.843 | Suite imperativa en un único script           |

## Fuera de alcance y límites de la revisión

No evalué `IdentityFontsPage.tsx` ni su catálogo como producto independiente: son superficies compartidas de Identity, no código exclusivo del configurador. Sí señalé la dependencia directa del editor al resolver fuentes porque afecta la arquitectura del configurador.

La auditoría es estática y no incluye profiling, pruebas de almacenamiento hasta agotar cuota, sesiones simultáneas ni una matriz de navegadores. El rendimiento de drag y los errores de contexto async son riesgos deducidos de las rutas de datos; deben convertirse en pruebas reproducibles antes de asignarles una causa definitiva. Las métricas CSS provienen de PostCSS y distinguen reglas repetidas de declaraciones duplicadas.

## Orden recomendado de trabajo

1. Hacer que tests de regresión y typecheck del configurador bloqueen CI.
2. Añadir pruebas para importación de imagen/fuente con cambio de proyecto durante `await` y para el límite de capas concurrente.
3. Quitar serialización completa del reducer en el hot path de edición.
4. Introducir tipos discriminados y centralizar límites/dimensiones.
5. Extraer responsabilidades del editor, modelo, renderers y exportador en cambios pequeños con comportamiento cubierto.
6. Consolidar CSS y corregir la documentación duplicada después de estabilizar los contratos.
