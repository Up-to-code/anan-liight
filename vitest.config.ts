import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@api": fromRoot("./src/api"),
      "@modules": fromRoot("./src/modules"),
      "@agents": fromRoot("./src/agents"),
      "@workflows": fromRoot("./src/workflows"),
      "@lib": fromRoot("./src/lib"),
      "@tables": fromRoot("./src/tables"),
      "@shared": fromRoot("./src/types")
    }
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globals: true,
    environment: "node",
    reporters:
      process.env["GENERATE_REPORT"] === "1"
        ? (["default", "json"] as const)
        : ["default"],
    outputFile:
      process.env["GENERATE_REPORT"] === "1"
        ? { json: "test-results/report.json" }
        : undefined,
    coverage: {
      enabled: false
    }
  }
});
