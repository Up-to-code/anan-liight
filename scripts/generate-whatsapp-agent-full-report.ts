import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FullGateResult } from "../tests/whatsapp/types";

function readResult(path: string): FullGateResult | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as FullGateResult;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function statusBadge(passed: boolean): string {
  return `<span class="badge ${passed ? "ok" : "fail"}">${passed ? "PASS" : "FAIL"}</span>`;
}

function metricRow(labelAr: string, labelEn: string, valueDev: string, valueProd: string): string {
  return `<tr><td>${labelAr}</td><td>${labelEn}</td><td>${valueDev}</td><td>${valueProd}</td></tr>`;
}

function failureRows(result: FullGateResult | null): string {
  if (!result || result.failures.length === 0) {
    return "<tr><td colspan=\"3\">No failures</td></tr>";
  }
  return result.failures
    .slice(0, 30)
    .map((item) => `<tr><td>${item.scenarioId}</td><td>${item.code}</td><td>${item.detail}</td></tr>`)
    .join("\n");
}

function chartBar(label: string, value: number): string {
  const width = Math.max(0, Math.min(100, Math.round(value * 100)));
  return `<div class="bar-row"><span>${label}</span><div class="bar"><i style="width:${width}%"></i></div><strong>${pct(value)}</strong></div>`;
}

function emptyResult(profile: "dev" | "prod"): FullGateResult {
  return {
    fullGateVersion: "v1",
    generatedAt: new Date(0).toISOString(),
    profile,
    summary: { passed: false, totalScenarios: 0, passedScenarios: 0, failedScenarios: 0 },
    routingCompliance: 0,
    responseContractCompliance: 0,
    voiceDecisionCompliance: 0,
    searchQuality: { sourceDiversity: 0, detailCoverageTop3: 0, imageCoverageTop3: 0, noveltyScore: 0 },
    tokenModel: { averageTokensPerTurn: 0, p95TokensPerTurn: 0, freeModelUsageCount: 0, model: "unknown" },
    delivery: {
      normalSearchMaxMessagesPassRate: 0,
      detailGalleryPolicyPassRate: 0,
      linkSuppressionPassRate: 0,
      competitorMaskPassRate: 0
    },
    latency: { p95TurnMs: 0, p95WebhookDispatchMs: 0 },
    failures: [],
    stageResults: []
  };
}

