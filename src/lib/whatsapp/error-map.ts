export interface WaProviderError {
  code: string;
  message: string;
  retryable: boolean;
}

export function mapWhatsAppError(status: number, bodyText: string): WaProviderError {
  if (status === 429) {
    return { code: "WA_RATE_LIMITED", message: "WhatsApp rate limit exceeded", retryable: true };
  }
  if (status === 401 || status === 403) {
    return { code: "WA_AUTH", message: "WhatsApp authentication failed", retryable: false };
  }
  if (status >= 500) {
    return { code: "WA_PROVIDER_5XX", message: "WhatsApp provider unavailable", retryable: true };
  }
  return {
    code: "WA_PROVIDER_ERROR",
    message: bodyText.slice(0, 500) || "Unknown WhatsApp provider error",
    retryable: status === 408 || status === 409
  };
}
