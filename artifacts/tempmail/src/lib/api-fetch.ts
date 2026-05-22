const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function storedAdminToken(): string | null {
  try { return localStorage.getItem("tempmail_admin_token"); } catch { return null; }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const adminToken = storedAdminToken();
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(adminToken ? { "X-Admin-Token": adminToken } : {}),
      ...(init.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* ignore */ }
    const err = new Error(
      (body as { error?: string })?.error ?? `HTTP ${res.status}`,
    ) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