function render(): string {
  const outDir = resolve(process.cwd(), "test-results");
  const dev = readResult(resolve(outDir, "whatsapp-agent-full-gate.dev.json")) ?? emptyResult("dev");
  const prod = readResult(resolve(outDir, "whatsapp-agent-full-gate.prod.json")) ?? emptyResult("prod");

  const generatedAt = new Date().toISOString();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ANAN WhatsApp Full Gate Report</title>
  <style>
    body { font-family: 'Cairo', Arial, sans-serif; margin: 24px; background: #f8fafc; color: #0f172a; }
    .head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
    .badge { padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; }
    .badge.ok { background:#dcfce7; color:#166534; }
    .badge.fail { background:#fee2e2; color:#991b1b; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; margin:18px 0; }
    .card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; }
    h1,h2,h3 { margin: 0 0 8px; }
    table { width:100%; border-collapse: collapse; background:#fff; }
    th,td { border:1px solid #e2e8f0; padding:8px; text-align:left; vertical-align:top; }
    th { background:#f1f5f9; }
    .bar-row { display:grid; grid-template-columns: 120px 1fr 60px; gap:8px; align-items:center; margin:8px 0; }
    .bar { background:#e2e8f0; border-radius:999px; overflow:hidden; height:10px; }
    .bar i { display:block; height:10px; background:#0ea5e9; }
    .small { color:#475569; font-size: 13px; }
    .two { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  </style>
</head>
<body>
  <div class="head">
    <div>
      <h1>ANAN WhatsApp Full Validation Report</h1>
      <div class="small">Generated: ${generatedAt}</div>
      <div class="small">Arabic executive summary + English technical details</div>
    </div>
    <div>
      <div>Dev ${statusBadge(dev.summary.passed)}</div>
      <div style="margin-top:8px;">Prod ${statusBadge(prod.summary.passed)}</div>
    </div>
  </div>

  <div class="card" dir="rtl" lang="ar">
    <h2>الملخص التنفيذي</h2>
    <p>هذا التقرير يوضح جاهزية وكفاءة وكيل واتساب عبر بيئة التطوير والإنتاج، مع فحص شامل للتوجيه، جودة المخرجات، سياسة الإرسال، جودة البحث، الأداء، وسياسة النماذج.</p>
    <ul>
      <li>نجاح التطوير: ${dev.summary.passed ? "ناجح" : "يوجد إخفاقات"}</li>
      <li>نجاح الإنتاج: ${prod.summary.passed ? "ناجح" : "يوجد إخفاقات"}</li>
      <li>نسبة الالتزام بتوجيه الأدوات (Dev/Prod): ${pct(dev.routingCompliance)} / ${pct(prod.routingCompliance)}</li>
      <li>التزام صيغة الرد (Dev/Prod): ${pct(dev.responseContractCompliance)} / ${pct(prod.responseContractCompliance)}</li>
    </ul>
  </div>

  <div class="grid">
    <div class="card">
      <h3>Dev Gate</h3>
      ${chartBar("Routing", dev.routingCompliance)}
      ${chartBar("Contract", dev.responseContractCompliance)}
      ${chartBar("Voice", dev.voiceDecisionCompliance)}
      ${chartBar("WA Max-3", dev.delivery.normalSearchMaxMessagesPassRate)}
    </div>
    <div class="card">
      <h3>Prod Gate</h3>
      ${chartBar("Routing", prod.routingCompliance)}
      ${chartBar("Contract", prod.responseContractCompliance)}
      ${chartBar("Voice", prod.voiceDecisionCompliance)}
      ${chartBar("WA Max-3", prod.delivery.normalSearchMaxMessagesPassRate)}
    </div>
  </div>

  <h2>Comparison Matrix</h2>
  <table>
    <thead><tr><th>Arabic</th><th>English</th><th>Dev</th><th>Prod</th></tr></thead>
    <tbody>
      ${metricRow("حالة البوابة", "Gate status", dev.summary.passed ? "PASS" : "FAIL", prod.summary.passed ? "PASS" : "FAIL")}
      ${metricRow("عدد السيناريوهات", "Total scenarios", String(dev.summary.totalScenarios), String(prod.summary.totalScenarios))}
      ${metricRow("التوجيه", "Routing compliance", pct(dev.routingCompliance), pct(prod.routingCompliance))}
      ${metricRow("صيغة الرد", "Response contract", pct(dev.responseContractCompliance), pct(prod.responseContractCompliance))}
      ${metricRow("تأكيد الصوت", "Voice decision", pct(dev.voiceDecisionCompliance), pct(prod.voiceDecisionCompliance))}
      ${metricRow("تنوع المصادر", "Source diversity", String(dev.searchQuality.sourceDiversity), String(prod.searchQuality.sourceDiversity))}
      ${metricRow("تغطية التفاصيل", "Detail coverage", pct(dev.searchQuality.detailCoverageTop3), pct(prod.searchQuality.detailCoverageTop3))}
      ${metricRow("تغطية الصور", "Image coverage", pct(dev.searchQuality.imageCoverageTop3), pct(prod.searchQuality.imageCoverageTop3))}
      ${metricRow("النتائج الجديدة", "Novelty", pct(dev.searchQuality.noveltyScore), pct(prod.searchQuality.noveltyScore))}
      ${metricRow("متوسط التوكن", "Avg tokens/turn", String(dev.tokenModel.averageTokensPerTurn), String(prod.tokenModel.averageTokensPerTurn))}
      ${metricRow("P95 التوكن", "P95 tokens/turn", String(dev.tokenModel.p95TokensPerTurn), String(prod.tokenModel.p95TokensPerTurn))}
      ${metricRow("نموذج أساسي", "Primary model", dev.tokenModel.model, prod.tokenModel.model)}
      ${metricRow("P95 زمن الدور", "P95 turn latency (ms)", String(dev.latency.p95TurnMs), String(prod.latency.p95TurnMs))}
      ${metricRow("P95 زمن الويب هوك", "P95 webhook dispatch (ms)", String(dev.latency.p95WebhookDispatchMs), String(prod.latency.p95WebhookDispatchMs))}
    </tbody>
  </table>

  <div class="two" style="margin-top:18px;">
    <div>
      <h2>Dev Failure Clusters</h2>
      <table>
        <thead><tr><th>Scenario</th><th>Code</th><th>Detail</th></tr></thead>
        <tbody>${failureRows(dev)}</tbody>
      </table>
    </div>
    <div>
      <h2>Prod Failure Clusters</h2>
      <table>
        <thead><tr><th>Scenario</th><th>Code</th><th>Detail</th></tr></thead>
        <tbody>${failureRows(prod)}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

function main(): void {
  const outDir = resolve(process.cwd(), "test-results");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "whatsapp-agent-full-report.html");
  writeFileSync(outPath, render(), "utf-8");
  console.log(`WhatsApp full report written to ${outPath}`);
}

main();
