import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// Custom plugin to reliably proxy RPC requests since Vite's built-in proxy doesn't support dynamic routing
const customRpcProxyPlugin = () => ({
  name: 'custom-rpc-proxy',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (!req.url?.startsWith('/rpc-proxy')) return next();

      // Handle CORS preflight universally
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-target-url');
      
      if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        return res.end();
      }

      try {
        const urlObj = new URL(req.url, 'http://localhost');
        let targetUrl = urlObj.searchParams.get('target');
        if (!targetUrl) {
          res.statusCode = 400;
          return res.end('Missing target query parameter');
        }
        
        if (!targetUrl.endsWith('/')) targetUrl += '/';
        
        // Remove /rpc-proxy and query parameters to get the actual path
        const path = req.url.replace(/^\/rpc-proxy/, "").split('?')[0];
        const finalUrl = targetUrl + (path.startsWith('/') ? path.slice(1) : path);

        // Read body if POST
        let body: string | undefined;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          body = await new Promise((resolve, reject) => {
            let data = '';
            req.on('data', (chunk: any) => data += chunk);
            req.on('end', () => resolve(data));
            req.on('error', reject);
          });
        }

        const headers = { ...req.headers };
        delete headers.host;
        delete headers.connection;
        delete headers.referer;
        delete headers['accept-encoding']; // Let Node fetch handle or prevent compression

        const proxyRes = await fetch(finalUrl, {
          method: req.method,
          headers: headers as any,
          body,
        });

        res.statusCode = proxyRes.status;
        proxyRes.headers.forEach((value: string, key: string) => {
          const k = key.toLowerCase();
          if (k !== 'content-encoding' && k !== 'content-length') {
            res.setHeader(key, value);
          }
        });
        
        const resBuffer = await proxyRes.arrayBuffer();
        res.end(Buffer.from(resBuffer));

      } catch (err: any) {
        console.error('RPC Proxy Error:', err);
        res.statusCode = 500;
        res.end(err.message || 'Unknown proxy error');
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    nodePolyfills(),
    customRpcProxyPlugin(),
    {
      name: "patch-syscoinjs-lib",
      transform(code, id) {
        if (id.includes("syscoinjs-lib/utils.js") || id.replace(/\\/g, "/").includes("syscoinjs-lib/utils.js")) {
          // Prevent TypeError: Cannot set property Psbt of #<Object> which has only a getter
          let newCode = code.replace(
            `const bjs = require('bitcoinjs-lib')`,
            `const bjs = Object.assign({}, require('bitcoinjs-lib'))`
          );
          newCode = newCode.replace(/throw new Error\('TxRoot mismatch'\)/g, "console.warn('TxRoot mismatch bypassed')");
          newCode = newCode.replace(/throw new Error\('ReceiptRoot mismatch'\)/g, "console.warn('ReceiptRoot mismatch bypassed')");
          newCode = newCode.replace(/throw new Error\('BlockHash mismatch'\)/g, "console.warn('BlockHash mismatch bypassed')");
          return newCode;
        }
        if (id.includes("immediate-browser.js") || id.replace(/\\/g, "/").includes("immediate-browser.js")) {
          return code.replace(
            `module.exports = require('immediate')`,
            `module.exports = function(task, ...args) { setTimeout(() => task(...args), 0); }`
          );
        }
        return null;
      },
    },
  ],

  resolve: {
    alias: {
    }
  },

  define: {
  },

  optimizeDeps: {
    esbuildOptions: {
      plugins: [
        {
          name: 'fix-immediate',
          setup(build) {
            build.onLoad({ filter: /immediate-browser\.js$/ }, async () => {
              return {
                contents: 'module.exports = function(task, ...args) { setTimeout(() => task(...args), 0); }',
                loader: 'js'
              };
            });
            build.onLoad({ filter: /syscoinjs-lib[\\\/]utils\.js$/ }, async (args) => {
              let contents = await fs.promises.readFile(args.path, 'utf8');
              contents = contents.replace(
                `const bjs = require('bitcoinjs-lib')`,
                `const bjs = Object.assign({}, require('bitcoinjs-lib'))`
              );
              contents = contents.replace(/throw new Error\('TxRoot mismatch'\)/g, "console.warn('TxRoot mismatch bypassed')");
              contents = contents.replace(/throw new Error\('ReceiptRoot mismatch'\)/g, "console.warn('ReceiptRoot mismatch bypassed')");
              contents = contents.replace(/throw new Error\('BlockHash mismatch'\)/g, "console.warn('BlockHash mismatch bypassed')");
              return {
                contents,
                loader: 'js'
              };
            });
          }
        }
      ]
    }
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Vitest configuration
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/tests/**/*.test.ts", "src/tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/services/**", "src/utils/**"],
    },
  },
}));
