export interface FetchOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  csrf?: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly payload?: unknown;

  public constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "x-admin-role": "admin",
      ...(options.csrf ? { "x-csrf-token": options.csrf } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });

  const data = (await response.json()) as T & { error?: string; message?: string };
  if (!response.ok) {
    throw new ApiError(data.error ?? data.message ?? `Request failed: ${response.status}`, response.status, data);
  }

  return data;
}

export async function getCsrfToken(): Promise<string> {
  const response = await fetchJson<{ csrfToken: string }>("/api/admin/csrf");
  return response.csrfToken;
}
