import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const copiedFiles = ["favicon.ico", "favicon-16x16.ico", "favicon-32x32.ico"];
const routeMetadataDirectory = "route-meta";

type PageMetadata = {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
};

const odysseyDescription =
  "Strange Animals presents Odyssey Vol. 1, a compilation album consisting of a selection of tracks from various artists, showcasing a wide spectrum of sounds inspired by liquid drum n bass/jungle.";

const routeMetadata = new Map<
  string,
  PageMetadata & { outputFile: string }
>([
  [
    "/listen/sajs001cd",
    {
      title: "LISTEN | Strange Animals | Odyssey Vol. 1 [SAJS001CD]",
      description: odysseyDescription,
      image:
        "https://strangeanimals.de/media/images/releases/sajs001/cover.png",
      imageAlt: "SAJS001CD Odyssey Vol. 1 cover",
      outputFile: "listen-sajs001cd.html",
    },
  ],
  [
    "/identity/typography/fonts",
    {
      title: "FONTS | Strange Animals | Identity",
      description: "Strange Animals identity font archive.",
      image: "https://strangeanimals.de/media/images/oc/SALOGO2.png",
      imageAlt: "Strange Animals",
      outputFile: "identity-fonts.html",
    },
  ],
]);

const mimeTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".wsz": "application/octet-stream",
};

function isStaticLegacyAsset(requestPath: string) {
  return copiedFiles.some((file) => requestPath === `/${file}`);
}

function normalizeRequestPath(requestPath: string) {
  return requestPath.endsWith("/") && requestPath !== "/"
    ? requestPath.slice(0, -1)
    : requestPath;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function applyPageMetadata(html: string, metadata: PageMetadata) {
  const replacements = {
    description: metadata.description,
    "og-image": metadata.image,
    "og-image-alt": metadata.imageAlt,
    "og-title": metadata.title,
    "og-description": metadata.description,
    "twitter-title": metadata.title,
    "twitter-description": metadata.description,
    "twitter-image": metadata.image,
  };
  const withTitle = html.replace(
    /(<title data-route-meta="title">)[\s\S]*?(<\/title>)/,
    (_match, openingTag: string, closingTag: string) =>
      `${openingTag}${escapeHtml(metadata.title)}${closingTag}`,
  );

  return Object.entries(replacements).reduce(
    (currentHtml, [key, value]) =>
      currentHtml.replace(
        new RegExp(
          `(<meta\\s+data-route-meta="${key}"[^>]*\\scontent=")[^"]*("[^>]*>)`,
        ),
        (_match, openingTag: string, closingTag: string) =>
          `${openingTag}${escapeHtml(value)}${closingTag}`,
      ),
    withTitle,
  );
}

function copyStaticAssets(): Plugin {
  return {
    name: "copy-static-assets",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestPath = decodeURIComponent(
          (request.url ?? "").split("?")[0] ?? "",
        );
        const metadata = routeMetadata.get(
          normalizeRequestPath(requestPath),
        );

        if (request.method === "GET" && metadata) {
          try {
            const sourceHtml = await fs.readFile(
              path.join(rootDirectory, "index.html"),
              "utf8",
            );
            const html = await server.transformIndexHtml(
              requestPath,
              applyPageMetadata(sourceHtml, metadata),
            );

            response.statusCode = 200;
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end(html);
          } catch {
            next();
          }

          return;
        }

        if (!isStaticLegacyAsset(requestPath)) {
          next();
          return;
        }

        const filePath = path.normalize(path.join(rootDirectory, requestPath));

        if (!filePath.startsWith(rootDirectory)) {
          next();
          return;
        }

        try {
          const file = await fs.readFile(filePath);
          response.setHeader(
            "Content-Type",
            mimeTypes[path.extname(filePath).toLowerCase()] ??
              "application/octet-stream",
          );
          response.end(file);
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      const outputDirectory = path.join(rootDirectory, "dist");
      const builtIndex = await fs.readFile(
        path.join(outputDirectory, "index.html"),
        "utf8",
      );

      await fs.mkdir(path.join(outputDirectory, routeMetadataDirectory), {
        recursive: true,
      });

      await Promise.all([
        ...copiedFiles.map(async (file) => {
          await fs.copyFile(
            path.join(rootDirectory, file),
            path.join(outputDirectory, file),
          );
        }),
        ...[...routeMetadata.values()].map(async (metadata) => {
          await fs.writeFile(
            path.join(
              outputDirectory,
              routeMetadataDirectory,
              metadata.outputFile,
            ),
            applyPageMetadata(builtIndex, metadata),
          );
        }),
      ]);
    },
  };
}

export default defineConfig({
  root: ".",
  publicDir: path.join(rootDirectory, "public"),
  plugins: [react(), copyStaticAssets()],
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
