# Auditoría de calidad — Vinyl Artwork Designer Pro

Actualizada: **2026-10-28**. Reemplaza la revisión del 2026-10-26.

Alcance: editor, modelo, controles, render SVG/Three.js, exportadores, galería, publicación de modelos, repositorios, Rules, Functions y pruebas asociadas. La colección de tipografías como producto queda fuera de alcance; sí se revisan sus contratos consumidos por el editor.

La revisión inicial fue documental. **A01 y el runner/gate de regresión de A06 ya se implementaron localmente el 2026-10-28**; el resto conserva su estado indicado. No se migraron operaciones ni se inspeccionaron documentos de producción, permisos IAM desplegados o métricas de uso/coste.

Plan de backend: [Migración a Cloud Functions y trabajos de render](vinyl-designer-backend-migration.md).

## Resumen ejecutivo

1. El guardado/versionado, renombrado y borrado de proyectos y la publicación de GLB siguen ejecutándose desde el SDK del navegador.
2. Eso **no demuestra una vulnerabilidad**: Firestore/Storage aplican Rules en el servidor. La razón principal para centralizar estos flujos es validar contratos complejos, garantizar autorización por operación y hacer recuperación/reintentos independientes de una pestaña.
3. Existe infraestructura Functions en [functions/src/index.ts](../functions/src/index.ts), pero solo exporta `health`, privada; no contiene lógica del configurador. Usa Node 22, región `europe-west3` y `maxInstances: 10`.
4. Se corrigió el falso gate: build y CI ahora verifican explícitamente app y configuración Node. Los errores detectados por el chequeo real se corrigieron; A01 incluye la prueba de cobertura/fallo.
5. El editor creció a 4.146 líneas. Persisten riesgos async, serialización completa en el reducer y binarios embebidos. Hay mejoras reales: renderer compartido Cookie/Sleeve y módulos específicos de geometría, menús y controles.

“Confirmado” indica evidencia directa de código/comando; “riesgo” no equivale a fallo reproducido en navegador. Prioridades: P0 gate engañoso; P1 integridad/fiabilidad; P2 arquitectura/rendimiento; P3 higiene.

## Hallazgos priorizados

### A01 · P0 · El typecheck del build daba una falsa señal de cobertura — resuelto localmente

[package.json](../package.json) usaba `tsc --noEmit && vite build`. [tsconfig.json](../tsconfig.json) tiene `files: []` y referencias; el comando raíz directo produjo **0 líneas**. Las referencias no hacen que ese comando analice automáticamente los proyectos referenciados: debe usarse `npm run typecheck`, no ese atajo raíz.

El chequeo explícito inicial fallaba tanto dentro como fuera del configurador. Se corrigieron imports/identificadores, narrowing de archivos/modelos, contrato de textTextureScale, flags opcionales y tipos de eventos de drag; se quitaron casts DOM→SVG innecesarios. Se declararon dependencias reales de tipos `@types/three@0.171.0` y `@types/matter-js@0.20.2`, se completó el contrato local de Webamp contra su método existente y se corrigieron claves del verificador de releases. No se añadieron `any`, `ts-ignore` ni exclusiones para ocultar errores.

**Implementado:** `typecheck:app` usa tsconfig.app.json; `typecheck:node` usa tsconfig.node.json con target/lib ES2022. `npm run build` exige `npm run typecheck` antes de Vite. `npm run test:typecheck` comprueba que se incluyan el editor y vite.config.ts y que una fuente temporal con error TS2322 haga fallar el comando real. El workflow ejecuta esa prueba antes del build. La ejecución remota de GitHub Actions queda pendiente del próximo push; no se desplegó nada en esta tarea.

### A02 · P1 · La edición numérica tiene código inalcanzable — confirmado

[TypographyValueControl.tsx](../src/features/identity/TypographyValueControl.tsx), `onChange`: llama a `change(event.target.value)` y retorna antes de `setInputDraft`. Mientras hay foco, el valor mostrado depende de `inputDraft`; al perderlo se vuelve a aplicar ese draft.

**Consecuencia deducida:** la edición puede mostrar el valor anterior y restaurarlo en blur. Falta una prueba DOM que lo reproduzca.

**Tarea:** un único flujo de draft/validación/commit, con tests de negativos, decimales, vacío transitorio, Enter, blur y undo. No se corrigió en esta auditoría.

### A03 · P1 · Operaciones async sin identidad de documento — riesgo vigente

