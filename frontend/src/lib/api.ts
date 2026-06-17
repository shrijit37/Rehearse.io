const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:9000";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: any;
  tokenOverride?: string;
  /** Return raw Response instead of parsed JSON (for blob downloads). */
  raw?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { tokenOverride, body, headers: customHeaders, raw, ...rest } = options;
  const token = tokenOverride || localStorage.getItem("token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (customHeaders) {
    Object.assign(headers, customHeaders);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (raw) return res as unknown as T;

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !tokenOverride) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/signup";
    }
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, opts),
  post: <T>(path: string, body?: any, opts?: RequestOptions) => request<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: any, opts?: RequestOptions) => request<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: any, opts?: RequestOptions) => request<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T>(path: string, body?: any, opts?: RequestOptions) => request<T>(path, { ...opts, method: "DELETE", body }),
};
