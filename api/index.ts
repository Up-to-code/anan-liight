import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp, type AppContext } from "../src/api/app";

let appContextPromise: Promise<AppContext> | null = null;

async function getAppContext(): Promise<AppContext> {
  if (!appContextPromise) {
    // Vercel functions are ephemeral; disable background loops by default.
    if (process.env.VERCEL && process.env.FEATURE_LLIGHT_BACKGROUND_JOBS_ENABLED === undefined) {
      process.env.FEATURE_LLIGHT_BACKGROUND_JOBS_ENABLED = "false";
    }

    appContextPromise = createApp().then(async (ctx) => {
      await ctx.app.ready();
      return ctx;
    });
  }

  return appContextPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { app } = await getAppContext();
  app.server.emit("request", req, res);
}
