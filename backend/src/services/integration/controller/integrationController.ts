import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Integration, {
  ProtocolType, AuthType, AuthConfig, RequestConfig, ResponseConfig, FieldMapping,
} from '../../../shared/models/Integration.js';
import Department from '../../../shared/models/Department.js';
import { auditService } from '../../audit/service/auditService.js';

const validProtocols: ProtocolType[] = ['REST', 'SOAP'];
const validAuthTypes: AuthType[] = ['NONE', 'API_KEY', 'JWT'];

function isValidProtocol(p: unknown): p is ProtocolType { return typeof p === 'string' && validProtocols.includes(p as ProtocolType); }
function isValidAuthType(a: unknown): a is AuthType { return typeof a === 'string' && validAuthTypes.includes(a as AuthType); }
function isValidAuthConfig(a: unknown): a is AuthConfig { return typeof a === 'object' && a !== null && isValidAuthType((a as any).type); }
function isValidRequestConfig(r: unknown): r is RequestConfig {
  if (typeof r !== 'object' || r === null) return false;
  const rc = r as any;
  return typeof rc.method === 'string' && rc.method.trim().length > 0 && typeof rc.path === 'string' && rc.path.trim().length > 0;
}
function isValidResponseConfig(r: unknown): r is ResponseConfig {
  if (typeof r !== 'object' || r === null) return false;
  const rc = r as any;
  return typeof rc.dataPath === 'string' && rc.dataPath.trim().length > 0;
}
function isValidFieldMapping(f: unknown): f is FieldMapping {
  if (typeof f !== 'object' || f === null) return false;
  const fm = f as any;
  return typeof fm.sourceField === 'string' && fm.sourceField.trim().length > 0 &&
    typeof fm.canonicalField === 'string' && fm.canonicalField.trim().length > 0 &&
    (fm.transform === undefined || ['uppercase', 'lowercase', 'trim', 'date', 'number'].includes(fm.transform));
}
function isValidFieldMappings(fms: unknown): fms is FieldMapping[] { return Array.isArray(fms) && fms.every(isValidFieldMapping); }

