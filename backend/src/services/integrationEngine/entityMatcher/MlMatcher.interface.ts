import { CanonicalCitizenData } from '../parsing/FieldMapper.js';

export interface MatchRequest {
  sourceData: CanonicalCitizenData;
  applicationData: CanonicalCitizenData;
}

export interface MatchResult {
  samePerson: boolean;
  confidence: number;
  matchedFields: string[];
  unmatchedFields: string[];
}

export interface EntityMatcher {
  match(request: MatchRequest): Promise<MatchResult>;
}
