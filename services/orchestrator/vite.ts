import { type Express } from "express";
import type { PluginOption } from "vite";
import { type Server } from "http";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import react from "@vitejs/plugin-react";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { createRequire } from "module";
import { pathToFileURL } from "url";

export async function setupVite(server: Server, app: Express) {
  const rootDir = path.resolve(import.meta.dirname, "..", "..");

  let viteModule: any = await import("vite");
  let createViteServer = viteModule.createServer ?? viteModule.default?.createServer;

  if (!createViteServer) {
    const require = createRequire(import.meta.url);
    const vitePkgPath = require.resolve("vite/package.json");
    const viteDir = path.dirname(vitePkgPath);
    const nodeEntry = path.join(viteDir, "dist", "node", "index.js");
    viteModule = await import(pathToFileURL(nodeEntry).href);
    createViteServer = viteModule.createServer ?? viteModule.default?.createServer;
  }

  if (!createViteServer) {
    throw new Error("Vite createServer export not found. Check Vite installation.");
  }

  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const plugins: PluginOption[] = [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) => m.cartographer()),
          await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
        ]
      : []),
  ];

  const webRoot = path.resolve(rootDir, "apps", "web");

  const vite = await createViteServer({
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(webRoot, "src"),
        "@shared": path.resolve(rootDir, "shared"),
        "@assets": path.resolve(rootDir, "attached_assets"),
        "@packages/core": path.resolve(rootDir, "packages", "core"),
      },
    },
    root: webRoot,
    build: {
      outDir: path.resolve(rootDir, "dist/public"),
      emptyOutDir: true,
    },
    css: {
      postcss: rootDir,
    },
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "web",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
