# Plan de migración — Backend del Vinyl Artwork Designer Pro

Fecha: **2026-10-28**. Estado: **B03 implementado y B04 parcial; resto según checklist**.

Complementa la [auditoría de código](vinyl-designer-configurator-code-audit.md). La implementación de borrado durable y renombrado, sus pruebas y rollout se detallan en [operaciones backend](vinyl-designer-backend-operations.md).

## 1. Objetivo y frontera de confianza

Centralizar las operaciones autoritativas: confirmar versiones, modificar metadatos, borrar proyectos/archivos y publicar derivados. Conservar interacción y preview inmediato en el navegador.

**Importante:** el SDK web de Firebase no da acceso administrativo por estar en el frontend. Sus peticiones pasan por Auth y Security Rules. Cambiar a Admin SDK elimina ese control de Rules para esas operaciones: las Functions tendrán que verificar identidad, propiedad, schema y cuotas explícitamente. Migrar código sin esas comprobaciones puede empeorar la seguridad. [Modelo de seguridad de Firestore](https://firebase.google.com/docs/firestore/security/overview), [condiciones y bypass de librerías servidor](https://firebase.google.com/docs/firestore/security/rules-conditions).

La prioridad no es “ocultar funciones JavaScript”: es que un cliente modificado no pueda saltarse el protocolo y que cerrar una pestaña no deje trabajos a medias.

## 2. Inventario verificado: qué ocurre hoy

| Operación | Implementación actual | Destino recomendado |
| --- | --- | --- |
| Editar texto/capas, duplicar/copiar A/B, selección, undo/redo | Editor + modelo en navegador | Mantener local; validar snapshot cuando se guarda |
| Recuperación local / importar JSON | localStorage, FileReader, parseDesign | Mantener local; assets en IndexedDB y validación repetida en servidor |
| Resolver/cargar fuentes | design-configurator-export.tsx + catálogo | Preview local; resolver recursos permitidos en worker para derivados oficiales |
| SVG, rasterizaciones PNG y composición Sleeve/Cookie | LabelArtwork + DOMParser/Canvas/Image | Mantener preview; generación oficial en worker compartiendo contratos |
| Preparar y subir JSON + cuatro PNG | Editor + saveGalleryVersion, SDK Storage | Sesión de subida privada; servidor valida/finaliza |
| Asignar número de versión y escribir proyecto/historial | runTransaction en design-gallery-repository.ts | Function transaccional e idempotente |
| Renombrar | renameGalleryProject → renameDesignProject callable | Implementado; CAS de título |
| Borrar proyecto e historial, luego archivos | requestProjectDeletion + scheduler y trigger Storage | Implementado; job durable |
| Leer galería/versiones/modelos propios | getDocs/getDoc web | Puede seguir directo con Rules y paginación |
| Escena Three.js y cámara interactiva | Sleeve3DPreview.tsx | Mantener local |
| Exportar GLB compartido | GLTFExporter sobre la escena del preview | Worker de generación/validación; no una simple mudanza de imports |
| Publicar/reemplazar GLB y documento público | createModelShare, Storage + setDoc web | Finalizador de publicación, ID público estable y generaciones inmutables |
| Miniaturas de modelos | GLTFLoader + WebGL offscreen local, PNG 256×256 en memoria | Generar y persistir una vez por generación |
| Descargar SVG/PNG/PDF/PSD para uso local | Exportadores del navegador | Puede seguir local; generación remota opcional por coste/calidad |

Infraestructura actual: `functions/src/index.ts` exporta `health`, dos callables de galería, un scheduler durable y un trigger de uploads tardíos. Node 22, región `europe-west3`; App Check aún pendiente. Functions, web y Rules activadas en producción; ver [estado real de despliegue e IAM](vinyl-designer-backend-operations.md#estado-real-de-despliegue).

Rutas actuales:

- Firestore privado: `designUsers/{uid}/projects/{projectId}/versions/{versionId}` y documento padre.
- Storage privado: `media/private/design-gallery/{uid}/{projectId}/{versionId}/...`.
- Registro público: `sharedModels/{modelId}`.
- GLB público: `media/public/shared-models/{uid}/{modelId}/{fileName}`.
- Versiones guardadas usan su UUID como `modelId`; drafts no guardados usan otro UUID en memoria. Mantener el enlace público estable aunque cambie su generación de artefactos.

## 3. Arquitectura objetivo

### Flujo de guardado / publicación

1. Cliente solicita una operación con `operationId`, proyecto/versión esperada y manifiesto pequeño.
2. Callable identifica al usuario desde Auth, comprueba propiedad/estado/cuota y reserva una sesión de subida privada.
3. Cliente sube assets a paths de staging autorizados; no manda GLB ni base64 gigante dentro del callable.
4. Finalizador comprueba objetos reales, generaciones, hashes, tamaños y schema; crea el snapshot validado y/o encola derivados.
5. Worker procesa el snapshot exacto, persiste resultados y confirma estado. La publicación cambia el puntero a una generación completa solo después de tener todos los objetos requeridos.
6. Cliente observa estado autorizado del job y muestra progreso por etapa; no confundir porcentaje de upload con porcentaje real de render.

Las callables adjuntan tokens de Auth/App Check cuando están disponibles; aun así la función debe exigir Auth y validar la operación. [Callables](https://firebase.google.com/docs/functions/callable).

### Contratos nuevos propuestos, no existentes

- `designOperations/{uid}/jobs/{operationId}`: operación, estado, referencias internas, timestamps, intentos, error público acotado, progreso por etapa, lease/revisión. Lectura solo del dueño; escrituras solo backend.
- `designUploadSessions/{sessionId}`: dueño, operación, paths exactos, límite de bytes, caducidad y objetos/generaciones aceptados. No aceptar un prefijo arbitrario del cliente.
- Versiones: estado y `sourceHash`, `schemaVersion`, `rendererVersion`; conservar compatibilidad con versiones existentes y su numeración.
- Shares: ID estable; referencia a `artifactGeneration`, GLB y `thumbnailPath`, fecha de actualización y checksum. Separar datos públicos de estado/errores privados.

No adoptar estas rutas sin definir validadores, índices, Rules y migraciones. Campos públicos solo si son necesarios para la vista compartida.

### Separación del render

Un paquete compartido debe contener tipos, unidades, defaults, límites, geometría y migraciones **sin Firebase, React ni DOM**. El renderer oficial consume una especificación validada, no ejecuta JavaScript/HTML/SVG arbitrario enviado por el cliente.

El preview interactivo sigue en el navegador. Para GLB y capturas oficiales hay dos opciones a evaluar:

- Generación Node con geometría pura y adaptadores de imágenes/texturas/exportación.
- Worker de navegador headless con versión fija del renderer para máxima paridad inicial. Cloud Run documenta ejecución de Chrome headless/capturas; elegirlo si el prototipo muestra que las dependencias o el coste no encajan en una Function. No se presupone GPU ni soporte WebGL suficiente sin probarlo. [Automatización de navegador en Cloud Run](https://docs.cloud.google.com/run/docs/browser-automation).

Cloud Functions puede mantener la API y la orquestación en ambos casos. No bloquear la primera migración CRUD esperando resolver todo el render 3D.

## 4. Backlog ejecutable

### B00 · P0 · Contratos, tests y base de despliegue

- [x] Reparar el gate TypeScript (A01, 2026-10-28): app y Vite config explícitos, errores actuales corregidos, prueba negativa y gate de CI configurado.
- [x] Reparar la prueba `test-configurator-preview-auth.mjs` (A06); integrada en el runner de regresión y gate de Hosting.
- [ ] Extraer schema/migraciones y límites: grupos Cookie/Sleeve A/B, máximo por grupo/documento, bytes, dimensiones/píxeles, texto, segmentos y recursos de fuentes.
- [ ] Separar validación estricta de normalización permisiva del importador: el servidor no debe convertir silenciosamente un payload inválido en “válido”.
- [ ] Definir `operationId`, revisión esperada y hash canónico de diseño+assets+configuración de render. Preset de pressing está hoy fuera del JSON del diseño: incluirlo explícitamente.
- [ ] Definir matriz de roles/ownership y endpoints permitidos para drafts, versiones guardadas y GLB importados desde la página AR.
- [ ] Añadir CI del codebase Functions: build/lint/tests, emuladores y contratos cliente-servidor. El workflow actual despliega solo Hosting.

**Terminado cuando:** mismo input y assets identificados producen la misma identidad de fuente; peticiones duplicadas no crean versiones extra y un error de tipos detiene CI.

### B01 · P1 · Callables y seguridad transversal

- [x] Inicializar cliente Functions desde `accountAuth.app` y región correcta para borrado/rename; no confundir esa cuenta con el gate de Identity.
- [ ] Exigir `request.auth`; UID derivado del token, nunca confiar en `uid`, owner, path, número de versión ni título sin validar.
- [ ] Comprobar pertenencia del proyecto y de su versión, no solo que el modelo tenga formato UUID.
- [ ] Activar App Check por etapas, con métricas y configuración de desarrollo; después enforcement. No considerarlo sustituto de Auth/ownership ni de cuotas. [Enforcement App Check](https://firebase.google.com/docs/app-check/cloud-functions).
- [x] Cuenta dedicada para galería con roles custom de datos Firestore en `(default)`, limpieza del prefijo privado y recepción de eventos. Sin credenciales en frontend ni archivos de claves nuevos.
- [ ] Separar permisos del futuro worker de render de la API CRUD; revisar el alcance de Admin SDK por colección (IAM no aplica Security Rules).
- [ ] Cuotas por usuario/operación: bytes, almacenamiento total, jobs simultáneos, frecuencia y coste. `maxInstances` limita escala global, no es cuota por usuario ni garantía de presupuesto.
- [ ] Errores estructurados y logs con operationId; no registrar tokens, JSON privado, data URLs ni URLs de descarga con token.

**Terminado cuando:** pruebas directas al endpoint rechazan sesión ausente, usuario ajeno, schema incorrecto, IDs inventados, cuota excedida y App Check inválido cuando se exija.

### B02 · P1 · Guardar versiones desde backend

Callables propuestas: `beginDesignSave` y `finalizeDesignSave`.

- [ ] Sustituir `saveGalleryVersion` por adaptador de API, conservando upload con progreso.
- [ ] Reservar staging privado por operación, con manifiesto exacto y caducidad; congelar/identificar la generación aceptada para evitar sustitución después de validar.
- [ ] Verificar existencia/contenido real de JSON/assets. MIME/extensión no validan PNG/SVG/GLB.
- [ ] Asignar versión en transacción y comprobar revisión/estado del proyecto; definir cuándo pasa a visible como lista para editar.
- [ ] Idempotencia: reintento de la misma operación devuelve mismo proyecto/versión. Resolver el caso “commit exitoso, respuesta perdida”.
- [x] Esperar que terminen todas las subidas del guardado antes de limpiar un fallo (A05, corrección local con regresión).
- [ ] Registrar cleanup durable y garantizar aislamiento de assets por operación en el protocolo backend. La corrección local anterior no sobrevive al cierre de la pestaña.
- [ ] Bloquear commits sobre proyectos `deleting`/borrados. No recrear un proyecto eliminado por un guardado tardío.
- [ ] UI de estados y recuperación al recargar, sin depender de que siga montado el editor que inició la operación.

**Terminado cuando:** dos pestañas, doble clic, cierre durante upload y respuesta perdida no duplican versiones ni dejan una versión visible apuntando a archivos incompletos.

### B03 · P1 · Eliminar proyectos con job reanudable — primera operación compleja a migrar

Callable propuesta: `requestProjectDeletion`; tarea privada: `deleteProjectArtifacts`.

- [x] Mantener confirmación en UI; servidor valida owner y marca `deleting` transaccionalmente, comprobando versión esperada.
- [x] Enumerar versiones y archivos por páginas del prefijo privado derivado; eliminar únicamente ese proyecto.
- [x] Reintentos idempotentes: objeto/documento ausente cuenta como progreso.
- [x] Persistir fase/lease/contadores y reanudar por primeras páginas restantes, sin límite de 450 versiones. Los contadores son operativos, no contabilidad exacta ante crash entre servicios.
- [x] Tombstone mínimo permanente (`status`, `deletedAt`) impide reutilizar el UUID. Título y metadata anterior eliminados.
- [x] UI observa eliminación y ofrece reintento; no anuncia éxito completo mientras queda limpieza.
- [x] Conservar modelos públicos compartidos; no se revocan sus enlaces.
- [x] Trigger por generación limpia uploads aceptados antes del lock que terminan después del borrado.
- [ ] Si se quiere revocación futura, crear operación explícita con política para cachés, tokens y objetos públicos; no prometer borrar copias ya descargadas.

**Terminado cuando:** cerrar la pestaña no frena la eliminación; pruebas con más de 450 versiones, archivos faltantes, error transitorio, llamadas duplicadas y guardado concurrente terminan de forma consistente.

### B04 · P1 · Renombrado y concurrencia de metadatos

Callable propuesta: `renameDesignProject`.

- [x] Callable owner-only, payload estricto, nombre no vacío ≤120 caracteres y CAS `expectedTitle`.
- [x] Cambiar solo título/updatedAt, sin tocar numeración/versiones; rechazar proyectos bloqueados.
- [x] Cliente actual envía título base al guardar; transacción detecta rename durante el save. Un editor desactualizado muestra conflicto y pide recargar.
- [x] Mantener edición inline y rollback visual ante error.
- [ ] Revisión monotónica/opId para resolver ABA y respuesta perdida; protocolo autoritativo de save B02 para clientes antiguos/modificados. CAS por título protege clientes actuales, no sustituye B02.

**Terminado cuando:** un save de una pestaña antigua no sobrescribe silenciosamente un rename posterior.

### B05 · P1 · Publicación 3D autoritativa y reemplazo seguro

Callables propuestas: `requestModelPublication` / `finalizeModelPublication`.

- [ ] Mantener UUID público por versión y URL estable; usar binarios inmutables por generación y swap de puntero después de validar.
- [ ] Bloquear clientes para escribir directamente el objeto publicado o el documento final una vez migrado el flujo.
- [ ] Autorización de share para versión propia, draft propio o import GLB permitido. No resolver propiedad solo por un ID del cliente.
- [ ] Hash/revisión impide que un worker antiguo publique sobre una generación más nueva. Aplicar CAS/lease y tratar duplicados.
- [ ] Resolver explícitamente cambios no guardados: crear snapshot privado de publicación o exigir guardar primero. No generar desde una versión vieja mientras la UI muestra cambios nuevos.
- [ ] Verificar estructura GLB, buffers/texturas y presupuestos. Prohibir referencias externas o resolverlas solo mediante manifiesto/allowlist interna; evitar SSRF y expansión descontrolada de imágenes.
- [ ] Separar validación de GLB importados de generación desde diseño: un import externo no tiene necesariamente JSON reconstruible.
- [ ] Ante fallo, conservar la última generación válida y devolver estado retryable; limpiar generaciones no referenciadas con retención.
- [ ] Sustituir `createModelShare` por adaptador cliente. Mantener el enlace existente y el progreso sin abrir pestañas en blanco.

**Terminado cuando:** una publicación fallida no rompe el enlace previo y dos jobs en distinto orden no dejan visible el más antiguo.

### B06 · P2 · Miniaturas persistentes y backfill

- [ ] Generar PNG/WebP por generación con cámara/iluminación/tamaño fijados. Guardar `thumbnailPath` y hash/revisión junto al GLB correspondiente.
- [ ] Mostrar imagen directamente en galería; mantener fallback para registros antiguos, sin descargar cada GLB para dibujar una miniatura en cada sesión.
- [ ] Crear migración/backfill paginado e idempotente de shares existentes; conservar owner, enlaces y fecha original.
- [ ] Invalidar la captura al reemplazar generación; cachear por hash, no solo por URL estable.
- [ ] Aplicar límites al parser/render de modelos antiguos y fallar por modelo, sin bloquear todo el lote.

**Terminado cuando:** galería carga imágenes pequeñas, el modelo reemplazado muestra captura nueva y los shares antiguos siguen abriendo.

### B07 · P2 · Render GLB y derivados en servidor — prototipo antes de migrar todo

- [ ] Extraer geometría/materiales desde Sleeve3DPreview, sleeve-shell, cookie-core y pressing-rings. Separar escena exportable de cámara/UI/luces solo de preview.
- [ ] Encapsular dependencias DOM de `createLabelSvg`, `createSleeveArtworkSvg`, `captureLabelPreview` y del exportador GLB; no importarlos sin más en Node.
- [ ] Resolver imágenes y fuentes por IDs internos autorizados. Verificar licencias de embedding/uso remoto y evitar filtración de archivos privados en derivados públicos.
- [ ] Validar/sanitizar SVG de nuevo en servidor; no permitir scripts, event handlers, HTML/foreignObject o recursos externos sin política estricta.
- [ ] Probar memoria, tiempo, tamaño, fidelidad tipográfica y soporte de Canvas/WebGL para Node vs navegador headless. Fijar versiones de renderer y fuentes.
- [ ] Golden fixtures: A/B, Cookie/Sleeve, transparente/agujero, unión/receso, pressing rings, imágenes/crop/fill, japonés, tracking, blur, ink bleed, opacidad, extrusión y cilindro permitido.
- [ ] Aceptar jobs asíncronos; progreso por etapas real. Reintentos, timeout, cancelación lógica, lease y limpieza de temporales.
- [ ] Comparar costes y tiempo de arranque en `europe-west3`; elegir Functions o worker Cloud Run según evidencia, no solo por tener Three.js instalado.

**Terminado cuando:** un diseño validado produce GLB y miniatura reproducibles sin depender de la pestaña y sin diferencias de render no aprobadas. El preview interactivo permanece local.

### B08 · P1 · Recuperación, colas y límites operativos

- [ ] Configurar tareas privadas con límites de concurrencia/reintentos y backoff; proteger su invocación mediante IAM.
- [ ] Dead-letter/estado terminal y herramientas para reintentar por operationId; deduplicar eventos y no repetir efectos destructivos.
- [ ] Sweep programado de staging caducado y objetos huérfanos, solo si no están referenciados por publicaciones/versiones vigentes.
- [ ] Paneles/alertas para jobs fallidos, demora, bytes, CPU/memoria y coste. Presupuesto/alertas no reemplazan cuotas de aplicación.
- [ ] Fijar límites de payload y diseño completo. Hoy se aceptan objetos de hasta 100 MiB: no transportarlos por callable ni devolver GLB grande como respuesta.

[Cloud Tasks](https://firebase.google.com/docs/functions/task-functions) permite configurar ejecución/reintentos. El worker debe ser idempotente; una cola no garantiza “exactly once”. [Reintentos e idempotencia](https://firebase.google.com/docs/functions/retries). Los límites HTTP de Functions no son iguales a los límites de Storage; verificar los límites vigentes antes de configurar payloads. [Cuotas](https://firebase.google.com/docs/functions/quotas).

### B09 · P1 · Rules, compatibilidad y rollout

- [ ] Añadir reglas de lectura owner-only para jobs/sesiones y permisos de upload restringidos a staging.
- [ ] Validar en Rules y servidor caducidad, dueño y pertenencia de cada path; impedir lectura pública de fuentes/JSON privados.
- [ ] Después de migrar todos los clientes, denegar writes directos de proyecto/version/share final y deletes directos que evadan el workflow. No hacerlo antes de que exista el reemplazo funcional.
- [ ] Emuladores: cliente intentando saltar callable, usuario ajeno, tokens ausentes, schema corrupto, metadata/payload divergentes, path traversal y sesiones expiradas.
- [ ] Las pruebas de backend deben comprobar Auth/IAM/ownership por separado: Admin SDK ignora Rules, por lo que un test de Rules que pasa no prueba la Function.
- [ ] Plan para pestañas/clientes antiguos, contratos versionados y feature flag. Desplegar backend compatible → frontend → endurecimiento de Rules.
- [ ] Rollback sin reabrir indiscriminadamente escrituras. No cambiar Rules ni ejecutar backfill destructivo desde este documento.

**Terminado cuando:** el cliente antiguo no genera corrupción y un cliente modificado no puede publicar/borrar saltándose el backend.

### B10 · P2 · Exportación profesional opcional

- [ ] Decidir si SVG/PNG/PDF/PSD oficiales se generan por job y quedan ligados a `sourceHash`/rendererVersion.
- [ ] Mantener export local cuando sea suficiente; mover CPU al servidor no mejora automáticamente fidelidad, privacidad o seguridad.
- [ ] Probar estructura PSD, fuentes/contornos, perfiles, resolución física y apariencia en aplicaciones reales; no prometer CMYK por migrar a backend.
- [ ] Definir caducidad, permisos de descarga y retención de derivados grandes.

## 5. Orden recomendado y límites de esta propuesta

1. B00/B01: contratos, gate, autorización y pruebas.
2. B04 y B03: rename sencillo y borrado durable, con política frente a guardados.
3. B02: save/finalize e idempotencia; B09 habilita transición sin romper clientes.
4. B05: publicación segura, manteniendo inicialmente GLB cliente como input **no confiable** sujeto a validación.
5. B06 y prototipo B07: miniaturas persistidas y generación autoritativa. No presentar la fase transitoria como garantía de correspondencia visual entre JSON y GLB.
6. B08 acompaña cada fase; B10 según necesidad y medición.

No hay una transacción única entre Firestore y Storage: Functions tampoco la crea. Los estados durables, generaciones y compensaciones resuelven esa frontera. No se eligieron todavía cuotas definitivas, coste objetivo, política de revocación ni motor de render: son decisiones de implementación documentadas arriba, no funcionalidades existentes.
