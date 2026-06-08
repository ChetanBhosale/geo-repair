import type { Request, Response, NextFunction } from "express";
import { config } from "../config";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

// Final error handler. Hides internals in production, surfaces detail in dev.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error("[error]", err);
  if (res.headersSent) return;

  res.status(500).json({
    error: "Internal server error",
    ...(config.isProd
      ? {}
      : { detail: err instanceof Error ? err.message : String(err) }),
  });
}
