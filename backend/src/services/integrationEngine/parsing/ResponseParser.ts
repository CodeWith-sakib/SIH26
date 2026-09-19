import { parseString } from 'xml2js';
import { EngineError } from '../errors/EngineError.js';
import { IntegrationDocument } from '../../../shared/models/Integration.js';

export interface ParsedResponse {
  data: unknown;
}

export class ResponseParser {
  static async parse(response: { data: unknown; headers: Record<string, string> }, integration: IntegrationDocument): Promise<ParsedResponse> {
    const contentType = response.headers['content-type'] || '';
    const responseConfig = integration.response;
    let parsedData: unknown;

    if (contentType.includes('xml') || contentType.includes('soap') || integration.protocol === 'SOAP') {
      parsedData = await this.parseXml(response.data as string);
      parsedData = this.stripNamespacePrefixes(parsedData);
    } else {
      parsedData = response.data;
    }

    const extracted = this.extractByPath(parsedData, responseConfig.dataPath);
    if (extracted === undefined || extracted === null) {
      throw EngineError.parse(`Data path '${responseConfig.dataPath}' not found in response`, { dataPath: responseConfig.dataPath });
    }
    return { data: extracted };
  }

  private static parseXml(xmlString: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      parseString(xmlString, { explicitArray: false, trim: true }, (err, result) => {
        if (err) reject(EngineError.parse('Failed to parse XML response', { error: err.message }));
        else resolve(result);
      });
    });
  }

  private static stripNamespacePrefixes(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.stripNamespacePrefixes(item));
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const cleanKey = key.includes(':') ? key.split(':').pop()! : key;
      result[cleanKey] = this.stripNamespacePrefixes(value);
    }
    return result;
  }

  private static extractByPath(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== 'object') return obj;
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }
}
