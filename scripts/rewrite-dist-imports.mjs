import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const distRoot = path.join(projectRoot, "dist");

const aliasToDir = new Map([
  ["@api/", "api"],
  ["@modules/", "modules"],
  ["@agents/", "agents"],
  ["@workflows/", "workflows"],
  ["@lib/", "lib"],
  ["@tables/", "tables"],
  ["@shared/", "types"]
]);

const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".js")) {
      files.push(fullPath);
    }
  }
}

function resolveTarget(specifier) {
  for (const [alias, outDir] of aliasToDir) {
    if (!specifier.startsWith(alias)) continue;
    const subPath = specifier.slice(alias.length);
    const basePath = path.join(distRoot, outDir, subPath);
    const directFile = `${basePath}.js`;
    if (fs.existsSync(directFile)) return directFile;
    const indexFile = path.join(basePath, "index.js");
    if (fs.existsSync(indexFile)) return indexFile;
    return directFile;
  }
  return null;
}

function toImportPath(fromFile, toFile) {
  let relative = path.relative(path.dirname(fromFile), toFile).replaceAll(path.sep, "/");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative;
}

walk(distRoot);

let rewrittenFiles = 0;
for (const filePath of files) {
  const source = fs.readFileSync(filePath, "utf8");
  const next = source.replace(
    /(["'])((?:@api|@modules|@agents|@workflows|@lib|@tables|@shared)\/[^"']+)\1/g,
    (match, quote, specifier) => {
      const target = resolveTarget(specifier);
      if (!target) return match;
      return `${quote}${toImportPath(filePath, target)}${quote}`;
    }
  );

  if (next !== source) {
    fs.writeFileSync(filePath, next, "utf8");
    rewrittenFiles += 1;
  }
}

console.log(`rewrite-dist-imports: updated ${rewrittenFiles} files`);
