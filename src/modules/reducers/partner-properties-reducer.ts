import { AppError } from "@lib/errors/app-error";
import type { RuntimeContainer } from "@modules/internal/runtime";
import { addPartnerProperty } from "@modules/internal/repositories";

export interface CreatePartnerPropertyInput {
  partnerId: string;
  title: string;
  address: string;
  description: string;
  price: number;
  beds: number;
  baths: number;
}

/**
 * Validates and creates partner property.
 * @param runtime Runtime container
 * @param input Property payload
 * @returns Property id
 */
export async function createPartnerProperty(
  runtime: RuntimeContainer,
  input: CreatePartnerPropertyInput
): Promise<{ id: string; status: "created" }> {
  if (!input.title || !input.address || !input.description) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Missing required property fields",
      payload: { reason: "title, address and description are required" },
      retryable: false
    });
  }

  if (input.price <= 0 || input.beds <= 0 || input.baths <= 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid numeric property fields",
      payload: { reason: "price, beds and baths must be positive" },
      retryable: false
    });
  }

  const id = await addPartnerProperty(runtime.store, input);
  return { id, status: "created" };
}
