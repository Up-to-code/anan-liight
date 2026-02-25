import { createApp } from "@api/app";
import { logger } from "@lib/observability/logger";

const { app, runtime } = await createApp();

const closeGracefully = async (signal: NodeJS.Signals): Promise<void> => {
  logger.warn({ signal }, "Graceful shutdown started");
  runtime.runner.stop();
  runtime.replayWorker.stop();
  await app.close();
  process.exit(0);
};

process.on("SIGTERM", () => void closeGracefully("SIGTERM"));
process.on("SIGINT", () => void closeGracefully("SIGINT"));

await app.listen({ host: runtime.env.APP_HOST, port: runtime.env.APP_PORT });
logger.info({ host: runtime.env.APP_HOST, port: runtime.env.APP_PORT }, "anan-liight booted");

export default app;
