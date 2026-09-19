import { AuthConfig, AuthType } from '../../../shared/models/Integration.js';
import { EngineError } from '../errors/EngineError.js';
import { httpClient } from '../http/HttpClient.js';

export interface AuthHeaders {
  headers: Record<string, string>;
}

export interface AuthStrategy {
  prepare(integrationConfig: AuthConfig): Promise<AuthHeaders>;
}

export function createAuthStrategy(type: AuthType): AuthStrategy {
  switch (type) {
    case 'NONE': return new NoneAuthStrategy();
    case 'API_KEY': return new ApiKeyAuthStrategy();
    case 'JWT': return new JwtAuthStrategy();
    default: throw EngineError.unsupportedAuthType(type);
  }
}

class NoneAuthStrategy implements AuthStrategy {
  async prepare(): Promise<AuthHeaders> { return { headers: {} }; }
}

class ApiKeyAuthStrategy implements AuthStrategy {
  async prepare(integrationConfig: AuthConfig): Promise<AuthHeaders> {
    if (!integrationConfig.apiKey?.headerName || !integrationConfig.apiKey?.value) {
      throw EngineError.authentication('API key configuration incomplete');
    }
    return { headers: { [integrationConfig.apiKey.headerName]: integrationConfig.apiKey.value } };
  }
}

interface CachedToken { token: string; expiresAt: number; }
const tokenCache = new Map<string, CachedToken>();

class JwtAuthStrategy implements AuthStrategy {
  async prepare(integrationConfig: AuthConfig): Promise<AuthHeaders> {
    const jwtConfig = integrationConfig.jwt;
    if (!jwtConfig?.tokenUrl || !jwtConfig?.clientId || !jwtConfig?.clientSecret) {
      throw EngineError.authentication('JWT configuration incomplete');
    }
    const cacheKey = `${jwtConfig.tokenUrl}:${jwtConfig.clientId}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return { headers: { Authorization: `Bearer ${cached.token}` } };
    }
    const params = new URLSearchParams({
      grant_type: 'client_credentials', client_id: jwtConfig.clientId,
      client_secret: jwtConfig.clientSecret, scope: jwtConfig.scopes?.join(' ') || '',
    });
    const tokenResponse = await httpClient.request<{ access_token?: string; expires_in?: number }>({
      method: 'POST', url: jwtConfig.tokenUrl, data: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (tokenResponse.status >= 400) throw EngineError.authentication('Token endpoint returned an error response');
    const token = tokenResponse.data.access_token;
    if (!token) throw EngineError.authentication('Token endpoint returned no access token');
    const expiresIn = tokenResponse.data.expires_in || 3600;
    tokenCache.set(cacheKey, { token, expiresAt: Date.now() + expiresIn * 1000 });
    return { headers: { Authorization: `Bearer ${token}` } };
  }
}
