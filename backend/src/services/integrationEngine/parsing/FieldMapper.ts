import { FieldMapping } from '../../../shared/models/Integration.js';
import { EngineError } from '../errors/EngineError.js';
import { setNestedValue } from './NestedValue.js';

export interface CanonicalCitizenData {
  name?: string;
  dateOfBirth?: string;
  registrationNumber?: string;
  qualification?: string;
  score?: string | number;
  [key: string]: unknown;
}

export class FieldMapper {
  static map(sourceData: unknown, fieldMappings: FieldMapping[]): CanonicalCitizenData {
    const result: CanonicalCitizenData = {};
    for (const mapping of fieldMappings) {
      const sourceValue = this.extractByPath(sourceData, mapping.sourceField);
      if (sourceValue === undefined || sourceValue === null) continue;
      let transformedValue: unknown = sourceValue;
      if (mapping.transform) transformedValue = this.applyTransform(sourceValue, mapping.transform);
      setNestedValue(result, mapping.canonicalField, transformedValue);
    }
    return result;
  }

  private static extractByPath(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== 'object') return undefined;
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private static applyTransform(value: unknown, transform: string): unknown {
    if (value === null || value === undefined) return value;
    const strValue = String(value);
    switch (transform) {
      case 'uppercase': return strValue.toUpperCase();
      case 'lowercase': return strValue.toLowerCase();
      case 'trim': return strValue.trim();
      case 'date': return this.parseDate(strValue);
      case 'number': return this.parseNumber(strValue);
      default: throw EngineError.mapping(`Unsupported transform: ${transform}`, { transform, value });
    }
  }

  private static parseDate(value: string): string {
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) throw EngineError.mapping(`Invalid date value: ${value}`, { value });
    return parsed.toISOString().split('T')[0];
  }

  private static parseNumber(value: string): number {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) throw EngineError.mapping(`Invalid number value: ${value}`, { value });
    return parsed;
  }
}
