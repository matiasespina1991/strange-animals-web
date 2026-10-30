import {onRequest} from "firebase-functions/v2/https";

const origin = "https://strangeanimals.de";
const bucket = "strange-animals-web.firebasestorage.app";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fallbackImage = `${origin}/media/images/oc/SALOGO2.png`;

/**
 * Build neutral public link metadata for a model.
 * @param {string} id Public model identifier.
 * @param {string} title Model title.
 * @return {object} Public link metadata.
 */
export function modelPageMetadata(id: string, title: string) {
  return {
    title: `3D MODEL | Strange Animals | ${title}`,
    description: `Interactive 3D view of ${title}. ` +
      "Explore the artwork, materials and print finishes " +
      "from different angles.",
    image: `${origin}/_model-preview/${id}`,
    imageAlt: `${title} — 3D model preview`,
    url: `${origin}/${id}`,
  };
}

/**
 * Escape text used in HTML content and quoted attributes.
 * @param {string} value Unescaped text.
 * @return {string} Escaped HTML.
 */
function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Insert model metadata into the built application shell.
 * @param {string} html Built application HTML.
 * @param {object} metadata Public model metadata.
 * @return {string} HTML containing model-specific metadata.
 */
export function applyModelMetadata(
  html: string,
  metadata: ReturnType<typeof modelPageMetadata>,
) {
  const values: Record<string, string> = {
    "description": metadata.description,
    "og-title": metadata.title, "og-description": metadata.description,
    "og-image": metadata.image, "og-image-alt": metadata.imageAlt,
    "twitter-title": metadata.title,
    "twitter-description": metadata.description,
    "twitter-image": metadata.image,
  };
  const titlePattern = /(<title data-route-meta="title">)[\s\S]*?(<\/title>)/;
  let result = html.replace(titlePattern,
    (_, start, end) => `${start}${escapeHtml(metadata.title)}${end}`);
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(
      `(<meta\\s+data-route-meta="${key}"[^>]*\\scontent=")` +
      "[^\"]*(\"[^>]*>)",
    );
    result = result.replace(pattern,
      (_, start, end) => `${start}${escapeHtml(value)}${end}`);
  }
  return result.replace("</head>",
    `<link rel="canonical" href="${metadata.url}">` +
    `<meta property="og:url" content="${metadata.url}">` +
    "<meta property=\"og:site_name\" content=\"Strange Animals\"></head>");
}

/** Public documents only, through the same read rules as the public viewer.
 * No Admin SDK, user token, arbitrary URL or private gallery data is used.
 */
export const sharedModelPage = onRequest({
  region: "europe-west3", maxInstances: 3, invoker: "public",
  timeoutSeconds: 30, memory: "256MiB",
}, async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.set("Allow", "GET, HEAD").status(405).send("Method not allowed");
    return;
  }
  const imageRequest = request.path.startsWith("/_model-preview/");
  const id = request.path.replace(/^\/_model-preview\//, "")
    .replace(/^\//, "").replace(/\/$/, "");
  if (!uuid.test(id)) {
    response.status(404).send("Model not found");
    return;
  }
  try {
    const documentUrl = "https://firestore.googleapis.com/v1/projects/" +
      "strange-animals-web/databases/(default)/documents/sharedModels/" + id;
    const document = await fetch(documentUrl, {
      signal: AbortSignal.timeout(8000),
    });
    if (document.status === 404 || document.status === 403) {
      response.status(404).send("Model not found");
      return;
    }
    if (!document.ok) throw Error("Model metadata unavailable");
    const data = await document.json() as {
      fields?: Record<string, {stringValue?: string; integerValue?: string}>;
    };
    const fields = data.fields;
    const title = fields?.title?.stringValue;
    const owner = fields?.ownerUid?.stringValue;
    if (fields?.visibility?.stringValue !== "public" ||
        !title || title.length > 120 ||
        !owner || !/^[A-Za-z0-9_-]{1,128}$/.test(owner)) {
      response.status(404).send("Model not found");
      return;
    }
    response.set("Cache-Control", "public, max-age=0, s-maxage=60");
    if (imageRequest) {
      const path = `media/public/shared-models/${owner}/${id}/preview.png`;
      const imageUrl = "https://firebasestorage.googleapis.com/v0/b/" +
        `${bucket}/o/${encodeURIComponent(path)}?alt=media`;
      const image = await fetch(imageUrl, {
        signal: AbortSignal.timeout(8000),
      });
      if (image.status === 404) {
        response.redirect(302, fallbackImage);
        return;
      }
      if (!image.ok ||
          !image.headers.get("content-type")?.startsWith("image/png")) {
        throw Error("Preview unavailable");
      }
      const bytes = Buffer.from(await image.arrayBuffer());
      if (bytes.length > 5 * 1024 * 1024) throw Error("Preview too large");
      response.set("Content-Type", "image/png")
        .set("X-Content-Type-Options", "nosniff").send(bytes);
      return;
    }
    // This static shell is produced by the same Vite build as the releases.
    // Fetch a fixed Hosting asset, never the current route (avoids recursion).
    const shell = await fetch(`${origin}/route-meta/model-shell.html`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!shell.ok) throw Error("Model page unavailable");
    const metadata = modelPageMetadata(id, title);
    const html = applyModelMetadata(await shell.text(), metadata);
    response.type("html").send(html);
  } catch (error) {
    console.error("[sharedModelPage] unavailable", {id, error});
    response.set("Cache-Control", "no-store").status(503)
      .send("Model preview temporarily unavailable");
  }
});
