import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

<<<<<<< HEAD
const isReplit = process.env.REPL_ID !== undefined;

export default defineConfig(async () => {
  const plugins = [react()];

  if (isReplit) {
    try {
      const { runtimeErrorModal } = await import("@replit/vite-plugin-runtime-error-modal");
      plugins.push(runtimeErrorModal());
    } catch (e) {}

    if (process.env.NODE_ENV !== "production") {
      try {
        const { cartographer } = await import("@replit/vite-plugin-cartographer");
        const { devBanner } = await import("@replit/vite-plugin-dev-banner");
        plugins.push(cartographer(), devBanner());
      } catch (e) {}
    }
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
=======
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
>>>>>>> 5bb0ffc83975cd73d0751d6958c38a1c824f3e93
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
