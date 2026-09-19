import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { getCircuitBreaker } from './CircuitBreaker.js';
import { EngineError } from '../errors/EngineError.js';

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
}

interface HttpClientConfig {
  timeoutMs: number;
  maxRetries: number;
  baseRetryDelayMs: number;
}

const DEFAULT_CONFIG: HttpClientConfig = {
  timeoutMs: Number(process.env.ENGINE_HTTP_TIMEOUT_MS) || 10_000,
  maxRetries: Number(process.env.ENGINE_HTTP_MAX_RETRIES) || 2,
  baseRetryDelayMs: Number(process.env.ENGINE_HTTP_BASE_RETRY_DELAY_MS) || 500,
};

function isRetryableError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return true;
    if (!error.response) return true;
    return error.response.status >= 500;
  }
  if (error instanceof EngineError) return error.statusCode >= 500;
  return false;
}

export class HttpClient {
  private readonly config: HttpClientConfig;
  private readonly axiosInstance: ReturnType<typeof axios.create>;

  constructor(config: Partial<HttpClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.axiosInstance = axios.create({ timeout: this.config.timeoutMs, validateStatus: () => true });

    this.axiosInstance.interceptors.request.use((requestConfig: InternalAxiosRequestConfig) => {
      const cbKey = `${requestConfig.method?.toUpperCase()}:${requestConfig.baseURL}${requestConfig.url}`;
      const breaker = getCircuitBreaker(cbKey);
      if (breaker.getState() === 'OPEN') throw EngineError.circuitOpen(cbKey);
      return requestConfig;
    });
  }

  async request<T = unknown>(axiosConfig: AxiosRequestConfig): Promise<HttpResponse<T>> {
    const cbKey = `${axiosConfig.method?.toUpperCase()}:${axiosConfig.baseURL}${axiosConfig.url}`;
    const breaker = getCircuitBreaker(cbKey);
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response: AxiosResponse<T> = await this.axiosInstance.request<T>(axiosConfig);

        if (response.status >= 400) {
          const engineError = EngineError.httpError(response.status, `HTTP ${response.status}: ${response.statusText}`, { url: axiosConfig.url, status: response.status });
          if (attempt < this.config.maxRetries && isRetryableError(engineError)) {
            await this.delay(this.config.baseRetryDelayMs * Math.pow(2, attempt));
            continue;
          }
          breaker.onFailure();
          throw engineError;
        }

        breaker.onSuccess();
        return { status: response.status, headers: this.normalizeHeaders(response.headers), data: response.data };
      } catch (error: unknown) {
        lastError = error;
        if (error instanceof EngineError) {
          if (error.code === 'CIRCUIT_OPEN' || error.statusCode < 500) throw error;
        }
        if (attempt < this.config.maxRetries && isRetryableError(error)) {
          await this.delay(this.config.baseRetryDelayMs * Math.pow(2, attempt));
          continue;
        }
        breaker.onFailure();
        throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Unknown error after retries');
  }

  private normalizeHeaders(headers: unknown): Record<string, string> {
    const normalized: Record<string, string> = {};
    const headerObj = headers as Record<string, string | string[] | undefined>;
    for (const [key, value] of Object.entries(headerObj)) {
      if (Array.isArray(value)) normalized[key.toLowerCase()] = value.join(', ');
      else if (typeof value === 'string') normalized[key.toLowerCase()] = value;
    }
    return normalized;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const httpClient = new HttpClient();
