#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const OUT_DIR = resolve(ROOT, "test-results");
const OUT_FILE = resolve(OUT_DIR, "full-validation-report.html");
const VITEST_JSON = resolve(OUT_DIR, "report.json");

const STEPS = [
  { name: "Lint", command: ["npm", "run", "lint"] },
  { name: "Typecheck", command: ["npm", "run", "typecheck"] },
  { name: "Build", command: ["npm", "run", "build"] },
  { name: "Tests + HTML", command: ["npm", "run", "test:report"] },
];

function runStep(step) {
  const startedAt = Date.now();
  const result = spawnSync(step.command[0], step.command.slice(1), {
    cwd: ROOT,
    env: process.env,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const endedAt = Date.now();
  return {
    name: step.name,
    command: step.command.join(" "),
    success: result.status === 0,
    statusCode: result.status ?? -1,
    durationMs: endedAt - startedAt,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function readVitestSummary() {
  try {
    const raw = JSON.parse(readFileSync(VITEST_JSON, "utf-8"));
    return {
      passed: raw.numPassedTests ?? 0,
      failed: raw.numFailedTests ?? 0,
      total: raw.numTotalTests ?? 0,
      files: raw.numTotalTestSuites ?? raw.testResults?.length ?? 0,
    };
  } catch {
    return null;
  }
}

const results = [];
for (const step of STEPS) {
  const result = runStep(step);
  results.push(result);
  if (!result.success) break;
}

mkdirSync(OUT_DIR, { recursive: true });
const allPassed = results.every((r) => r.success);
const totalDuration = results.reduce((sum, step) => sum + step.durationMs, 0);
const vitestSummary = readVitestSummary();

const rows = results
  .map((r) => {
    const cls = r.success ? "ok" : "fail";
    return `<tr class="${cls}">
      <td>${escapeHtml(r.name)}</td>
      <td><code>${escapeHtml(r.command)}</code></td>
      <td>${r.success ? "PASS" : "FAIL"}</td>
      <td>${r.statusCode}</td>
      <td>${(r.durationMs / 1000).toFixed(2)}s</td>
    </tr>`;
  })
  .join("\n");

const logs = results
  .map(
    (r) => `<section class="logs">
  <h3>${escapeHtml(r.name)} Output</h3>
  <pre>${escapeHtml((r.stdout + "\n" + r.stderr).trim() || "(no output)")}</pre>
</section>`,
  )
  .join("\n");

const vitestBlock = vitestSummary
  ? `<div class="summary-line">Tests: ${vitestSummary.passed}/${vitestSummary.total} passed, failed: ${vitestSummary.failed}, files: ${vitestSummary.files}</div>`
  : `<div class="summary-line">Tests: summary unavailable (report.json missing)</div>`;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ANAN-LIIGHT Full Validation Report</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 24px; }
    h1 { margin: 0 0 8px; }
    .summary-line { margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #334155; padding: 10px; text-align: left; }
    th { background: #1e293b; }
    tr.ok { background: #052e16; }
    tr.fail { background: #450a0a; }
    pre { background: #020617; border: 1px solid #334155; border-radius: 6px; padding: 12px; overflow: auto; white-space: pre-wrap; }
    code { color: #93c5fd; }
    .logs { margin-top: 20px; }
  </style>
</head>
<body>
  <h1>ANAN-LIIGHT Full Validation Report</h1>
  <div class="summary-line">Status: <strong>${allPassed ? "PASS" : "FAIL"}</strong></div>
  <div class="summary-line">Generated: ${new Date().toISOString()}</div>
  <div class="summary-line">Total duration: ${(totalDuration / 1000).toFixed(2)}s</div>
  ${vitestBlock}
  <div class="summary-line">Detailed test report: <code>${escapeHtml(resolve(OUT_DIR, "report.html"))}</code></div>
  <table>
    <thead>
      <tr><th>Step</th><th>Command</th><th>Result</th><th>Exit</th><th>Duration</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${logs}
</body>
</html>`;

writeFileSync(OUT_FILE, html, "utf-8");
console.log(`Full validation report written to ${OUT_FILE}`);
process.exit(allPassed ? 0 : 1);
