import { execFileSync, spawnSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import ts from "typescript";

const APPLY = process.argv.includes("--apply");
const CLASSIFY = process.argv.includes("--classify-uncategorized");
const reportPath = `temp/japanese-previews/${CLASSIFY ? "uncategorized-report" : "report"}.json`;
const base = "https://firestore.googleapis.com/v1/projects/strange-animals-web/databases/(default)/documents";
const bucket = "strange-animals-web.firebasestorage.app";
const token = execFileSync("/Users/matiasespina/Downloads/google-cloud-sdk/bin/gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();
const headers = { Authorization: `Bearer ${token}` };
// Reuse the runtime's glyph-ID-aware cmap parser, without importing Firebase/browser code.
const source = await readFile("src/features/identity/font-catalog-repository.ts", "utf8");
const helpers = source.slice(source.indexOf("function isWithinBounds("), source.indexOf("function isRecord("));
const compiled = ts.transpileModule(`${helpers}\nexport { getSupportedCodePoints };`, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { getSupportedCodePoints } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json();
}
async function list(collection) {
  const documents = [];
  let next;
  do {
    const page = await json(`${base}/${collection}?pageSize=300${next ? `&pageToken=${encodeURIComponent(next)}` : ""}`);
    documents.push(...(page.documents ?? []));
    next = page.nextPageToken;
  } while (next);
  return documents;
}
function mediaUrl(storagePath) {
  return `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(storagePath)}?alt=media`;
}
async function range(storagePath, start, length) {
  const response = await fetch(mediaUrl(storagePath), { headers: { ...headers, Range: `bytes=${start}-${start + length - 1}` } });
  if (!response.ok) throw new Error(`Storage ${response.status}: ${storagePath}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const result = response.status === 206 ? bytes : bytes.subarray(start, start + length);
  if (result.length !== length) throw new Error(`Truncated font table: ${storagePath}`);
  return result;
}
function wrapCmap(cmap) {
  const font = Buffer.alloc(28 + cmap.length);
  font.writeUInt32BE(0x00010000, 0);
  font.writeUInt16BE(1, 4);
  font.write("cmap", 12);
  font.writeUInt32BE(28, 20);
  font.writeUInt32BE(cmap.length, 24);
  cmap.copy(font, 28);
  const points = getSupportedCodePoints(font);
  if (!points) throw new Error("Unsupported or empty character map");
  return points;
}
async function coverage(storagePath) {
  const header = await range(storagePath, 0, 12);
  const signature = header.toString("ascii", 0, 4);
  if (signature === "wOF2") {
    const response = await fetch(mediaUrl(storagePath), { headers });
    if (!response.ok) throw new Error(`Storage ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const script = "import sys,io,json;from fontTools.ttLib import TTFont;f=TTFont(io.BytesIO(sys.stdin.buffer.read()));print(json.dumps(list((f.getBestCmap() or {}).keys())))";
    const result = spawnSync("python3", ["-c", script], { input: bytes, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(result.stderr);
    return new Set(JSON.parse(result.stdout));
  }
  const woff = signature === "wOFF";
  if (!woff && signature !== "OTTO" && signature !== "true" && header.readUInt32BE(0) !== 0x00010000) {
    throw new Error("Invalid/unsupported font signature");
  }
  // WOFF numTables is at byte 12, beyond the initial SFNT-sized header.
  const tables = woff ? (await range(storagePath, 12, 2)).readUInt16BE(0) : header.readUInt16BE(4);
  if (!tables || tables > 256) throw new Error("Invalid table count");
  const directory = await range(storagePath, woff ? 44 : 12, tables * (woff ? 20 : 16));
  for (let index = 0; index < tables; index++) {
    const offset = index * (woff ? 20 : 16);
    if (directory.toString("ascii", offset, offset + 4) !== "cmap") continue;
    const position = directory.readUInt32BE(offset + (woff ? 4 : 8));
    const length = directory.readUInt32BE(offset + (woff ? 8 : 12));
    if (length > 8 * 1024 * 1024) throw new Error("Character map exceeds inspection limit");
    const table = await range(storagePath, position, length);
    return wrapCmap(woff && length < directory.readUInt32BE(offset + 12) ? inflateSync(table) : table);
  }
  throw new Error("No character map");
}
const isKana = point => (point >= 0x3041 && point <= 0x3096) || (point >= 0x30a1 && point <= 0x30fa) || (point >= 0xff66 && point <= 0xff9d);
function sample(points) {
  const pick = text => Array.from(text).filter(character => points.has(character.codePointAt(0))).slice(0, 5).join("");
  const groups = [pick("あいうえおかきくけこさしすせそたちつてと"), pick("アイウエオカキクケコサシスセソタチツテト")].filter(Boolean);
  if (groups.join("").length >= 5) return groups.join(points.has(0x3000) ? "　" : " ");
  const halfwidth = pick("ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ");
  return halfwidth.length >= 5 ? halfwidth : String.fromCodePoint(...[...points].filter(isKana).sort((a,b) => a-b).slice(0, 10));
}
const useReport = process.argv.includes("--use-report");
const documents = useReport ? [] : (await list("fonts")).filter(document => {
  if (!CLASSIFY) return true;
  const category = document.fields.parentCategory?.stringValue?.trim();
  return !category || category === "Uncategorized";
});
const report = useReport ? JSON.parse(await readFile(reportPath, "utf8")) : [];
let cursor = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (cursor < documents.length) {
    const document = documents[cursor++];
    const fields = document.fields;
    const id = document.name.split("/").pop();
    const name = fields.name?.stringValue ?? id;
    const existingPreview = fields.previewString?.stringValue;
    if (!CLASSIFY && existingPreview?.trim()) { report.push({ id, name, status: "preserved" }); continue; }
    let storagePath = fields.preview?.mapValue?.fields?.storagePath?.stringValue;
    if (!storagePath) { report.push({ id, name, status: "no-preview" }); continue; }
    try {
      let points;
      try { points = await coverage(storagePath); }
      catch (error) {
        if (!String(error).includes("404")) throw error;
        const fileName = fields.preview.mapValue.fields.fileName.stringValue;
        storagePath = `media/private/fonts/${fileName}`;
        points = await coverage(storagePath);
      }
      const kanaCount = [...points].filter(isKana).length;
      if (kanaCount < 5) { report.push({ id, name, status: "not-japanese", kanaCount }); continue; }
      const hasCustomPreview = Boolean(existingPreview?.trim());
      const previewString = hasCustomPreview ? existingPreview : sample(points);
      report.push({ id, name, status: "japanese", kanaCount, previewString, hasCustomPreview, storagePath, updateTime: document.updateTime });
      console.log("Detected:", name, JSON.stringify(previewString), kanaCount);
    } catch (error) { report.push({ id, name, status: "error", error: String(error) }); console.log("Uninspected:", name, String(error)); }
  }
}));
await mkdir("temp/japanese-previews", { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2));
const detected = report.filter(item => item.status === "japanese");
if (APPLY && detected.length) {
  const writes = detected.map(item => {
    const fields = CLASSIFY ? { parentCategory: { stringValue: "Non-Latin Script" } } : {};
    if (!CLASSIFY || !item.hasCustomPreview) fields.previewString = { stringValue: item.previewString };
    return {
      update: { name: `${base.slice("https://firestore.googleapis.com/v1/".length)}/fonts/${item.id}`, fields },
      updateMask: { fieldPaths: Object.keys(fields) }, currentDocument: { updateTime: item.updateTime },
    };
  });
  await json(`${base}:commit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ writes }) });
  for (const item of detected) {
    const document = await json(`${base}/fonts/${item.id}`);
    if (document.fields.previewString.stringValue !== item.previewString) throw new Error(`Verification failed: ${item.id}`);
    if (CLASSIFY && document.fields.parentCategory?.stringValue !== "Non-Latin Script") throw new Error(`Category verification failed: ${item.id}`);
  }
}
console.log(JSON.stringify({ scanned: report.length, detected: detected.length, preserved: report.filter(r => r.status === "preserved").length, uninspected: report.filter(r => r.status === "error").length, applied: APPLY }));
