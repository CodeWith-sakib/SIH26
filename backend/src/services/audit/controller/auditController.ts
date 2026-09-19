import { Request, Response } from 'express';
import AuditLog, { AUDIT_ACTIONS } from '../../../shared/models/AuditLog.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

export class AuditController {
  async list(req: Request, res: Response): Promise<void> {
    const {
      action, applicationId, department, requestId,
      actorId, outcome, from, to, page, limit,
    } = req.query;

    if (action !== undefined && !AUDIT_ACTIONS.includes(action as (typeof AUDIT_ACTIONS)[number])) {
      res.status(400).json({ message: 'Invalid action filter' });
      return;
    }

    if (outcome !== undefined && outcome !== 'SUCCESS' && outcome !== 'FAILURE' && outcome !== 'DENIED') {
      res.status(400).json({ message: 'Invalid outcome filter' });
      return;
    }

    const parsedLimit = Math.min(parsePositiveInt(limit, DEFAULT_LIMIT), MAX_LIMIT);
    const parsedPage = parsePositiveInt(page, 1);
    const fromDate = parseDate(from);
    const toDate = parseDate(to);

    if ((from !== undefined && !fromDate) || (to !== undefined && !toDate)) {
      res.status(400).json({ message: 'Invalid from/to date filter' });
      return;
    }

    const filter: Record<string, unknown> = {};
    if (typeof action === 'string') filter.action = action;
    if (typeof applicationId === 'string' && applicationId.trim()) filter.applicationId = applicationId.trim();
    if (typeof department === 'string' && department.trim()) filter.department = department.trim();
    if (typeof requestId === 'string' && requestId.trim()) filter.requestId = requestId.trim();
    if (typeof actorId === 'string' && actorId.trim()) filter.actorId = actorId.trim();
    if (typeof outcome === 'string') filter.outcome = outcome;
    if (fromDate || toDate) {
      filter.timestamp = {
        ...(fromDate && { $gte: fromDate }),
        ...(toDate && { $lte: toDate }),
      };
    }

    try {
      const total = await AuditLog.countDocuments(filter);
      const audits = await AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit);

      res.json({ audits, page: parsedPage, limit: parsedLimit, total });
    } catch (error: unknown) {
      res.status(500).json({ message: 'Failed to fetch audit records' });
    }
  }
}
