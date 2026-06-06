import type { Request, Response, NextFunction } from "express";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error("[error]", err);

  if (res.headersSent) return;

  const isProd = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: "Internal server error",
    ...(isProd
      ? {}
      : { detail: err instanceof Error ? err.message : String(err) }),
  });
}
