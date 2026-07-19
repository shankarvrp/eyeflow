import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const envDir = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, envDir, ""));

  return {
    envDir,
    optimizeDeps: { exclude: ["playwright"] },
    resolve: { tsconfigPaths: true },
    ssr: { external: ["playwright"] },
    plugins: [tailwindcss(), tanstackStart(), viteReact()],
  };
});
