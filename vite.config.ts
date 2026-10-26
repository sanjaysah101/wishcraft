import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

const SDK_URL = "/static/anna-apps/_sdk/latest/index.js";

export default defineConfig({
  root: "web",
  base: "./",
  plugins: [preact()],
  build: {
    outDir: "../bundle",
    emptyOutDir: true,
    target: "es2022",
    assetsInlineLimit: 0,
    rollupOptions: {
      external: [SDK_URL],
    },
  },
  test: {
    root: ".",
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
