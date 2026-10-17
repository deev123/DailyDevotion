import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { createReadStream, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

// Serve and bundle PDF.js support files locally, including fonts and image decoders.
function pdfAssets(): Plugin {
  const root = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
  const directories = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];
  return {
    name: 'pdf-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        const match = pathname.match(/\/pdf-assets\/(cmaps|standard_fonts|wasm|iccs)\/([\w.-]+)$/);
        if (!match || !readdirSync(join(root, match[1])).includes(match[2])) return next();
        res.setHeader('Content-Type', match[2].endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
        createReadStream(join(root, match[1], match[2])).pipe(res);
      });
    },
    generateBundle() {
      for (const directory of directories) {
        for (const file of readdirSync(join(root, directory), { withFileTypes: true })) {
          if (file.isFile()) this.emitFile({
            type: 'asset',
            fileName: `pdf-assets/${directory}/${file.name}`,
            source: readFileSync(join(root, directory, file.name)),
          });
        }
      }
      this.emitFile({ type: 'asset', fileName: 'pdf-assets/LICENSE', source: readFileSync(join(root, 'LICENSE')) });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: "/DailyDevotion/", // github pages cant find resources if you dont specify this
  plugins: [react(), pdfAssets()],
})
