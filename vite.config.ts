import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import {defineConfig, type Plugin} from 'vite';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const copiedFiles = ['favicon.ico', 'favicon-16x16.ico', 'favicon-32x32.ico'];

const mimeTypes: Record<string, string> = {
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.wsz': 'application/octet-stream',
};

function isStaticLegacyAsset(requestPath: string) {
  return copiedFiles.some((file) => requestPath === `/${file}`);
}

function copyStaticAssets(): Plugin {
  return {
    name: 'copy-static-assets',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestPath = decodeURIComponent(
          (request.url ?? '').split('?')[0] ?? '',
        );

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
            'Content-Type',
            mimeTypes[path.extname(filePath).toLowerCase()] ??
              'application/octet-stream',
          );
          response.end(file);
        } catch {
          next();
        }
      });
    },
    async closeBundle() {
      const outputDirectory = path.join(rootDirectory, 'dist');

      await Promise.all([
        ...copiedFiles.map(async (file) => {
          await fs.copyFile(
            path.join(rootDirectory, file),
            path.join(outputDirectory, file),
          );
        }),
      ]);
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: path.join(rootDirectory, 'public'),
  plugins: [react(), copyStaticAssets()],
  resolve: {
    alias: {
      '@': path.resolve(rootDirectory, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
