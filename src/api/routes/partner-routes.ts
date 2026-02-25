import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { optionalAuth } from "@api/middleware/auth";
import { createPartnerPropertySchema } from "@api/schema/partner";
import { createPartnerProperty } from "@modules/reducers/partner-properties-reducer";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { ROUTE_PATHS } from "@shared/constants";

function parseBearerToken(header: string | undefined): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

export async function registerPartnerRoutes(app: FastifyInstance, runtime: RuntimeContainer): Promise<void> {
  app.post(ROUTE_PATHS.PARTNER_PROPERTIES, { preHandler: optionalAuth(runtime) }, async (request: FastifyRequest, reply: FastifyReply) => {
    const token = parseBearerToken(request.headers.authorization);
    if (!token && !request.authContext) {
      reply.code(401).send({ error: "Missing or invalid Authorization header" });
      return;
    }

    const parsed = createPartnerPropertySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid request payload" });
      return;
    }

    const result = await createPartnerProperty(runtime, parsed.data);
    reply.code(201).send(result);
  });
}
