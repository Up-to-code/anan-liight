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
  process.env["FEATURE_ADMIN_DESTRUCTIVE_ACTIONS"] = "true";

  const context = await createApp();
  app = context.app;
});

afterAll(async () => {
  await app.close();
});

describe("admin routes", () => {
  test("rejects non-admin access", async () => {
    const response = await app.inject({ method: "GET", url: "/api/admin/overview" });
    expect(response.statusCode).toBe(401);
  });

  test("returns csrf token for admin", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/csrf",
      headers: { "x-admin-role": "admin" }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { csrfToken: string };
    expect(body.csrfToken.length).toBeGreaterThan(10);
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  test("blocks write without csrf header", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/whatsapp/templates",
      headers: {
        "x-admin-role": "admin"
      },
      payload: {
        name: "Promo",
        language: "en",
        category: "marketing",
        body: "Hello"
      }
    });

    expect(response.statusCode).toBe(403);
  });
});
