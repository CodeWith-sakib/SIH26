import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { CanonicalCitizenData } from '../parsing/FieldMapper.js';
import { EntityMatcher, MatchRequest, MatchResult } from './MlMatcher.interface.js';

interface PythonMatchResult {
  source_id?: string;
  confidence: number;
  decision: 'MATCH' | 'REVIEW' | 'NOT_MATCH';
  field_scores: Record<string, number>;
}

function toMlRecord(data: CanonicalCitizenData, sourceId: string): Record<string, unknown> {
  return {
    source_id: sourceId,
    name: data.name,
    dob: data.dateOfBirth,
    phone: data.phone,
    email: data.email,
    address: data.address
  };
}

function resolveProjectPath(): string {
  const configuredPath = process.env.ML_PROJECT_PATH;
  const candidates = configuredPath
    ? [configuredPath]
    : [
        path.resolve(process.cwd(), 'sih-entity-resolution-ml'),
        path.resolve(process.cwd(), '..', 'sih-entity-resolution-ml')
      ];

  const projectPath = candidates.find(candidate => fs.existsSync(path.join(candidate, 'src', 'cli.py')));
  if (!projectPath) {
    throw new Error('ML project not found. Set ML_PROJECT_PATH to the sih-entity-resolution-ml directory.');
  }
  return projectPath;
}

function toMatchResult(result: PythonMatchResult): MatchResult {
  const matchedFields = Object.entries(result.field_scores)
    .filter(([, score]) => score >= 1)
    .map(([field]) => field);
  const allFields = ['name', 'dob', 'phone', 'email', 'address'];

  return {
    samePerson: result.decision === 'MATCH',
    confidence: result.confidence,
    matchedFields,
    unmatchedFields: allFields.filter(field => !matchedFields.includes(field))
  };
}

export class PythonEntityMatcher implements EntityMatcher {
  async match(request: MatchRequest): Promise<MatchResult> {
    const projectPath = resolveProjectPath();
    const payload = JSON.stringify({
      current_person: toMlRecord(request.applicationData, 'current-user'),
      candidates: [toMlRecord(request.sourceData, 'source-record')]
    });
    const python = process.env.ML_PYTHON ?? 'python3';

    const { stdout, stderr, exitCode } = await new Promise<{ stdout: string; stderr: string; exitCode: number }>(
      (resolve, reject) => {
        const child = spawn(python, ['-m', 'src.cli'], {
          cwd: projectPath,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';
        const timeout = setTimeout(() => {
          child.kill();
          reject(new Error('ML matcher timed out after 15 seconds'));
        }, 15_000);

        child.stdout.on('data', chunk => { stdout += chunk.toString(); });
        child.stderr.on('data', chunk => { stderr += chunk.toString(); });
        child.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
        child.on('close', code => {
          clearTimeout(timeout);
          resolve({ stdout, stderr, exitCode: code ?? 1 });
        });
        child.stdin.end(payload);
      }
    );

    if (exitCode !== 0) {
      throw new Error(`ML matcher failed: ${stderr.trim() || `process exited with code ${exitCode}`}`);
    }

    let results: PythonMatchResult[];
    try {
      results = JSON.parse(stdout) as PythonMatchResult[];
    } catch (error) {
      throw new Error(`ML matcher returned invalid JSON: ${error instanceof Error ? error.message : 'unknown error'}`);
    }

    if (!Array.isArray(results) || results.length !== 1) {
      throw new Error('ML matcher returned an unexpected result count');
    }

    const result = results[0];
    if (!Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) {
      throw new Error('ML matcher returned an invalid confidence value');
    }

    return toMatchResult(result);
  }
}
