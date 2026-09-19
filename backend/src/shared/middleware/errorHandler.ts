import { NextFunction, Request, Response } from 'express';

/**
 * Global error sanitization middleware — extracted from server.ts inline handler.
 * Matches the reference api-monitoring-system errorHandler.js pattern.
 */
function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const reqId = req.requestId || 'unknown';

  // Handle JSON body syntax errors
  const parseError = error as SyntaxError & { status?: number; body?: unknown };

  if (error instanceof SyntaxError && parseError.status === 400 && parseError.body) {
    res.status(400).json({ message: 'Malformed JSON request body', requestId: reqId });
    return;
  }

  console.error(
    `[ERROR] [RequestId: ${reqId}] Unhandled server error:`,
    error instanceof Error ? error.stack || error.message : String(error)
  );

  res.status(500).json({ message: 'Internal server error', requestId: reqId });
}

export default errorHandler;
