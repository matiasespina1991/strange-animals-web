const assert = require("node:assert/strict");
const {randomUUID} = require("node:crypto");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const {requestDeletion, deleteProjectPage, deletionId, renameProject, cleanupDeletedProjectUpload} = require("../lib/design-gallery-service");

// Refuse to run with live Admin credentials, even accidentally.
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8080");
assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, "127.0.0.1:9199");
const app = initializeApp({projectId: "strange-animals-web", storageBucket: "strange-animals-web.firebasestorage.app"});
const db = getFirestore(app), bucket = getStorage(app).bucket();
async function main() {
  const uid = `test-${randomUUID()}`, projectId = randomUUID(), versionId = randomUUID();
  const ref = db.doc(`designUsers/${uid}/projects/${projectId}`);
  const prefix = `media/private/design-gallery/${uid}/${projectId}/`;
  await ref.set({title: "Test", latestVersion: 501, latestVersionId: versionId});
  for (let offset = 0; offset < 501; offset += 200) {
    const batch = db.batch();
    for (let n = offset; n < Math.min(offset + 200, 501); n++) batch.set(ref.collection("versions").doc(randomUUID()), {version: n});
    await batch.commit();
  }
  const publicPath = `media/public/shared-models/${uid}/${versionId}/test.glb`;
  const otherPath = `media/private/design-gallery/${uid}/${randomUUID()}/keep.png`;
  await Promise.all([bucket.file(prefix + versionId + "/front.png").save("private"), bucket.file(publicPath).save("public"), bucket.file(otherPath).save("other")]);
  const input = {projectId, expectedVersionId: versionId};
  await assert.rejects(requestDeletion(db, undefined, input), {code: "unauthenticated"});
  await assert.rejects(requestDeletion(db, "stranger", input), {code: "not-found"});
  await assert.rejects(requestDeletion(db, uid, {...input, projectId: "../bad"}), {code: "invalid-argument"});
  await assert.rejects(requestDeletion(db, uid, {...input, uid: "other"}), {code: "invalid-argument"});
  await assert.rejects(requestDeletion(db, uid, {...input, expectedVersionId: randomUUID()}), {code: "failed-precondition"});
  await renameProject(db, uid, {projectId, title: "Renamed", expectedTitle: "Test"});
  await assert.rejects(renameProject(db, uid, {projectId, title: "Old", expectedTitle: "Test"}), {code: "aborted"});
  assert.equal((await ref.get()).get("latestVersion"), 501);
  await Promise.all([requestDeletion(db, uid, input), requestDeletion(db, uid, input)]);
  const jobId = deletionId(uid, projectId), job = db.doc(`designDeletionJobs/${jobId}`);
  assert.equal((await ref.get()).get("status"), "deleting");
  await assert.rejects(renameProject(db, uid, {projectId, title: "No", expectedTitle: "Renamed"}), {code: "failed-precondition"});
  // Simulate transient object-store failure; the durable record must remain retryable.
  await assert.rejects(deleteProjectPage(db, {getFiles: async () => { throw Error("temporary"); }}, jobId));
  assert.equal((await job.get()).get("status"), "retrying");
  await requestDeletion(db, uid, input);
  for (let page = 0; page < 12 && (await job.get()).get("status") !== "completed"; page++) {
    // Simultaneous workers must not double-own the same lease.
    await Promise.all([deleteProjectPage(db, bucket, jobId), deleteProjectPage(db, bucket, jobId)]);
  }
  assert.equal((await job.get()).get("status"), "completed");
  assert.equal((await ref.get()).get("status"), "deleted");
  assert.equal((await ref.get()).get("title"), undefined, "Tombstone must not retain project content");
  assert.equal((await ref.collection("versions").get()).size, 0);
  assert.equal((await bucket.getFiles({prefix}))[0].length, 0);
  assert.equal((await bucket.file(publicPath).exists())[0], true);
  assert.equal((await bucket.file(otherPath).exists())[0], true);
  assert.deepEqual(await requestDeletion(db, uid, input), {status: "completed"});
  // A late upload is removed by generation, including after the job completed.
  const latePath = prefix + versionId + "/back.png";
  await bucket.file(latePath).save("late");
  const [metadata] = await bucket.file(latePath).getMetadata();
  await cleanupDeletedProjectUpload(db, bucket, latePath, metadata.generation);
  assert.equal((await bucket.file(latePath).exists())[0], false);
  console.log("Backend gallery: ownership, malformed inputs, rename CAS, 501 versions, duplicate calls/workers, transient retry, tombstone, exact prefix, public shares and late uploads passed.");
  await db.terminate();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