[DesignConfiguratorEditor.tsx](../src/features/identity/DesignConfiguratorEditor.tsx), `importImage` y `selectFont`, conservan lado/superficie/id, pero no una identidad/revisión del proyecto que invalide el resultado después de un `await`. La importación comprueba el límite de 50 antes de leer/decodificar, no otra vez dentro del commit.

**Tarea:** token de documento/operación, cancelación o descarte obsoleto y límite validado al insertar. Probar cambiar de proyecto durante lectura/carga y dos importaciones concurrentes desde 49 capas. Migrar persistencia al servidor no arregla este estado local.

### A04 · P1 · Borrado distribuido dependiente del navegador — confirmado

[design-gallery-repository.ts](../src/features/identity/design-gallery-repository.ts), `deleteGalleryProject`:

- Lee proyecto e historial; rechaza más de 450 versiones.
- Borra metadatos en una transacción y compara `latestVersionId` para detectar un guardado concurrente.
- Después borra secuencialmente hasta seis archivos conocidos por versión.
- Devuelve el número de archivos cuya limpieza falló, pero no guarda un job durable de reintento.

La transacción protege la eliminación de esos documentos, **no incluye Storage**. Cerrar la pestaña tras el commit puede dejar archivos sin metadatos. Las Rules permiten al dueño borrar versiones sueltas; no fuerzan el workflow completo de la UI.

**Tarea prioritaria de backend:** job idempotente de eliminación, estado `deleting`, bloqueo de nuevos commits y limpieza paginada con reanudación. Mantener separados los modelos públicos compartidos salvo decisión explícita. Ver B03 del plan.

### A05 · P1 · Guardado/publicación cruzan servicios sin commit conjunto — confirmado

`saveGalleryVersion` sube JSON y cuatro PNG, y luego realiza la transacción de proyecto/versión. Tiene control de versión concurrente y limpieza best-effort si falla; eso es una protección existente, no ausencia de control. El `Promise.all` de subidas puede fallar antes de que terminen otras subidas: la limpieza puede competir con ellas.

[model-share-repository.ts](../src/features/ar-model/model-share-repository.ts), `createModelShare`, sube/sustituye el GLB y después escribe el documento público. Conserva ID/path/createdAt y no borra un binario existente cuando falla su actualización de metadatos. Sigue habiendo estados parciales y last-writer-wins entre publicaciones concurrentes.

**Tarea:** staging privado, idempotency key, objetos inmutables por generación y un puntero publicado solo al finalizar. No afirmar que una transacción Firestore hace atómico un upload a Storage.

### A06 · P1 · Suite de regresión y CI — gate local implementado; cobertura de navegador pendiente

[deploy-hosting.yml](../.github/workflows/deploy-hosting.yml) construye y despliega Hosting. Tras A01 ejecuta la prueba del gate TypeScript, pero todavía no la suite de regresión ni lint, ni despliega Functions/Rules. No hay comando agregador `test` para esa suite en package.json.

En esta revisión se ejecutaron **18 scripts locales: 17 pasan y 1 falla**. `test-configurator-preview-auth.mjs` falla al resolver `./color-swatch-capacity` desde un módulo `data:`. Es un problema del harness de imports, no prueba de un fallo de autenticación real.

**Implementado el 2026-10-28:** se reparó el harness de `test-configurator-preview-auth.mjs`, resolviendo su dependencia real `color-swatch-capacity.ts` antes de importar el módulo transpileado. No se sustituyó esa lógica por un mock. `npm test` / `npm run test:configurator` ejecutan un runner explícito de 22 scripts, aislados por proceso, con timeout y salida no cero si cualquiera falla. Los 22 pasan localmente. El workflow de Hosting ejecuta esta suite antes del build y antes de autenticarse para desplegar.

**Pendiente:** verificar la ejecución remota tras push, añadir pruebas reales de navegador, establecer el gate de lint y separar pipelines frontend/backend con pruebas de contratos/Rules. Esta suite usa pruebas puras, mocks y verificaciones estructurales; no demuestra cobertura visual ni sustituye emuladores. No se desplegó nada durante esta sesión.

### A07 · P1 · Hot path serializa el diseño completo — confirmado; impacto sin medir

[design-configurator-model.ts](../src/features/identity/design-configurator-model.ts), `designReducer`, compara dos `JSON.stringify` en cada cambio. Historial: hasta 100 snapshots. El editor serializa además para recovery/dirty/save y guarda recuperación en localStorage.

Las imágenes pueden ser data URLs de hasta 5 MiB por archivo; el límite por archivo/capa no es un presupuesto de documento. Los snapshots pueden compartir referencias: **no se midió ni se afirma que cada uno duplique todos los binarios**; sí hay serializaciones completas repetidas.

