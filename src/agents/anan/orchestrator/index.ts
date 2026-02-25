import type { Channel } from "@shared/agent";
import { runSearchPipeline } from "@agents/anan/search/pipeline";
import { searchWebInfo } from "@agents/anan/tools/web";
import { judgeSearchCoverage } from "@agents/anan/tools/analysis";

export async function orchestrateAnanTask(input: {
  channel: Channel;
  intent: "property" | "market" | "other";
  query: string;
}): Promise<unknown> {
  if (input.intent === "property") {
    const result = await runSearchPipeline({ query: input.query });
    return {
      ...result,
      judgement: judgeSearchCoverage({
        detailCoverage: result.quality.coverage,
        imageCoverage: result.quality.imageCoverage,
        noveltyScore: result.quality.novelty,
      }),
    };
  }
  if (input.intent === "market") {
    return searchWebInfo({ query: input.query, num: 6 });
  }
  return { message: "Unsupported intent" };
}
