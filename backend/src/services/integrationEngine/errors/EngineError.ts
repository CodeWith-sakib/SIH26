export class EngineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'EngineError';
  }

  static configuration(message: string, details?: unknown): EngineError {
    return new EngineError(message, 'CONFIGURATION_ERROR', 500, details);
  }
  static authentication(message: string, details?: unknown): EngineError {
    return new EngineError(message, 'AUTHENTICATION_ERROR', 401, details);
  }
  static network(message: string, details?: unknown): EngineError {
    return new EngineError(message, 'NETWORK_ERROR', 503, details);
  }
  static timeout(message: string, details?: unknown): EngineError {
    return new EngineError(message, 'TIMEOUT_ERROR', 504, details);
  }
  static httpError(status: number, message: string, details?: unknown): EngineError {
    return new EngineError(message, 'HTTP_ERROR', status, details);
  }
  static parse(message: string, details?: unknown): EngineError {
    return new EngineError(message, 'PARSE_ERROR', 500, details);
  }
  static mapping(message: string, details?: unknown): EngineError {
    return new EngineError(message, 'MAPPING_ERROR', 500, details);
  }
  static circuitOpen(departmentCode: string): EngineError {
    return new EngineError(`Circuit breaker open for department: ${departmentCode}`, 'CIRCUIT_OPEN', 503, { departmentCode });
  }
  static unsupportedProtocol(protocol: string): EngineError {
    return new EngineError(`Unsupported protocol: ${protocol}`, 'UNSUPPORTED_PROTOCOL', 500, { protocol });
  }
  static unsupportedAuthType(authType: string): EngineError {
    return new EngineError(`Unsupported authentication type: ${authType}`, 'UNSUPPORTED_AUTH_TYPE', 500, { authType });
  }
}
