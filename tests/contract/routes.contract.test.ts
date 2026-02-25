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
  process.env["WHATSAPP_VERIFY_TOKEN"] = "contract-token-123456";

  const context = await createApp();
  app = context.app;
});

afterAll(async () => {
  await app.close();
});

describe("route contracts", () => {
  describe("health", () => {
    test("GET /health/live returns ok", async () => {
      const response = await app.inject({ method: "GET", url: "/health/live" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    });

    test("GET /health/ready returns readiness with checks", async () => {
      const response = await app.inject({ method: "GET", url: "/health/ready" });
      expect([200, 503]).toContain(response.statusCode);
      const body = response.json() as { ready: boolean; checks: Record<string, string> };
      expect(body).toHaveProperty("ready");
      expect(body).toHaveProperty("checks");
      expect(body.checks).toHaveProperty("store");
      expect(body.checks).toHaveProperty("queue");
    });
  });

  describe("chat", () => {
    test("POST /api/chat rejects missing auth for non-anonymous user", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { message: "hello", userId: "user-1" }
      });
      expect(response.statusCode).toBe(401);
    });

    test("POST /api/chat rejects invalid payload", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/chat",
        payload: { userId: "anon-1" }
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe("webhook whatsapp", () => {
    test("GET /api/webhook/whatsapp requires challenge", async () => {
      const response = await app.inject({ method: "GET", url: "/api/webhook/whatsapp" });
      expect(response.statusCode).toBe(400);
    });

    test("GET /api/webhook/whatsapp returns challenge when mode and challenge present", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/webhook/whatsapp",
        query: { "hub.mode": "subscribe", "hub.challenge": "challenge-123", "hub.verify_token": "contract-token-123456" }
      });
      expect(response.statusCode).toBe(200);
      expect(response.payload).toBe("challenge-123");
    });

    test("GET /api/webhook/whatsapp returns 403 on verify token mismatch", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/webhook/whatsapp",
        query: { "hub.mode": "subscribe", "hub.challenge": "challenge-123", "hub.verify_token": "wrong-token" }
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe("partner", () => {
    test("POST /api/partner/properties rejects without auth", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/partner/properties",
        payload: { key: "test", value: "val" }
      });
      expect(response.statusCode).toBe(401);
    });

    test("POST /api/partner/properties rejects invalid payload", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/partner/properties",
        headers: { Authorization: "Bearer x", "x-admin-role": "admin" },
        payload: { partnerId: "p1", title: "t" }
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe("test routes", () => {
    test("POST /api/test/column requires admin", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/test/column"
      });
      expect(response.statusCode).toBe(401);
    });

    test("POST /api/test/column returns ok with admin headers", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/test/column",
        headers: { "x-admin-role": "admin", "x-user-id": "test-admin" }
      });
      expect(response.statusCode).toBe(200);
      expect((response.json() as { status?: string }).status).toBe("ok");
    });

    test("POST /api/test/agent-reply requires admin", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/test/agent-reply",
        payload: { message: "hi" }
      });
      expect(response.statusCode).toBe(401);
    });

    test("POST /api/test/agent-reply rejects missing message", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/test/agent-reply",
        headers: { "x-admin-role": "admin", "x-user-id": "test-admin" },
        payload: {}
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
