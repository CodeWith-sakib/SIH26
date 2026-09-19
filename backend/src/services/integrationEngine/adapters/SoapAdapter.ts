import { ProtocolAdapter, AdapterDependencies } from './Adapter.interface.js';
import { DepartmentDataRequest } from '../engine/IntegrationEngine.interface.js';
import { CanonicalCitizenData } from '../parsing/FieldMapper.js';
import { IntegrationDocument } from '../../../shared/models/Integration.js';

export class SoapAdapter implements ProtocolAdapter {
  async execute(integration: IntegrationDocument, request: DepartmentDataRequest, deps: AdapterDependencies): Promise<CanonicalCitizenData | null> {
    const reqConfig = integration.request;
    const authHeaders = await deps.authStrategy.prepare(integration.authentication);
    const url = this.buildUrl(integration.baseUrl, reqConfig.path);
    const headers = { ...reqConfig.headers, ...authHeaders.headers };
    const soapBody = this.buildSoapBody(reqConfig, request.citizenIdentifier);
    const soapAction = reqConfig.soapAction || reqConfig.method;
    const httpResponse = await deps.httpClient.request({
      method: 'POST', url,
      headers: { ...headers, 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: soapAction },
      data: soapBody,
    });
    const parsed = await deps.responseParser.parse(httpResponse, integration);
    return deps.fieldMapper.map(parsed.data, integration.fieldMappings);
  }

  private buildUrl(baseUrl: string, path: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }

  private buildSoapBody(reqConfig: IntegrationDocument['request'], citizenIdentifier: Record<string, unknown>): string {
    const namespaces = reqConfig.namespace || {
      soap: 'http://schemas.xmlsoap.org/soap/envelope/',
      xsi: 'http://www.w3.org/2001/XMLSchema-instance',
      xsd: 'http://www.w3.org/2001/XMLSchema',
    };
    const nsEntries = Object.entries(namespaces).map(([prefix, uri]) => `xmlns:${prefix}="${uri}"`).join(' ');
    let bodyContent = '';
    if (reqConfig.bodyMapping && Object.keys(reqConfig.bodyMapping).length > 0) {
      for (const [targetKey, sourceKey] of Object.entries(reqConfig.bodyMapping)) {
        const value = citizenIdentifier[sourceKey] || citizenIdentifier[sourceKey.toLowerCase()];
        if (value !== undefined) bodyContent += `<${targetKey}>${this.escapeXml(String(value))}</${targetKey}>`;
      }
    } else {
      for (const [key, value] of Object.entries(citizenIdentifier)) {
        if (value !== undefined) bodyContent += `<${key}>${this.escapeXml(String(value))}</${key}>`;
      }
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<soap:Envelope ${nsEntries}>\n  <soap:Body>\n    ${bodyContent}\n  </soap:Body>\n</soap:Envelope>`;
  }

  private escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
}
