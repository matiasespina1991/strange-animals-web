import {createHash, randomUUID} from "node:crypto";
import {FieldValue, Firestore, Timestamp} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import {HttpsError} from "firebase-functions/v2/https";

type Bucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/**
 * Validate the authenticated namespace and bounded project identifier.
 * @param {string|undefined} uid UID, never taken from the payload.
 * @param {unknown} input Untrusted callable payload.
 * @return {object} Validated namespace and payload.
 */
export function projectInput(uid: string | undefined, input: unknown) {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to manage your designs.");
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    throw new HttpsError(
      "permission-denied",
      "Unsupported account identifier.",
    );
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpsError("invalid-argument", "Invalid request.");
  }
  const data = input as Record<string, unknown>;
  if (typeof data.projectId !== "string" || !uuid.test(data.projectId)) {
    throw new HttpsError("invalid-argument", "Invalid project identifier.");
  }
  return {uid, projectId: data.projectId, data};
}
/**
 * Derive the stable deletion operation ID.
 * @param {string} uid Owner UID.
 * @param {string} projectId Project UUID.
 * @return {string} Stable hash.
 */
export function deletionId(uid: string, projectId: string) {
  return createHash("sha256").update(`${uid}/${projectId}`).digest("hex");
}

/**
 * Atomically lock a project and create or resume its durable deletion.
 * @param {Firestore} db Admin database.
 * @param {string|undefined} authUid Authenticated UID.
 * @param {unknown} input Untrusted callable payload.
 */
