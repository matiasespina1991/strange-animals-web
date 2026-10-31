import {FieldValue, Firestore} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {HttpsError} from "firebase-functions/v2/https";
import {projectInput} from "./design-gallery-service";

type Bucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Replace a version's snapshot without adding another history entry.
 * Immutable uploads precede an atomic pointer swap; failed uploads/commits
 * leave the previous snapshot untouched. Old objects remain until deletion.
 * @param {Firestore} db Admin database.
 * @param {Bucket} bucket Private design bucket.
 * @param {string|undefined} authUid Authenticated UID, not a payload field.
 * @param {unknown} input Untrusted save request.
 * @return {Promise<object>} Stable version identity.
 */
export async function overwriteGalleryVersion(
  db: Firestore, bucket: Bucket, authUid: string | undefined, input: unknown,
) {
  const {uid, projectId, data} = projectInput(authUid, input);
  const {versionId, uploadId, expectedDesignPath, expectedTitle, title} = data;
  if (typeof versionId !== "string" || !uuid.test(versionId) ||
      typeof uploadId !== "string" || !uuid.test(uploadId) ||
      uploadId === versionId || typeof expectedDesignPath !== "string" ||
      typeof expectedTitle !== "string" || typeof title !== "string" ||
      !title.trim() || title.length > 120) {
    throw new HttpsError("invalid-argument", "Invalid version save request.");
  }
  const root = `media/private/design-gallery/${uid}/${projectId}/${uploadId}`;
  const paths = {
    designPath: `${root}/design.json`,
    frontPreviewPath: `${root}/front.png`,
    backPreviewPath: `${root}/back.png`,
    frontSleevePreviewPath: `${root}/front-with-sleeve.png`,
    backSleevePreviewPath: `${root}/back-with-sleeve.png`,
  };
  await Promise.all(Object.entries(paths).map(async ([key, path]) => {
    const [metadata] = await bucket.file(path).getMetadata();
    const type = key === "designPath" ? "application/json" : "image/png";
    if (metadata.contentType !== type || !Number(metadata.size) ||
        Number(metadata.size) > 100 * 1024 * 1024) {
      throw new HttpsError("invalid-argument", "Invalid uploaded snapshot.");
    }
  }));
  const projectRef = db.doc(`designUsers/${uid}/projects/${projectId}`);
  const versionRef = projectRef.collection("versions").doc(versionId);
  return db.runTransaction(async (transaction) => {
    const [project, version] = await Promise.all([
      transaction.get(projectRef), transaction.get(versionRef),
    ]);
    if (!project.exists || !version.exists || project.get("status")) {
      throw new HttpsError("failed-precondition", "Project unavailable.");
    }
    // CAS prevents concurrent saves from silently replacing newer work.
    if (project.get("title") !== expectedTitle ||
        version.get("designPath") !== expectedDesignPath) {
      throw new HttpsError("aborted", "Project changed. Reload before saving.");
    }
    transaction.update(versionRef, {
      ...paths,
      modelPath: FieldValue.delete(), modelFileName: FieldValue.delete(),
      modelSizeBytes: FieldValue.delete(),
    });
    const latest = project.get("latestVersionId") === versionId;
    const previews = {
      frontPreviewPath: paths.frontPreviewPath,
      backPreviewPath: paths.backPreviewPath,
      frontSleevePreviewPath: paths.frontSleevePreviewPath,
      backSleevePreviewPath: paths.backSleevePreviewPath,
    };
    transaction.update(projectRef, {
      title: title.trim(), updatedAt: FieldValue.serverTimestamp(),
      ...(latest ? previews : {}),
    });
    return {versionId, version: version.get("version") as number};
  });
}
