# Plan de continuidad: assets del Vinyl Designer Configurator

## Solicitud

Incorporar los assets SVG ubicados en `input/` al Vinyl Designer Configurator:

- En el modal **Assets**, mantener los logos de Strange Animals y la opción actual de crear barcode.
- Agregar una carpeta de primer nivel **Hvnter assets**. Al abrirla, mostrar sus subcarpetas y, dentro de cada una, sus SVG.
- Agregar una carpeta **Bitmancer Y2K Assets** que abre directamente la colección SVG de su carpeta raíz.
- Al elegir un SVG, insertarlo en la cara activa del disco como una capa de imagen editable, con nombre y proporción correctos.
- Publicar los archivos en Firebase Storage en la ubicación correspondiente y guardar un manifiesto consultable en Firestore.

## Trabajo de análisis ya hecho

- Revisé `input/by Hvnter/` y `input/by Bitmancer/`.
- Hay 620 SVG en total, aproximadamente 3,86 MiB: 459 de Hvnter y 161 de Bitmancer.
- Hvnter contiene siete carpetas visibles con SVG:
  - `CORPORATE ASSET PACK (Vol.1)`
  - `Label Asset Pack (vol.1)`
  - `PEOPLE (VOL.1)`
  - `Y2K Logo Pack/COLOURED LOGOS`
  - `Y2K Logo Pack/LOGOS`
  - `Y2K Logo Pack/STARS`
  - `Y2K Shapes Pack`
- Bitmancer tiene `Y2K_24_IconSet/`; la UI debe presentar esa colección directamente bajo **Bitmancer Y2K Assets**, sin pedir otra navegación de carpeta.
- En la carpeta de fuentes de Hvnter hay subcarpetas técnicas llamadas `SVG`; no mostrarlas como nivel de navegación. Las carpetas de subcolección son las carpetas visibles indicadas arriba.
- El acceso de Firebase CLI expiró, pero `gcloud` tiene sesión activa.
- Firestore es `FIRESTORE_NATIVE`, base `(default)`, región `europe-west3`.
- Firestore ya tiene colección pública `/images`, usada por el sitio para medios. Las reglas actuales permiten lectura y deniegan escritura cliente; no abrir permisos para resolver esta tarea.
- Los documentos de `/images` usan campos como `id`, `title`, `label`, `contentType`, `enabled`, `storagePath` y `updatedAt`. Los ids existentes son `basketball-hoop`, `cd`, `cherry`, `coin`, `logo`, `og` y `tade`.
- El prefijo propuesto para los objetos nuevos, `media/public/design-configurator-assets/`, estaba vacío al revisarlo.
- Los logos actuales se cargan desde `src/features/identity/asset-library.ts`. `AssetLibrary.tsx` presenta logos y barcode.
- `DesignConfiguratorEditor.insertAsset` convierte la selección en una capa de imagen incrustada en el proyecto. `parseDesign` permite PNG/JPEG/WebP y debe admitir SVG embebido de manera acotada.
- Se creó `scripts/sync-design-configurator-assets.mjs`. `node scripts/sync-design-configurator-assets.mjs --dry-run` procesó los 620 SVG, saneó la estructura, imprimió el árbol esperado y confirmó que no escribió en Firebase.
- Carga completada: Storage contiene 620 SVG bajo `media/public/design-configurator-assets/` y Firestore contiene 620 documentos `images` marcados `assetType: "designConfigurator"` (459 Hvnter, 161 Bitmancer).
- Las URLs de descarga Firebase fueron verificadas con HTTP 200 y MIME `image/svg+xml`.
- La navegación se probó en navegador: Hvnter muestra sus carpetas/subcarpetas; Bitmancer abre directamente los iconos. Seleccionar `Asset (1)` y `y2k-24_icon_00` insertó un `<image>` SVG embebido en el disco. La clave de recuperación original se restauró después de cada prueba.

## Diseño de datos y Storage

Decisión propuesta, compatible con el esquema actual:

- Firestore: reutilizar `/images` y distinguir estos registros con `assetType: "designConfigurator"`.
- Storage: `media/public/design-configurator-assets/{hvnter|bitmancer}/{subcarpetas}/{id}.svg`.
- Generar ids deterministas con SHA-256 de la marca y la ruta relativa de origen, para poder detectar duplicados y repetir diagnósticos.
- Guardar en Firestore el nombre, nombre de origen, grupo, ruta de carpeta, ruta de origen, `storagePath`, URL de descarga, tipo MIME, ratio, estado habilitado y fecha de actualización.
- Crear los objetos públicos con MIME `image/svg+xml` y metadata de token Firebase, de modo que la app pueda obtener URLs sin cambiar las reglas de Storage.
- Conservar `/images` en modo lectura pública existente. La escritura administrativa se hace fuera del SDK cliente usando la sesión de `gcloud` con permisos IAM.
- No sobreescribir: el script debe abortar si encuentra un id Firestore repetido o algún objeto en el prefijo Storage antes de subir.
- Si falla la carga, retirar únicamente los objetos/documentos creados por esa ejecución. No borrar medios existentes.

## Implementación realizada

- `design-configurator-asset-repository.ts` consulta la colección `/images` por `assetType` y valida manifiestos.
- `asset-library.ts` convierte SVG a data URI portable y elimina contenido activo y recursos CSS externos/relativos.
- `parseDesign` acepta SVG base64 limitado por el máximo existente de tamaño; la prueba del configurador cubre aceptación y rechazo de SVG no embebido.
- `AssetLibrary.tsx` presenta Hvnter por carpetas y Bitmancer directamente, con paginación y estados de carga/error/reintento; conserva logos y barcode.
- `scripts/sync-design-configurator-assets.mjs --upload` subió los objetos y manifiestos. El script valida destinos, ids y SVG, y limpia los objetos de la ejecución si falla Firestore.
- `docs/design-configurator.md` describe la biblioteca SVG.

## Verificación

- Pasaron `node scripts/sync-design-configurator-assets.mjs --dry-run`, `node scripts/test-design-configurator.mjs`, `npm run typecheck` y `npm run build`.
- Firestore verificado con paginación: 620 manifiestos (459 + 161); Storage verificado: 620 objetos; una descarga de muestra respondió HTTP 200.
- Navegador verificado para navegación e inserción en la cara activa de un SVG de cada marca.
- Pendiente si se requiere cobertura adicional: exportar un proyecto con assets SVG a PNG/PDF/PSD y comprobar visualmente que cada impresora conserve la composición.

## Estado del workspace

Esta nota no autoriza a revertir cambios ajenos. Al empezar la continuación, `git status --short` mostró modificaciones en `.gitignore`, documentación, archivos de la implementación 3D y sus pruebas, además de archivos nuevos relacionados con el configurador. Revisar el estado actual antes de cada edición.
