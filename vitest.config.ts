import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Mirrors the path aliases of server/tsconfig.json. Only the backend is tested here.
export default defineConfig({
  resolve: {
    alias: {
      "@shared": at("./server/shared"),
      "@modules": at("./server/modules"),
      "@contract": at("./contract"),
    },
  },
  test: {
    environment: "node",
    include: ["server/tests/**/*.test.ts"],
  },
});
