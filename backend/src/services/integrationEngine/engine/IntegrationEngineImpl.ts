import { IntegrationEngine, DepartmentDataRequest } from './IntegrationEngine.interface.js';
import { CanonicalCitizenData, FieldMapper } from '../parsing/FieldMapper.js';
import { ProtocolAdapter } from '../adapters/Adapter.interface.js';
import { RestAdapter } from '../adapters/RestAdapter.js';
import { SoapAdapter } from '../adapters/SoapAdapter.js';
import { createAuthStrategy } from '../auth/AuthStrategy.js';
import { httpClient } from '../http/HttpClient.js';
import { ResponseParser } from '../parsing/ResponseParser.js';
import Department from '../../../shared/models/Department.js';
import Integration, { IntegrationDocument } from '../../../shared/models/Integration.js';
import { EngineError } from '../errors/EngineError.js';
import { auditService } from '../../audit/service/auditService.js';

export class IntegrationEngineImpl implements IntegrationEngine {
  private readonly adapters: Map<string, ProtocolAdapter> = new Map();

  constructor() {
    this.adapters.set('REST', new RestAdapter());
    this.adapters.set('SOAP', new SoapAdapter());
  }

  async getCitizenData(request: DepartmentDataRequest): Promise<CanonicalCitizenData | null> {
    const department = await Department.findOne({ code: request.departmentCode.toUpperCase(), active: true });
    if (!department) throw EngineError.configuration(`Department not found or inactive: ${request.departmentCode}`);

    const integration = await Integration.findOne({ departmentId: department._id, active: true }).populate('departmentId');
    if (!integration) throw EngineError.configuration(`No active integration for department: ${request.departmentCode}`);

    this.validateIntegration(integration);

    const adapter = this.adapters.get(integration.protocol);
    if (!adapter) throw EngineError.unsupportedProtocol(integration.protocol);

    const authStrategy = createAuthStrategy(integration.authentication.type);

    try {
      return await adapter.execute(integration, request, {
        httpClient, authStrategy, responseParser: ResponseParser, fieldMapper: FieldMapper,
      });
    } catch (error: unknown) {
      await auditService.record({
        action: 'INTEGRATION_FAILED', resource: 'integration', resourceId: integration._id.toString(),
        department: request.departmentCode, outcome: 'FAILURE',
        metadata: { protocol: integration.protocol, error: error instanceof Error ? error.message : 'Unknown integration error' },
      });
      throw error;
    }
  }

  async isDepartmentAvailable(departmentCode: string): Promise<boolean> {
    try {
      const department = await Department.findOne({ code: departmentCode.toUpperCase(), active: true });
      if (!department) return false;
      const integration = await Integration.findOne({ departmentId: department._id, active: true });
      if (!integration) return false;
      return this.adapters.has(integration.protocol);
    } catch {
      return false;
    }
  }

  private validateIntegration(integration: IntegrationDocument): void {
    const req = integration.request;
    if (!req.method || !req.path) throw EngineError.configuration('Request configuration missing method or path', { integrationId: integration._id });
    if (integration.protocol === 'SOAP' && !req.soapAction) throw EngineError.configuration('SOAP integration missing soapAction', { integrationId: integration._id });
    const authType = integration.authentication.type;
    if (authType === 'API_KEY' && (!integration.authentication.apiKey?.headerName || !integration.authentication.apiKey?.value)) {
      throw EngineError.configuration('API_KEY authentication missing headerName or value', { integrationId: integration._id });
    }
    if (authType === 'JWT' && (!integration.authentication.jwt?.tokenUrl || !integration.authentication.jwt?.clientId || !integration.authentication.jwt?.clientSecret)) {
      throw EngineError.configuration('JWT authentication missing required fields', { integrationId: integration._id });
    }
    if (!integration.response?.dataPath) throw EngineError.configuration('Response configuration missing dataPath', { integrationId: integration._id });
  }
}

export const integrationEngine = new IntegrationEngineImpl();
