import { ProtocolAdapter, AdapterDependencies } from './Adapter.interface.js';
import { DepartmentDataRequest } from '../engine/IntegrationEngine.interface.js';
import { CanonicalCitizenData } from '../parsing/FieldMapper.js';
import { IntegrationDocument } from '../../../shared/models/Integration.js';

export class RestAdapter implements ProtocolAdapter {
  async execute(integration: IntegrationDocument, request: DepartmentDataRequest, deps: AdapterDependencies): Promise<CanonicalCitizenData | null> {
    const reqConfig = integration.request;
    const authHeaders = await deps.authStrategy.prepare(integration.authentication);
    const url = this.buildUrl(integration.baseUrl, reqConfig.path, request.citizenIdentifier);
    const headers = { ...reqConfig.headers, ...authHeaders.headers };
    const params = reqConfig.queryParams ? { ...reqConfig.queryParams } : {};
    const body = this.buildBody(reqConfig.bodyMapping, request.citizenIdentifier, reqConfig.method);
    const httpResponse = await deps.httpClient.request({ method: reqConfig.method.toUpperCase(), url, headers, params, data: body });
    const parsed = await deps.responseParser.parse(httpResponse, integration);
    return deps.fieldMapper.map(parsed.data, integration.fieldMappings);
  }

  private buildUrl(baseUrl: string, path: string, citizenIdentifier: Record<string, unknown>): string {
    let fullPath = path.replace(/\{(\w+)\}/g, (_, key) => {
      const value = citizenIdentifier[key] || citizenIdentifier[key.toLowerCase()];
      return value ? encodeURIComponent(String(value)) : '';
    });
    const base = baseUrl.replace(/\/+$/, '');
    const pathClean = fullPath.replace(/^\/+/, '');
    return `${base}/${pathClean}`;
  }

  private buildBody(bodyMapping: Record<string, string> | undefined, citizenIdentifier: Record<string, unknown>, method: string): unknown {
    if (!bodyMapping || (method !== 'POST' && method !== 'PUT' && method !== 'PATCH')) return undefined;
    const body: Record<string, unknown> = {};
    for (const [targetKey, sourceKey] of Object.entries(bodyMapping)) {
      const value = citizenIdentifier[sourceKey] || citizenIdentifier[sourceKey.toLowerCase()];
      if (value !== undefined) body[targetKey] = value;
    }
    return Object.keys(body).length > 0 ? body : undefined;
  }
}
