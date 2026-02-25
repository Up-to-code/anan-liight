import "fastify";
import type { AuthenticatedRequestContext } from "@lib/auth/types";

declare module "fastify" {
  interface FastifyRequest {
    authContext?: AuthenticatedRequestContext;
  }
}