export async function requestDeletion(
  db: Firestore,
  authUid: string | undefined,
  input: unknown,
) {
  const {uid, projectId, data} = projectInput(authUid, input);
  if (
    Object.keys(data).some(
      (key) => !["projectId", "expectedVersionId"].includes(key),
    ) ||
    typeof data.expectedVersionId !== "string" ||
    !uuid.test(data.expectedVersionId)
  ) {
    throw new HttpsError("invalid-argument", "Invalid deletion request.");
  }
  const project = db.doc(`designUsers/${uid}/projects/${projectId}`);
  const job = db.doc(`designDeletionJobs/${deletionId(uid, projectId)}`);
  return db.runTransaction(async (tx) => {
    const [snapshot, previous] = await Promise.all([
      tx.get(project),
      tx.get(job),
    ]);
    if (previous.exists) {
      const status = previous.get("status");
      // Repeated requests resume the job, never steal an active worker lease.
      if (status === "retrying") {
        tx.update(job, {nextAttemptAt: Timestamp.now()});
      }
      return {status: status === "completed" ? "completed" : "deleting"};
    }
    if (!snapshot.exists) {
      throw new HttpsError(
        "not-found",
        "This project is no longer in your gallery.",
      );
    }
    if (snapshot.get("latestVersionId") !== data.expectedVersionId) {
      throw new HttpsError(
        "failed-precondition",
        "A new version was saved. Reload before deleting.",
      );
    }
    tx.update(project, {
      status: "deleting",
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(job, {
      ownerUid: uid,
      projectId,
      status: "pending",
      phase: "files",
      attempts: 0,
      deletedFiles: 0,
      deletedVersions: 0,
      nextAttemptAt: Timestamp.now(),
      createdAt: FieldValue.serverTimestamp(),
    });
    return {status: "deleting"};
  });
}

/**
 * Process one bounded, fenced page; absence is idempotent progress.
 * @param {Firestore} db Admin database.
 * @param {Bucket} bucket Private artifact bucket.
 * @param {string} jobId Backend-derived deletion ID.
 */
export async function deleteProjectPage(
  db: Firestore,
  bucket: Bucket,
  jobId: string,
) {
  const job = db.doc(`designDeletionJobs/${jobId}`);
  const lease = randomUUID();
  const claim = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(job);
    if (
      !snapshot.exists ||
      snapshot.get("status") === "completed" ||
      snapshot.get("nextAttemptAt").toMillis() > Date.now()
    ) {
      return null;
    }
    const data = snapshot.data();
    if (!data) return null;
    const {uid, projectId} = projectInput(data.ownerUid, {
      projectId: data.projectId,
    });
    if (deletionId(uid, projectId) !== jobId) {
      throw Error("Invalid deletion job identity");
    }
    tx.update(job, {
      status: "running",
      lease,
      nextAttemptAt: Timestamp.fromMillis(Date.now() + 10 * 60_000),
    });
    return {uid, projectId, phase: String(data.phase)};
  });
  if (!claim) return;
  const project = db.doc(
    `designUsers/${claim.uid}/projects/${claim.projectId}`,
  );
  const prefix = "media/private/design-gallery/" +
    `${claim.uid}/${claim.projectId}/`;
  try {
    // Retain the tombstone permanently: old clients cannot recreate this UUID.
    const current = await project.get();
    if (
      !current.exists ||
      !["deleting", "deleted"].includes(current.get("status"))
    ) {
      throw Error("Deletion lock missing");
    }
    let phase = claim.phase;
    let deletedFiles = 0;
    let deletedVersions = 0;
    if (phase === "files") {
      const [files] = await bucket.getFiles({
        prefix,
        maxResults: 100,
        autoPaginate: false,
      });
      const results = await Promise.allSettled(
        files.map((file) => {
          if (!file.name.startsWith(prefix)) {
            throw Error("Object outside project scope");
          }
          return file.delete({
            ignoreNotFound: true,
            ifGenerationMatch: file.metadata.generation,
          });
        }),
      );
      if (results.some((result) => result.status === "rejected")) {
        throw Error("Artifact cleanup incomplete");
      }
      deletedFiles = files.length;
      if (!files.length) phase = "versions";
    } else if (phase === "versions") {
      const versions = await project.collection("versions").limit(200).get();
      const batch = db.batch();
      versions.docs.forEach((version) => batch.delete(version.ref));
      if (!versions.empty) await batch.commit();
      deletedVersions = versions.size;
      if (versions.empty) phase = "done";
    }
    await db.runTransaction(async (tx) => {
      const latest = await tx.get(job);
      if (latest.get("lease") !== lease) return;
      const complete = phase === "done";
      tx.update(job, {
        phase,
        status: complete ? "completed" : "pending",
        lease: FieldValue.delete(),
        deletedFiles: FieldValue.increment(deletedFiles),
        deletedVersions: FieldValue.increment(deletedVersions),
        nextAttemptAt: complete ? FieldValue.delete() : Timestamp.now(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(complete ? {completedAt: FieldValue.serverTimestamp()} : {}),
      });
      if (complete) {
        tx.set(project, {
          status: "deleted",
          deletedAt: FieldValue.serverTimestamp(),
        });
      } else {
        tx.update(project, {
          status: "deleting",
          deletionError: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
  } catch (error) {
    await db.runTransaction(async (tx) => {
      const latest = await tx.get(job);
      if (latest.get("lease") !== lease) return;
      const attempts = Number(latest.get("attempts") || 0) + 1;
      tx.update(job, {
        status: "retrying",
        attempts,
        lease: FieldValue.delete(),
        nextAttemptAt: Timestamp.fromMillis(
          Date.now() + Math.min(3600, 30 * 2 ** Math.min(attempts, 7)) * 1000,
        ),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(project, {
        deletionError:
          "Cleanup will retry automatically. You can also retry now.",
      });
    });
    // Do not log paths, download tokens, user content or raw SDK errors.
    throw new Error(`Deletion page failed: ${jobId}`);
  }
}

/**
 * Remove only the generation of an upload accepted before the deletion lock.
 * @param {Firestore} db Admin database.
 * @param {Bucket} bucket Event's storage bucket.
 * @param {string} name Object name from the trusted Storage event.
 * @param {string} generation Exact object generation.
 */
export async function cleanupDeletedProjectUpload(
  db: Firestore,
  bucket: Bucket,
  name: string,
  generation: string,
) {
  const match = new RegExp("^media/private/design-gallery/" +
    "([A-Za-z0-9_-]{1,128})/([0-9a-f-]{36})/").exec(name);
  if (!match || !uuid.test(match[2])) return;
  const snapshot = await db
    .doc(`designUsers/${match[1]}/projects/${match[2]}`)
    .get();
  if (["deleting", "deleted"].includes(snapshot.get("status"))) {
    try {
      await bucket
        .file(name)
        .delete({ignoreNotFound: true, ifGenerationMatch: generation});
    } catch (error) {
      if ((error as {code?: number}).code !== 412) throw error;
    }
  }
}

/**
 * Rename owner metadata with an optimistic name conflict check.
 * @param {Firestore} db Admin database.
 * @param {string|undefined} authUid Authenticated UID.
 * @param {unknown} input Untrusted callable payload.
 */
export async function renameProject(
  db: Firestore,
  authUid: string | undefined,
  input: unknown,
) {
  const {uid, projectId, data} = projectInput(authUid, input);
  if (
    Object.keys(data).some(
      (key) => !["projectId", "title", "expectedTitle"].includes(key),
    ) ||
    typeof data.title !== "string" ||
    !data.title.trim() ||
    data.title.trim().length > 120 ||
    typeof data.expectedTitle !== "string" ||
    data.expectedTitle.length > 120
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Use a project name between 1 and 120 characters.",
    );
  }
  const title = data.title.trim();
  const expectedTitle = data.expectedTitle;
  const ref = db.doc(`designUsers/${uid}/projects/${projectId}`);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Project not found.");
    }
    if (snapshot.get("status")) {
      throw new HttpsError(
        "failed-precondition",
        "This project is being deleted.",
      );
    }
    if (snapshot.get("title") !== expectedTitle) {
      throw new HttpsError(
        "aborted",
        "The project name changed. Reload and retry.",
      );
    }
    tx.update(ref, {title, updatedAt: FieldValue.serverTimestamp()});
  });
  return {title};
}
