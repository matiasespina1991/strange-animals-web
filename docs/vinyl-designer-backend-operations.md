# Operaciones de galería en backend

Implementación y despliegue: 2026-10-28. **Functions, Hosting y Rules publicados y verificados**. No se han borrado proyectos reales como prueba.

## Estado real de despliegue

El usuario autorizó el despliegue coordinado y luego autorizó específicamente desactivar la comprobación IAM de Cloud Run **solo** en `requestprojectdeletion` y `renamedesignproject`. Se eligió la alternativa recomendada por Google para domain-restricted sharing: no se añadió `allUsers` ni se modificó la política organizacional. Ambos endpoints verificaron en producción `401 UNAUTHENTICATED` para peticiones sin Firebase Auth. Ver [acceso HTTP en Cloud Run](https://docs.cloud.google.com/run/docs/authenticating/public).

Las cuatro Functions quedaron desplegadas. El scheduler está `ENABLED` y su última ejecución comprobada terminó sin error. Eventarc tiene el trigger `google.cloud.storage.object.v1.finalized` en la ubicación `eu` del bucket y cuenta dedicada; su destino Cloud Run permanece privado, con `roles/run.invoker` solo para esa cuenta (además de bindings heredados existentes). Después se publicaron Hosting y las Rules de Firestore/Storage, compiladas correctamente. Tanto `strangeanimals.de` como `strange-animals-web.web.app` devolvieron HTTP 200 con el bundle local desplegado `index-Zp1OdyhS.js`.

Firebase CLI autenticado nuevamente; base `(default)` confirmada STANDARD/FIRESTORE_NATIVE, `europe-west3`. Los comandos gcloud usaron temporalmente en memoria la sesión Firebase autorizada, sin guardar ni imprimir tokens; no se cambió la sesión gcloud del usuario.

### IAM aplicado

- Corrección 2026-10-30: se agregó y verificó `roles/firebaserules.firestoreServiceAgent` para `service-536380283169@gcp-sa-firebasestorage.iam.gserviceaccount.com`, con autorización explícita del usuario. Este rol aporta `datastore.entities.get`, necesario para las consultas `firestore.exists/get` de Storage Rules que comprueban el bloqueo de eliminación. Las reglas publicadas ya incluían esas consultas, pero faltaba el permiso en producción, provocando `storage/unauthorized` al guardar. Se verificó el binding IAM; queda pendiente reintentar el guardado desde la sesión del usuario tras la propagación del permiso. En futuros despliegues, comprobar también este binding: los emuladores no validan IAM entre servicios. Ver [permisos entre Storage Rules y Firestore](https://firebase.google.com/docs/rules/manage-deploy#manage_permissions_for_cross-service_cloud_storage_security_rules).
- Cuenta dedicada `vinyl-gallery-runtime@strange-animals-web.iam.gserviceaccount.com`, usada por las cuatro Functions.
- `vinylGalleryDatabaseWorker`: únicamente `datastore.databases.get` y `datastore.entities.{get,list,create,update,delete}`, con condición `resource.name == "projects/strange-animals-web/databases/(default)"`. El rol general `roles/datastore.user` fue rechazado por el control automático y **no se concedió**. IAM no restringe Admin SDK por colección: la autorización por proyecto/dueño sigue siendo responsabilidad de los handlers probados.
- `vinylGalleryArtifactCleaner`: `storage.objects.{list,get,delete}`, binding únicamente en el bucket existente. Condición permite listar ese bucket y leer/borrar solo `objects/media/private/design-gallery/…`, no fuentes ni shares públicos. Control uniforme del bucket ya estaba habilitado; no se cambió.
- `vinylGalleryEventReceiver`: únicamente `eventarc.events.receiveEvent`, para la cuenta dedicada.
- `roles/run.invoker` de `cleanuplatedesignuploads`: cuenta dedicada, no `allUsers`. El scheduler mantiene la identidad OIDC previamente configurada y su endpoint sigue privado.

Tras futuros deploys de Functions, verificar que los dos endpoints callable conserven el transporte público con Auth de aplicación. El SDK declara `invoker: private` para no intentar agregar `allUsers` bloqueado por la organización; la opción de transporte se configura en Cloud Run:

```sh
gcloud run services update requestprojectdeletion --region=europe-west3 --project=strange-animals-web --no-invoker-iam-check
gcloud run services update renamedesignproject --region=europe-west3 --project=strange-animals-web --no-invoker-iam-check
```

No aplicar esos flags al worker ni al trigger. No cambiar política global como alternativa. Esta excepción persistente fue autorizada explícitamente por el usuario; revisar su continuidad en cada rollout.

## Contratos y retención

- `requestProjectDeletion({projectId, expectedVersionId})`: solo Auth, UID derivado del token; no recibe owner, bucket ni prefijo. UUID minúsculo, claves extra rechazadas. Compara la versión antes de bloquear. Repetir la solicitud reanuda el mismo job, sin cambiar una lease activa.
- `renameDesignProject({projectId, title, expectedTitle})`: solo dueño, título recortado 1–120 caracteres, transacción con comparación de nombre. No altera versiones. CAS de texto no detecta ABA; revisión monotónica/idempotencia de save sigue en B02/B04.
- Proyecto privado: `designUsers/{uid}/projects/{projectId}`. Mientras borra, conserva metadata para mostrar estado. Al finalizar, se reemplaza por `{status: "deleted", deletedAt}`. Tombstone permanente: impide reutilizar UUID y elimina el nombre privado anterior.
- Job: `designDeletionJobs/{sha256(uid/projectId)}`. Backend escribe; dueño lee. Conserva namespace, fase, intentos, lease, contadores y timestamps para recuperación/auditoría. No contiene JSON, imágenes ni título. No tiene TTL: no borrar jobs/tombstones sin diseñar protección de recreación equivalente.
- Solo `media/private/design-gallery/{uid}/{projectId}/` se elimina. Los modelos públicos y sus enlaces **no se revocan**.

## Procesamiento y fallos

`processDesignDeletions` corre cada minuto, una instancia máxima, timeout de 300 s. Hasta 20 jobs por ejecución; cada página elimina hasta 100 objetos o 200 documentos de versión. Selecciona jobs por `nextAttemptAt`, un índice de campo simple. Cada claim mueve ese tiempo 10 minutos hacia adelante y asigna un token; los updates finales comparan token para no pisar otro worker.

Al terminar una página se guarda la fase; las páginas siempre consultan los primeros objetos/documentos restantes, por lo que un crash no salta objetos. Los contadores pueden subestimar trabajo si un proceso muere entre Storage y Firestore; no son una medida de facturación. Los reintentos usan backoff hasta una hora y continúan mientras el job no se complete. La UI permite adelantar un job en `retrying`. El scheduler puede tardar al menos un minuto en iniciar y las eliminaciones grandes requieren varias pasadas.

`cleanupLateDesignUploads` reacciona a Storage finalize: solo para el prefijo privado y proyectos `deleting/deleted`, elimina la generación exacta del evento. Un 412 no elimina una generación más nueva. Ausencia es idempotente. El trigger tiene reintentos; las nuevas subidas se bloquean con una lectura Firestore desde Storage Rules. Ver [reintentos Firebase](https://firebase.google.com/docs/functions/retries) y [condiciones Storage Rules](https://firebase.google.com/docs/storage/security/rules-conditions).

No hay atomicidad entre servicios ni promesa de borrado instantáneo. IAM/bucket indisponible produce reintento y aviso, no falsa confirmación. Los reintentos persistentes requieren alertas y supervisión (B08 pendiente). El trigger recibe eventos del bucket, aunque descarta temprano otros prefijos: medir coste a escala. App Check y cuotas por usuario siguen pendientes en B01; Auth y ownership sí se verifican.

## Pruebas y evaluación de Rules

El entorno de pruebas exige explícitamente hosts `127.0.0.1:8080` y `127.0.0.1:9199`; el test Admin se niega a ejecutar sin ellos. No emplea credenciales de producción para crear/borrar fixtures.

```sh
npm --prefix functions run lint
npm --prefix functions run build
npx firebase-tools@15.34.1 emulators:exec --config firebase.emulators.json --project strange-animals-web --only auth,firestore,storage 'npm --prefix functions run test:gallery && node scripts/test-design-gallery-rules.mjs'
```

CLI 15 requiere Java 21+. Localmente se verificó con CLI 13.35.1/Java 17; CI configura Java 21/Node 22 y CLI 15.34.1. También pasan typecheck/build web y 25 regresiones locales. Workflow separado `test-design-backend.yml`; no despliega automáticamente Functions/Rules.

Matriz comprobada en emuladores:

| Caso | Resultado |
| --- | --- |
| Sin Auth / UID ajeno | Callable rechaza; Rules niegan recursos ajenos |
| Path traversal, UID extra en payload, versión vieja | Rechazo sin job ni mutación |
| 501 versiones, objetos faltantes, prefijo vecino | Borra en páginas, vecino intacto |
| Dos solicitudes/workers | Un job, lease excluyente; operación idempotente |
| Error Storage transitorio | Job `retrying`, reanudación posterior |
| Upload después del lock | Rules rechazan creación |
| Upload ya aceptado que termina tarde | Trigger elimina generación exacta |
| Delete directo proyecto/versiones, borrar lock/job | Rules rechazan incluso al dueño |
| Lectura de job por otro usuario | Rechazada; dueño puede inspeccionar |
| Renombrar con título esperado incorrecto / proyecto bloqueado | Callable rechaza sin modificar versiones |
| Shares públicos tras borrar proyecto | Conservados |

Estas Rules son un prototipo validado con los casos anteriores, no una garantía exhaustiva. IAM del Admin SDK no pasa por Rules; requiere revisión independiente. Mantienen las consultas owner-only existentes. Campos de lock/job no son editables desde SDK cliente. Writes de versiones activas siguen permitidos por compatibilidad con el guardado actual: B02 aún no está migrado.

## Rollout y recuperación

1. Desplegar las cuatro Functions primero; verificar scheduler y trigger habilitados.
2. Publicar la web con adaptadores callable y estado de eliminación; luego aplicar Firestore/Storage Rules que bloquean deletes/renames directos. Las pestañas antiguas deben recargarse.
3. Verificar llamadas no autenticadas: rechazo esperado; no borrar proyectos reales como smoke test.
4. Si falla el despliegue de backend, no endurecer Rules ni publicar cliente que dependa de endpoints ausentes. Si falla después, corregir adelante; no borrar jobs/tombstones ni reabrir escrituras indiscriminadamente.

La cuenta runtime dedicada y sus roles reducidos están implementados según la sección IAM. El callable es HTTP invocable para el protocolo Firebase, pero exige `request.auth`. El trigger usa IAM/Eventarc. Alertas, App Check y presupuesto/cuotas por usuario siguen pendientes en B01/B08.
