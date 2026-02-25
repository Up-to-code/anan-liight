import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { getLiveness, getReadiness } from "@modules/queries/health-query";
import { ROUTE_PATHS } from "@shared/constants";

export async function registerHealthRoutes(app: FastifyInstance, runtime: RuntimeContainer): Promise<void> {
  app.get("/", async () => ({
    service: "anan-liight",
    status: "ok",
    health: {
      live: ROUTE_PATHS.HEALTH_LIVE,
      ready: ROUTE_PATHS.HEALTH_READY
    }
  }));

  app.get(ROUTE_PATHS.HEALTH_LIVE, async () => getLiveness());

  app.get(ROUTE_PATHS.HEALTH_READY, async (_request: FastifyRequest, reply: FastifyReply) => {
    const readiness = await getReadiness(runtime);
    reply.code(readiness.ready ? 200 : 503).send(readiness);
  });
}
