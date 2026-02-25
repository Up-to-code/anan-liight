import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../src/api/app";

let app: FastifyInstance;

beforeAll(async () => {
  process.env["NODE_ENV"] = "test";
  process.env["APP_PORT"] = "4020";
  process.env["APP_HOST"] = "127.0.0.1";
  process.env["SPACETIMEDB_HTTP_URL"] = "http://localhost:3000";
  process.env["SPACETIMEDB_WS_URL"] = "http://localhost:3001";
  process.env["SPACETIMEDB_DB_NAME"] = "anan_liight";
  process.env["OPENROUTER_API_KEY"] = "test-key";
  process.env["OPENROUTER_BASE_URL"] = "https://openrouter.ai/api/v1/chat/completions";
  process.env["OPENROUTER_PRIMARY_MODEL"] = "openai/gpt-4o";
  process.env["OPENROUTER_FALLBACK_MODEL"] = "anthropic/claude-sonnet-4.6";
  process.env["OPENROUTER_F1_MODEL"] = "moonshotai/kimi-k2-thinking";
  process.env["FEATURE_AUTH_COGNITO_ENABLED"] = "false";

  const context = await createApp();
  app = context.app;
});

afterAll(async () => {
  await app.close();
});

describe("auth route flags", () => {
  test("login route disabled when cognito feature off", async () => {
    const response = await app.inject({ method: "GET", url: "/auth/login" });
    expect(response.statusCode).toBe(404);
  });
});
