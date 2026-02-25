import type { FastifyReply, FastifyRequest } from "fastify";
import { resolveTraceId } from "@lib/observability/tracer";

/**
 * Injects x-trace-id into request and response.
 * @param request Fastify request
 * @param reply Fastify reply
 */
export async function traceIdMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const existing = request.headers["x-trace-id"];
  const traceId = resolveTraceId(typeof existing === "string" ? existing : undefined);
  request.headers["x-trace-id"] = traceId;
  reply.header("x-trace-id", traceId);
}
