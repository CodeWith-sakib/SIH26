import { EntityMatcher, MatchRequest, MatchResult } from './MlMatcher.interface.js';
import config from '../../../shared/config/index.js';
import { PythonEntityMatcher } from './PythonEntityMatcher.js';

interface FieldComparator {
  weight: number;
  compare: (source: string, application: string) => boolean;
}

function normalizeForComparison(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeName(value: unknown): string {
  return String(value === null || value === undefined ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function normalizeDate(value: unknown): string {
  const str = String(value === null || value === undefined ? '' : value).trim();
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return str.replace(/[^0-9]/g, '');
}

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

export class EntityMatcherImpl implements EntityMatcher {
  private readonly fieldComparators: Record<string, FieldComparator> = {};

  constructor() {
    this.register('name', 0.5, (a, b) => normalizeName(a) === normalizeName(b));
    this.register('dateOfBirth', 0.3, (a, b) => normalizeDate(a) === normalizeDate(b));
    this.register('registrationNumber', 0.12, (a, b) => normalizeForComparison(a) === normalizeForComparison(b));
    this.register('email', 0.05, (a, b) => normalizeForComparison(a) === normalizeForComparison(b));
    this.register('phone', 0.03, (a, b) => normalizeForComparison(a) === normalizeForComparison(b));
  }

  private register(field: string, weight: number, compare: FieldComparator['compare']): void {
    this.fieldComparators[field] = { weight, compare };
  }

  async match(request: MatchRequest): Promise<MatchResult> {
    const { sourceData, applicationData } = request;

    const matchedFields: string[] = [];
    const unmatchedFields: string[] = [];
    let comparedWeight = 0;

    for (const field of Object.keys(this.fieldComparators)) {
      const sourceVal = sourceData[field];
      const appVal = applicationData[field];

      if (!isPresent(sourceVal) || !isPresent(appVal)) continue;

      const comparator = this.fieldComparators[field];
      comparedWeight += comparator.weight;

      if (comparator.compare(String(sourceVal), String(appVal))) {
        matchedFields.push(field);
      } else {
        unmatchedFields.push(field);
      }
    }

    let confidence = 0;
    if (comparedWeight > 0) {
      const matchedWeight = matchedFields.reduce(
        (sum, field) => sum + (this.fieldComparators[field]?.weight || 0),
        0
      );
      confidence = Math.round((matchedWeight / comparedWeight) * 10000) / 10000;
    }

    const samePerson = confidence >= config.verification.confidenceThreshold;

    return {
      samePerson,
      confidence,
      matchedFields,
      unmatchedFields,
    };
  }
}

export const entityMatcher: EntityMatcher =
  process.env.ML_MATCHER === 'python'
    ? new PythonEntityMatcher()
    : new EntityMatcherImpl();
