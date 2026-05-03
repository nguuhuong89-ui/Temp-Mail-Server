import type { Request, Response, NextFunction } from "express";

export function isAdminAuthConfigured(): boolean {
  return Boolean(process.env["ADMIN_TOKEN"]);
}

export function checkAdminToken(provided: string | undefined): boolean {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected) return true; // dev mode: no token configured
  return Boolean(provided) && provided === expected;
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
