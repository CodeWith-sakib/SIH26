/**
 * Custom application error — mirrors api-monitoring-system AppError.js.
 */
class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, details?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