export class IntegrationController {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      const integrations = await Integration.find().populate('departmentId', 'name code').sort({ createdAt: -1 });
      res.json({ integrations });
    } catch { res.status(500).json({ message: 'Failed to fetch integrations' }); }
  }

  async getOne(req: Request<{ id: string }>, res: Response): Promise<void> {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(400).json({ message: 'Invalid integration ID' }); return; }
    try {
      const integration = await Integration.findById(req.params.id).populate('departmentId', 'name code');
      if (!integration) { res.status(404).json({ message: 'Integration not found' }); return; }
      res.json({ integration });
    } catch { res.status(500).json({ message: 'Failed to fetch integration' }); }
  }

  async create(req: Request, res: Response): Promise<void> {
    const { departmentId, name, protocol, baseUrl, authentication, request, response, fieldMappings, active } = req.body;

    if (typeof departmentId !== 'string' || !mongoose.isValidObjectId(departmentId)) { res.status(400).json({ message: 'A valid department ID is required' }); return; }
    if (typeof name !== 'string' || !name.trim()) { res.status(400).json({ message: 'Name is required' }); return; }
    if (!isValidProtocol(protocol)) { res.status(400).json({ message: 'Protocol must be REST or SOAP' }); return; }
    if (typeof baseUrl !== 'string' || !baseUrl.trim()) { res.status(400).json({ message: 'Base URL is required' }); return; }
    if (!isValidAuthConfig(authentication)) { res.status(400).json({ message: 'Valid authentication configuration is required' }); return; }
    if (!isValidRequestConfig(request)) { res.status(400).json({ message: 'Valid request configuration is required' }); return; }
    if (!isValidResponseConfig(response)) { res.status(400).json({ message: 'Valid response configuration is required' }); return; }
    if (fieldMappings !== undefined && !isValidFieldMappings(fieldMappings)) { res.status(400).json({ message: 'Field mappings must be an array of valid field mapping objects' }); return; }
    if (active !== undefined && typeof active !== 'boolean') { res.status(400).json({ message: 'Active must be a boolean if provided' }); return; }

    try {
      const department = await Department.findById(departmentId);
      if (!department) { res.status(404).json({ message: 'Referenced department not found' }); return; }

      const integration = await Integration.create({
        departmentId, name: name.trim(), protocol, baseUrl: baseUrl.trim(),
        authentication, request, response, fieldMappings: fieldMappings ?? [],
        ...(active !== undefined && { active }),
      });

      await auditService.record({
        actorId: req.user!.id, actorRole: req.user!.role, action: 'CONNECTOR_CREATED',
        resource: 'integration', resourceId: integration._id.toString(), department: department.code,
        requestId: req.requestId, outcome: 'SUCCESS',
        metadata: { name: integration.name, protocol: integration.protocol, baseUrl: integration.baseUrl, authType: integration.authentication.type, active: integration.active },
      });
      res.status(201).json({ message: 'Integration created successfully', integration });
    } catch { res.status(500).json({ message: 'Failed to create integration' }); }
  }

  async update(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params;
    const { name, protocol, baseUrl, authentication, request, response, fieldMappings, active } = req.body;

    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid integration ID' }); return; }
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) { res.status(400).json({ message: 'Name must be a non-empty string' }); return; }
    if (protocol !== undefined && !isValidProtocol(protocol)) { res.status(400).json({ message: 'Protocol must be REST or SOAP' }); return; }
    if (baseUrl !== undefined && (typeof baseUrl !== 'string' || !baseUrl.trim())) { res.status(400).json({ message: 'Base URL must be a non-empty string' }); return; }
    if (authentication !== undefined && !isValidAuthConfig(authentication)) { res.status(400).json({ message: 'Valid authentication configuration is required' }); return; }
    if (request !== undefined && !isValidRequestConfig(request)) { res.status(400).json({ message: 'Valid request configuration is required' }); return; }
    if (response !== undefined && !isValidResponseConfig(response)) { res.status(400).json({ message: 'Valid response configuration is required' }); return; }
    if (fieldMappings !== undefined && !isValidFieldMappings(fieldMappings)) { res.status(400).json({ message: 'Field mappings must be an array of valid field mapping objects' }); return; }
    if (active !== undefined && typeof active !== 'boolean') { res.status(400).json({ message: 'Active must be a boolean if provided' }); return; }
    if ([name, protocol, baseUrl, authentication, request, response, fieldMappings, active].every(v => v === undefined)) {
      res.status(400).json({ message: 'At least one field is required to update' }); return;
    }

    try {
      const integration = await Integration.findById(id);
      if (!integration) { res.status(404).json({ message: 'Integration not found' }); return; }
      const previousActive = integration.active;

      if (name !== undefined) integration.name = (name as string).trim();
      if (protocol !== undefined) integration.protocol = protocol as ProtocolType;
      if (baseUrl !== undefined) integration.baseUrl = (baseUrl as string).trim();
      if (authentication !== undefined) integration.authentication = authentication as AuthConfig;
      if (request !== undefined) integration.request = request as RequestConfig;
      if (response !== undefined) integration.response = response as ResponseConfig;
      if (fieldMappings !== undefined) integration.fieldMappings = fieldMappings as FieldMapping[];
      if (active !== undefined) integration.active = active as boolean;
      await integration.save();

      await auditService.record({
        actorId: req.user!.id, actorRole: req.user!.role, action: 'CONNECTOR_UPDATED',
        resource: 'integration', resourceId: integration._id.toString(), requestId: req.requestId, outcome: 'SUCCESS',
        metadata: { name: integration.name, protocol: integration.protocol, active: integration.active, activeChanged: active !== undefined && active !== previousActive },
      });

      if (active !== undefined && active !== previousActive) {
        await auditService.record({
          actorId: req.user!.id, actorRole: req.user!.role,
          action: active ? 'CONNECTOR_ENABLED' : 'CONNECTOR_DISABLED',
          resource: 'integration', resourceId: integration._id.toString(), requestId: req.requestId,
          outcome: 'SUCCESS', metadata: { name: integration.name },
        });
      }
      res.json({ message: 'Integration updated successfully', integration });
    } catch { res.status(500).json({ message: 'Failed to update integration' }); }
  }

  async remove(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid integration ID' }); return; }
    try {
      const integration = await Integration.findByIdAndDelete(id);
      if (!integration) { res.status(404).json({ message: 'Integration not found' }); return; }
      await auditService.record({
        actorId: req.user!.id, actorRole: req.user!.role, action: 'CONNECTOR_DELETED',
        resource: 'integration', resourceId: id, requestId: req.requestId, outcome: 'SUCCESS',
        metadata: { name: integration.name, protocol: integration.protocol },
      });
      res.json({ message: 'Integration deleted successfully' });
    } catch { res.status(500).json({ message: 'Failed to delete integration' }); }
  }
}
