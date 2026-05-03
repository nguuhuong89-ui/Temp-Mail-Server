import type { Request, Response, NextFunction } from "express";

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected) {
    // Development convenience: if no token configured, allow through but warn once.
    next();
    return;
  }
  const header = req.header("x-admin-token") ?? "";
  const bearer = (req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const provided = header || bearer;
  if (provided && provided === expected) {
    next();
    return;
  }
  res.status(401).json({ error: "Admin authentication required" });
}
