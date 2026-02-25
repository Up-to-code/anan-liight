import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { generateReply } from "@modules/reducers/chat-reducer";
import { ROUTE_PATHS } from "@shared/constants";
import { requireAdmin } from "@api/middleware/auth";

export async function registerTestRoutes(app: FastifyInstance, runtime: RuntimeContainer): Promise<void> {
  app.post(
    ROUTE_PATHS.TEST_AGENT_REPLY,
    { preHandler: requireAdmin(runtime) },
    async (request: FastifyRequest, reply: FastifyReply) => {
    if (!runtime.env.FEATURE_LLIGHT_AGENT_RUNTIME_ENABLED) {
      reply.code(404).send({ error: "Not available" });
      return;
    }

    const body = (request.body ?? {}) as { message?: string; userId?: string };
    if (!body.message || body.message.length > 10000) {
      reply.code(400).send({ error: "message required" });
      return;
    }

    const response = await generateReply(runtime, body.message);
    reply.code(200).send({ text: response, userId: body.userId ?? "test-user" });
    }
  );

  app.post(ROUTE_PATHS.TEST_COLUMN, { preHandler: requireAdmin(runtime) }, async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.code(200).send({
      status: "ok",
      note: "Column test compatibility endpoint scaffolded; full scenario runner ports in /tests/contract"
    });
  });
}
