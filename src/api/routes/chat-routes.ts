import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { optionalAuth } from "@api/middleware/auth";
import { chatRequestSchema } from "@api/schema/chat";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { sendChatMessage } from "@modules/reducers/chat-reducer";
import { ROUTE_PATHS } from "@shared/constants";

export async function registerChatRoutes(app: FastifyInstance, runtime: RuntimeContainer): Promise<void> {
  app.post(ROUTE_PATHS.CHAT, { preHandler: optionalAuth(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = chatRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "message required" });
      return;
    }

    const { threadId, message } = parsed.data;
    const userId = request.authContext?.userId ?? parsed.data.userId;
    const isAnonymous = userId.startsWith("anon-");
    const hasAuth = Boolean(request.authContext);
    if (!isAnonymous && !hasAuth) {
      reply.code(401).send({ error: "Authentication required" });
      return;
    }
    if (isAnonymous && !runtime.env.FEATURE_AUTH_ANON_CHAT_ENABLED) {
      reply.code(401).send({ error: "Anonymous chat disabled" });
      return;
    }

    const input = {
      message,
      userId,
      channel: "web" as const,
      idempotencyKey: request.headers["idempotency-key"]?.toString() ?? randomUUID()
    };

    const result = await sendChatMessage(
      runtime,
      threadId ? { ...input, threadId } : input
    );

    reply.code(200).send({ threadId: result.threadId, status: "sent" });
  });
}
