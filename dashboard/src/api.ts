export interface FetchOptions {
  method?: "GET" | "POST";
  body?: unknown;
  csrf?: string;
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
    throw new Error(data.error ?? data.message ?? `Request failed: ${response.status}`);
  }

  return data;
}

export async function getCsrfToken(): Promise<string> {
  const response = await fetchJson<{ csrfToken: string }>("/api/admin/csrf");
  return response.csrfToken;
}
