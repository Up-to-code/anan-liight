import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { toSpacetimeTableName } from "../src/lib/spacetime/table-name";
import { CORE_TABLE_DEFINITIONS } from "../src/tables/index";

const MODULE_DIR = "spacetimedb";
const MODULE_SRC_FILE = "src/index.ts";

const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function renderTableKey(tableName: string): string {
  return IDENTIFIER_REGEX.test(tableName) ? tableName : JSON.stringify(tableName);
}

function renderModuleSource(tableNames: string[]): string {
  const tableBlocks = tableNames
    .map((tableName) => {
      const key = renderTableKey(tableName);
      return `    ${key}: table(\n      { public: false },\n      genericRow\n    ),`;
    })
    .join("\n");
  return `import { schema, table, t } from "spacetimedb/server";

const genericRow = {
  id: t.string(),
  payloadJson: t.string(),
  version: t.string(),
  createdAt: t.string(),
  updatedAt: t.string()
};

const spacetimedb = schema({
${tableBlocks}
});

export default spacetimedb;

export const init = spacetimedb.init(() => {
  // Module bootstrap lifecycle hook.
});

export const onConnect = spacetimedb.clientConnected(() => {
  // Connection lifecycle hook.
});

export const onDisconnect = spacetimedb.clientDisconnected(() => {
  // Disconnection lifecycle hook.
});
`;
}

export function syncSpacetimeModuleSchema(rootDir: string = process.cwd()): string {
  const tableNames = CORE_TABLE_DEFINITIONS.map((definition) => toSpacetimeTableName(definition.tableName));
  const source = renderModuleSource(tableNames);
  const modulePath = resolve(rootDir, MODULE_DIR);
  const srcPath = resolve(modulePath, "src");
  const targetFile = resolve(modulePath, MODULE_SRC_FILE);
  mkdirSync(srcPath, { recursive: true });
  writeFileSync(targetFile, source, "utf-8");
  return targetFile;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const output = syncSpacetimeModuleSchema();
  console.log(`[sync-module] wrote schema module to ${output}`);
}
