import type { Request, Response, NextFunction } from "express";

export function isAdminAuthConfigured(): boolean {
  return Boolean(process.env["ADMIN_TOKEN"]);
}

function insecureAdminAllowed(): boolean {
  // Production refuses to allow unauthenticated admin access. Dev mode (or
  // explicit opt-in) still allows pass-through for ergonomics.
  if (process.env["ALLOW_INSECURE_ADMIN"] === "true") return true;
  return process.env["NODE_ENV"] !== "production";
}

export function checkAdminToken(provided: string | undefined): boolean {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected) return insecureAdminAllowed();
  return Boolean(provided) && provided === expected;
}

export function assertProductionAdminConfig(): void {
  if (process.env["NODE_ENV"] === "production" && !isAdminAuthConfigured() &&
      process.env["ALLOW_INSECURE_ADMIN"] !== "true") {
    throw new Error(
      "ADMIN_TOKEN must be set in production. Set ADMIN_TOKEN=<secret> or " +
        "explicitly opt out with ALLOW_INSECURE_ADMIN=true.",
    );
  }
}

function extractToken(req: Request): string {
  const header = req.header("x-admin-token") ?? "";
  const bearer = (req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return header || bearer;
}

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  if (checkAdminToken(extractToken(req))) {
    next();
    return;
  }
  res.status(401).json({ error: "Admin authentication required" });
}
