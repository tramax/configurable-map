import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Mirrors the path aliases of server/tsconfig.json. Backend tests live in server/tests; src/ holds unit tests of the pure map logic.
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
    include: ["server/tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
