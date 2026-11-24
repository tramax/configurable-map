import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Mirrors the `@contract` path alias of tsconfig.json: code shared with the server.
  resolve: { alias: { "@contract": fileURLToPath(new URL("./contract", import.meta.url)) } },
  server: {
    // Forward API calls to the Hono server (pnpm run dev:server) so the session cookie stays same-origin.
    proxy: { "/api": "http://localhost:3001" },
  },
});
