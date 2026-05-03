import { setAuthTokenGetter } from "@workspace/api-client-react";

const STORAGE_KEY = "tempmail_admin_token";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notifyListeners();
}

const listeners = new Set<() => void>();
export function subscribeAdminToken(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notifyListeners() {
  listeners.forEach((l) => l());
}

let installed = false;
export function installAdminTokenFetcher(): void {
  if (installed) return;
  installed = true;
  setAuthTokenGetter(() => getAdminToken());
}

export type AuthStatus = { required: boolean };

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const res = await fetch(`${base}/api/admin/auth/status`);
  if (!res.ok) return { required: false };
  return (await res.json()) as AuthStatus;
}

export async function loginWithToken(token: string): Promise<boolean> {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const res = await fetch(`${base}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Token": token },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) return false;
  setAdminToken(token);
  return true;
}
