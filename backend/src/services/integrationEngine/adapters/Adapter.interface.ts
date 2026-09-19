import { DepartmentDataRequest } from '../engine/IntegrationEngine.interface.js';
import { CanonicalCitizenData } from '../parsing/FieldMapper.js';
import { IntegrationDocument } from '../../../shared/models/Integration.js';
import { AuthStrategy } from '../auth/AuthStrategy.js';
import { HttpClient } from '../http/HttpClient.js';
import { ResponseParser } from '../parsing/ResponseParser.js';
import { FieldMapper } from '../parsing/FieldMapper.js';

export interface AdapterDependencies {
  httpClient: HttpClient;
  authStrategy: AuthStrategy;
  responseParser: typeof ResponseParser;
  fieldMapper: typeof FieldMapper;
}

export interface ProtocolAdapter {
  execute(
    integration: IntegrationDocument,
    request: DepartmentDataRequest,
    deps: AdapterDependencies
  ): Promise<CanonicalCitizenData | null>;
}
