import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to the Hono server (pnpm run dev:server) so the session cookie stays same-origin.
    proxy: { "/api": "http://localhost:3001" },
  },
});