**Tarea:** no-op por referencia, revisión del documento, assets separados/IndexedDB, cuota por proyecto y mediciones reales de memoria/drag.

### A08 · P1 · El documento de diseño no tiene validación autoritativa de contenido en backend — confirmado

Las Rules validan metadatos, identidad/path, MIME y tamaño de objetos; no interpretan el JSON completo ni verifican que el GLB corresponda al proyecto. `parseDesign` y la sanitización SVG se ejecutan en código cliente que puede omitirse desde otro cliente.

No se demostró explotación. **Tarea:** validar en backend schema/migraciones, límites globales y recursos; verificar archivos por contenido, no solo extensión/MIME; decidir si los artefactos publicados se aceptan del cliente o se regeneran desde fuentes canónicas. Autorizar explícitamente la relación uid→project→version→share.

### A09 · P2 · Miniaturas GLB: coste repetido e invalidación incompleta — confirmado

[SharedModelThumbnail.tsx](../src/features/identity/SharedModelThumbnail.tsx) usa IntersectionObserver. [shared-model-thumbnail.ts](../src/features/identity/shared-model-thumbnail.ts) descarga GLB, crea un renderer WebGL y produce PNG 256×256; limita concurrencia a uno, libera recursos y cachea hasta 80 promesas por URL.

No hay miniatura persistida en Firestore/Storage. Si se sustituye el GLB conservando URL, la captura puede quedar obsoleta durante la sesión. Una nueva sesión vuelve a descargar modelos enteros para producir imágenes pequeñas.

**Tarea:** PNG/WebP persistido por generación/hash, backfill de modelos existentes y caché invalidada por versión de artefacto. Añadir límites de triángulos/texturas y cancelación de trabajos fuera de vista. Ver B06.

### A10 · P2 · Responsabilidades y tipos aún muy acoplados — vigente

- Editor: selección, drag/pan, proyectos, async, fuentes, export, menús, layout y diálogos.
- Modelo: tipos/defaults, cuatro grupos de capas, render math, historial y parsing.
- `LabelLayer` sigue siendo un objeto con `kind` y campos de texto/arco/imagen, no una unión discriminada real.
- `textEffect` y `textEffectSettings` son representaciones relacionadas que requieren reglas claras.
- UI importa `resolveLabelFont` desde el exportador.
- Selección activa y multiselección siguen en estados separados, con fallbacks visuales.
- Límite 50 sigue repetido en parser y comandos, incluida copia al otro lado.

**Tarea:** extraer contratos puros compartibles con backend, codec estricto/migraciones, límites únicos, servicio de fuentes y comandos de selección/interacción. No hacer una división solo por tamaño de archivos.

### A11 · P2 · Cascada CSS y falta de cobertura visual — vigente

PostCSS: 676 reglas/2.335 declaraciones en CSS principal; 29 claves selector+contexto repetidas, 0 declaraciones duplicadas dentro de una misma regla. CSS móvil: 80 reglas/278 declaraciones, 1 selector repetido y 0 declaraciones duplicadas. Una repetición no demuestra por sí sola CSS eliminable.

El crecimiento de controles y overrides requiere consolidación por componente y pruebas claro/oscuro, escritorio/móvil, foco/teclado y reduced-motion. Los tests actuales parsean CSS o comparan texto, no prueban toda la cascada en navegador.

### A12 · P2 · Opción mark sin render y capacidad solo ocultada en UI — confirmado

El editor expone `design.mark`, pero el bloque de dibujo en [LabelArtwork.tsx](../src/features/identity/LabelArtwork.tsx) continúa comentado. Retirar el control/campo con migración o restituir el dibujo probado.

Cylinder está oculto para Arc text mediante `allowCylinder`, pero parser y renderer aún aceptan cilindros circulares. **No es una brecha de autorización**; sí un contrato de capacidades por decidir para JSON antiguos/importados y futura validación de backend. No eliminar silenciosamente efectos guardados sin política de migración.

### A13 · P3 · Documentación de exportación duplicada — vigente

[design-configurator.md](design-configurator.md) repite “SVG/PNG can export both sides…” y párrafos RGB/live text/PSD. Consolidar y verificar cada formato. La presente tarea no cambió ese documento operativo.

## Correcciones respecto de la revisión anterior

