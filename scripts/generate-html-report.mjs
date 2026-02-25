#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const reportPath = join(__dirname, "..", "test-results", "report.json");
const htmlPath = join(__dirname, "..", "test-results", "report.html");

let data;
try {
  data = JSON.parse(readFileSync(reportPath, "utf-8"));
} catch (e) {
  console.error("No report.json found. Run npm test first.");
  process.exit(1);
}

const passed = data.numPassedTests ?? 0;
const failed = data.numFailedTests ?? 0;
const total = data.numTotalTests ?? 0;
const files = Array.isArray(data.testResults) ? data.testResults.length : 0;
const duration = data.testResults?.reduce((sum, r) => sum + (r.endTime - r.startTime), 0) ?? 0;

function escape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(file, tests) {
  const items = tests
    .map(
      (t) =>
        `<tr class="${t.status}"><td>${escape(t.title)}</td><td>${t.status}</td><td>${(t.duration ?? 0).toFixed(0)}ms</td></tr>`
    )
    .join("");
  return `<div class="file"><h3>${escape(file)}</h3><table><thead><tr><th>Test</th><th>Status</th><th>Duration</th></tr></thead><tbody>${items}</tbody></table></div>`;
}

const fileBlocks =
  data.testResults?.map((r) =>
    row(
      r.name,
      r.assertionResults?.map((a) => ({
        title: (a.ancestorTitles?.join(" > ") + " " + a.title).trim() || a.title,
        status: a.status,
        duration: a.duration
      })) ?? []
    )
  ) ?? [];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Test Report - anan-liight</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 2rem; background: #0d1117; color: #c9d1d9; }
    h1 { color: #58a6ff; }
    .summary { display: flex; gap: 1.5rem; margin: 1rem 0 2rem; flex-wrap: wrap; }
    .badge { padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; }
    .badge.passed { background: #238636; color: #fff; }
    .badge.failed { background: #da3633; color: #fff; }
    .badge.total { background: #30363d; color: #c9d1d9; }
    .file { margin: 2rem 0; padding: 1rem; background: #161b22; border-radius: 8px; }
    .file h3 { color: #8b949e; font-size: 0.9rem; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #30363d; }
    th { color: #8b949e; font-weight: 500; }
    tr.passed td:first-child { color: #3fb950; }
    tr.failed td:first-child { color: #f85149; }
    tr.failed { background: rgba(248,81,73,0.1); }
  </style>
</head>
<body>
  <h1>anan-liight Test Report</h1>
  <div class="summary">
    <span class="badge passed">Passed: ${passed}</span>
    <span class="badge failed">Failed: ${failed}</span>
    <span class="badge total">Total: ${total}</span>
    <span class="badge total">Files: ${files}</span>
    <span class="badge total">Duration: ${(duration / 1000).toFixed(2)}s</span>
  </div>
  ${fileBlocks.join("\n")}
</body>
</html>`;

writeFileSync(htmlPath, html, "utf-8");
console.log(`HTML report written to ${htmlPath}`);
