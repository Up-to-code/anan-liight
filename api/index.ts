import type { IncomingMessage, ServerResponse } from "node:http";

interface AppContext {
  app: {
    ready(): Promise<void>;
    server: {
      emit(event: "request", req: IncomingMessage, res: ServerResponse): boolean;
    };
  };
}

let appContextPromise: Promise<AppContext> | null = null;
let startupError: unknown = null;

function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  const base: Record<string, unknown> = {
    name: error.name,
    message: error.message
  };

  if ("code" in error && typeof (error as { code?: unknown }).code !== "undefined") {
    base.code = (error as { code?: unknown }).code;
  }

  if ("issues" in error && Array.isArray((error as { issues?: unknown }).issues)) {
    base.issues = (error as { issues: unknown[] }).issues;
  }

  return base;
}

async function getAppContext(): Promise<AppContext> {
  if (startupError) {
    throw startupError;
  }

  if (!appContextPromise) {
    // Vercel functions are ephemeral; disable background loops by default.
    if (process.env.VERCEL && process.env.FEATURE_LLIGHT_BACKGROUND_JOBS_ENABLED === undefined) {
      process.env.FEATURE_LLIGHT_BACKGROUND_JOBS_ENABLED = "false";
    }

    appContextPromise = import("../dist/api/app.js")
      .then(async ({ createApp }) => createApp())
      .then(async (ctx) => {
        await ctx.app.ready();
        return ctx;
      })
      .catch((error: unknown) => {
        startupError = error;
        throw error;
      });
  }

  return appContextPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const { app } = await getAppContext();
    app.server.emit("request", req, res);
  } catch (error) {
    const payload = {
      error: "startup_failed",
      detail: serializeError(error)
    };
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
  }
}