| Hallazgo anterior | Estado verificado al 28/10 |
| --- | --- |
| Importación async/contexto y límites | Sigue abierto: A03 |
| Stringify del reducer y memoria | Sigue abierto: A07 |
| CI | Sigue abierto y se añade el falso gate de TypeScript: A01/A06 |
| Editor/modelo/tipos/selección/fuentes | Sigue abierto: A10 |
| Tamaño y responsabilidades de renderers | Parcial: geometría en `sleeve-shell.ts`, `cookie-core-geometry.ts`, `pressing-rings.ts`; preview aún monta escena, texturas, export y share |
| Sleeve vs Cookie | Ahora usan `LabelArtwork` compartido en canvas y export de Sleeve; se eliminó el bucle de texto duplicado del exportador |
| SLEEVE_SIZE_MM duplicado | Corregido en preview: importa la constante del modelo. El límite 50 no está centralizado |
| mark y duplicación editorial | Siguen abiertos: A12/A13 |
| CSS móvil con declaración duplicada | La medición actual no detecta declaraciones duplicadas; actualizar cifras, no repetir el dato antiguo |

## Métricas del árbol revisado

Líneas físicas, no medida automática de calidad:

| Archivo | Líneas |
| --- | ---: |
| DesignConfiguratorEditor.tsx | 4.146 |
| design-configurator.css | 3.809 |
| design-configurator-mobile.css | 553 |
| design-configurator-model.ts | 954 |
| LabelArtwork.tsx | 766 |
| Sleeve3DPreview.tsx | 686 |
| design-configurator-export.tsx | 509 |
| design-configurator-psd.ts | 420 |
| MyGalleryPage.tsx | 653 |
| design-gallery-repository.ts | 405 |
| scripts/test-design-configurator.mjs | 1.848 |

Editor: 58 apariciones de useState/useEffect. Script principal: 320 llamadas assert. Estos conteos no representan cobertura de comportamiento.

## Verificación de la revisión inicial

- Lectura del código citado, Rules y configuración de Functions/CI.
- `npx tsc --noEmit --listFiles`: 0 archivos listados.
- `npx tsc --noEmit -p tsconfig.app.json --pretty false`: falla; ejemplos en A01.
- Scripts que pasaron: design-configurator, configurator-assets, surface-rendering, sleeve-shell, text-effect-controls, pressing-rings, pressing-picker, versioned-model-share, model-share-flow, model-thumbnails, layer-context-menu, gallery-navigation, font-picker, font-picker-panel, font-picker-reveal, font-picker-catalog, configurator-theme (todos con prefijo `scripts/test-` y extensión `.mjs`).
- Script que falló al arrancar: `scripts/test-configurator-preview-auth.mjs`.
- `test-design-gallery-rules.mjs` requiere emuladores y **no se reejecutó en esta auditoría**; sus resultados de sesiones anteriores no se presentan como verificación nueva.
- No se ejecutaron profiling, matriz de navegadores, pruebas visuales ni pentest. Tampoco se desplegó ningún cambio.

## Orden recomendado

1. A01 y el runner/gate de regresión de A06 completados localmente. Quedan navegador, lint y verificación remota de CI en A06.
2. Cubrir y corregir el draft numérico y las operaciones async obsoletas.
3. Introducir contratos/asset manifest e idempotencia; migrar borrado, guardado y publicación según el [plan de backend](vinyl-designer-backend-migration.md).
4. Persistir miniaturas y medir/pilotear render autoritativo de GLB.
5. Refactorizar reducer, assets locales, tipos/servicios y CSS con regresión cubierta.

El plan no exige mover el canvas, undo/redo o cada lectura a una Function: conservar interacción local y lecturas autorizadas evita latencia sin debilitar el control del backend.

## Verificación de A01 — 2026-10-28

- `npm run typecheck`: pasa para app y configuración Node.
- `node scripts/test-typecheck-gate.mjs`: pasa; incluye fuentes reales y confirma rechazo del error deliberado TS2322. La fixture se genera fuera del worktree y se limpia al terminar.
- 21 scripts de regresión pasan: los 17 positivos de la revisión inicial, más layer-panel-order, multi-font-selection, font-toolbar-casing y font-catalog-visibility.
- `test-configurator-preview-auth.mjs` sigue fuera de estos resultados; su harness corresponde a A06, no se presenta como arreglado por A01.
- `npm run build`: pasa ejecutando primero el typecheck real de app/Node y luego Vite. Conserva avisos existentes de fuentes estáticas no resueltas y bundles grandes; no se añadieron excepciones para ignorarlos. No se ejecutó deploy ni se cambiaron Rules.
