import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const SDK_URL = "/static/anna-apps/_sdk/latest/index.js";

/**
 * Fontsource ships every face as woff2 + woff. Every browser that can run
 * Anna supports woff2, so drop the woff copies to halve the bundle's file count.
 */
function woff2Only(): Plugin {
  return {
    name: "wishcraft:woff2-only",
    apply: "build",
    generateBundle(_opts, bundle) {
      for (const [name, chunk] of Object.entries(bundle)) {
        if (name.endsWith(".woff")) delete bundle[name];
        if (chunk.type === "asset" && name.endsWith(".css") && typeof chunk.source === "string") {
          chunk.source = chunk.source.replace(/,\s*url\([^)]*?\.woff\)\s*format\(["']woff["']\)/g, "");
        }
      }
    },
  };
}

export default defineConfig({
  root: "web",
  base: "./",
  plugins: [react(), tailwindcss(), woff2Only()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "web/src") },
  },
  build: {
    outDir: "../bundle",
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
    rollupOptions: { external: [SDK_URL] },
  },
  test: {
    root: ".",
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    alias: { [SDK_URL]: path.resolve(__dirname, "tests/sdk-stub.ts") },
  },
});
