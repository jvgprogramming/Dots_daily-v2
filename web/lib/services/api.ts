const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
}

class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

async function getToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  const token = await getToken();
  const url = new URL(`${API_BASE_URL}${path}`);

  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) =>
      url.searchParams.append(key, value)
    );
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options?.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = { method, headers };

  if (body !== undefined && method !== "GET") {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), fetchOptions);
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.message || "An error occurred",
      response.status,
      data.errors
    );
  }

  return data;
}

/**
 * Authenticated file download (e.g. a CSV export): fetches with the bearer
 * token and hands the browser a file to save.
 */
async function download(path: string, params: Record<string, string> | undefined, fallbackName: string): Promise<void> {
  const token = await getToken();
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.append(k, v));

  const response = await fetch(url.toString(), {
    headers: { Accept: "text/csv, application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.message || "Download failed", response.status, data.errors);
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const name = /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? fallbackName;
  const href = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/** First field error from a validation failure, else the message. */
export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof ApiError && err.errors) {
    const first = Object.values(err.errors).flat()[0];
    if (first) return first;
  }
  return err instanceof Error ? err.message : fallback;
}

export const api = {
  download,
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
};

export { ApiError };
export type { RequestOptions };
