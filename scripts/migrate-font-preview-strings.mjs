import { execFileSync } from "node:child_process";

// One-time migration of the former frontend overrides. Runtime text lives in Firestore.
const legacy = {
  delamarugothic: "あいうえお　カタカナ",
  dokidokifantasia: "あいうえお　カタカナ",
  enkadotmincho24: "あいうえお　カタカナ",
  genei: "あいうえお　カタカナ",
  gennukigothic: "あいうえお　カタカナ",
  hanyishuiditifan: "中文字体　你好世界",
  hanyixuefengtifan: "中文字体　你好世界",
  hanyiyuandietifan: "中文字体　你好世界",
  mojiwmochizuki: "한글 글꼴 미리보기",
  rampartone: "あいうえお　カタカナ",
  shimbashigothic: "あいうえお　カタカナ",
  youshebiaotihei: "中文字体　你好世界",
  zaramegothic: "あいうえお　カタカナ",
};
const token = execFileSync(
  "/Users/matiasespina/Downloads/google-cloud-sdk/bin/gcloud",
  ["auth", "print-access-token"], { encoding: "utf8" },
).trim();
const base = "https://firestore.googleapis.com/v1/projects/strange-animals-web/databases/(default)/documents";
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const writes = [];
for (const [id, previewString] of Object.entries(legacy)) {
  const response = await fetch(`${base}/fonts/${id}`, { headers });
  if (response.status === 404) { console.log("Missing, skipped:", id); continue; }
  if (!response.ok) throw new Error(await response.text());
  const document = await response.json();
  if (document.fields.previewString?.stringValue?.trim()) {
    console.log("Existing custom text preserved:", id);
    continue;
  }
  writes.push({
    update: { name: document.name, fields: { previewString: { stringValue: previewString } } },
    updateMask: { fieldPaths: ["previewString"] },
    currentDocument: { updateTime: document.updateTime },
  });
}
if (process.argv.includes("--apply") && writes.length) {
  const response = await fetch(`${base}:commit`, {
    method: "POST", headers, body: JSON.stringify({ writes }),
  });
  if (!response.ok) throw new Error(await response.text());
  for (const write of writes) {
    const response = await fetch(`https://firestore.googleapis.com/v1/${write.update.name}`, { headers });
    if (!response.ok) throw new Error(await response.text());
    const document = await response.json();
    if (document.fields.previewString.stringValue !== write.update.fields.previewString.stringValue) {
      throw new Error(`Verification failed: ${document.name}`);
    }
  }
}
console.log({ count: writes.length, applied: process.argv.includes("--apply") });
