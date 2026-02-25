import eslint from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import boundaries from "eslint-plugin-boundaries";

export default [
  eslint.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.typecheck.json",
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
      boundaries
    },
    settings: {
      "boundaries/elements": [
        { type: "api", pattern: "src/api/**" },
        { type: "modules", pattern: "src/modules/**" },
        { type: "agents", pattern: "src/agents/**" },
        { type: "workflows", pattern: "src/workflows/**" },
        { type: "lib", pattern: "src/lib/**" },
        { type: "types", pattern: "src/types/**" }
      ]
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "import/no-default-export": "error",
      "import/no-cycle": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "api", allow: ["modules", "types"] },
            { from: "modules", allow: ["agents", "workflows", "lib", "types"] },
            { from: "agents", allow: ["lib", "types"] },
            { from: "workflows", allow: ["lib", "types"] },
            { from: "lib", allow: ["types"] },
            { from: "types", allow: ["types"] }
          ]
        }
      ]
    }
  },
  {
    files: ["src/api/server.ts"],
    rules: {
      "import/no-default-export": "off"
    }
  }
];
