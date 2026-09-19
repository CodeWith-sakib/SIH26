import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Department from '../../../shared/models/Department.js';
import Integration from '../../../shared/models/Integration.js';
import { auditService } from '../../audit/service/auditService.js';

function isValidCode(code: unknown): code is string { return typeof code === 'string' && code.trim().length > 0; }
function isValidName(name: unknown): name is string { return typeof name === 'string' && name.trim().length > 0; }
function isValidDescription(desc: unknown): desc is string | undefined { return desc === undefined || (typeof desc === 'string' && desc.trim().length > 0); }
function isValidActive(active: unknown): active is boolean { return typeof active === 'boolean'; }
function isValidDataCategories(dc: unknown): dc is string[] { return Array.isArray(dc) && dc.length > 0 && dc.every(c => typeof c === 'string' && c.trim().length > 0); }
function isDuplicateKeyError(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && (error as any).code === 11000; }

export class DepartmentController {
  async list(_req: Request, res: Response): Promise<void> {
    try { const departments = await Department.find().sort({ createdAt: -1 }); res.json({ departments }); }
    catch { res.status(500).json({ message: 'Failed to fetch departments' }); }
  }

  async getOne(req: Request<{ id: string }>, res: Response): Promise<void> {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(400).json({ message: 'Invalid department ID' }); return; }
    try {
      const department = await Department.findById(req.params.id);
      if (!department) { res.status(404).json({ message: 'Department not found' }); return; }
      res.json({ department });
    } catch { res.status(500).json({ message: 'Failed to fetch department' }); }
  }

  async create(req: Request, res: Response): Promise<void> {
    const { name, code, description, active, dataCategories } = req.body;
    if (!isValidName(name)) { res.status(400).json({ message: 'Name is required' }); return; }
    if (!isValidCode(code)) { res.status(400).json({ message: 'Code is required' }); return; }
    if (!isValidDescription(description)) { res.status(400).json({ message: 'Description must be a non-empty string if provided' }); return; }
    if (active !== undefined && !isValidActive(active)) { res.status(400).json({ message: 'Active must be a boolean if provided' }); return; }
    if (dataCategories !== undefined && !isValidDataCategories(dataCategories)) { res.status(400).json({ message: 'dataCategories must be a non-empty array of non-empty strings' }); return; }

    const normalizedCode = (code as string).trim().toUpperCase();
    try {
      if (await Department.findOne({ code: normalizedCode })) { res.status(409).json({ message: 'Department code already exists' }); return; }

      const department = await Department.create({
        name: (name as string).trim(), code: normalizedCode,
        ...(description && { description: (description as string).trim() }),
        ...(active !== undefined && { active }),
        ...(dataCategories !== undefined && { dataCategories: (dataCategories as string[]).map(c => c.trim()) }),
      });

      await auditService.record({
        actorId: req.user!.id, actorRole: req.user!.role, action: 'DEPARTMENT_CREATED',
        resource: 'department', resourceId: department._id.toString(), department: department.code,
        requestId: req.requestId, outcome: 'SUCCESS',
        metadata: { name: department.name, code: department.code, active: department.active, dataCategories: department.dataCategories },
      });
      res.status(201).json({ message: 'Department created successfully', department });
    } catch (error) {
      if (isDuplicateKeyError(error)) { res.status(409).json({ message: 'Department code already exists' }); return; }
      res.status(500).json({ message: 'Failed to create department' });
    }
  }

  async update(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params;
    const { name, description, active, dataCategories } = req.body;

    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid department ID' }); return; }
    if (name !== undefined && !isValidName(name)) { res.status(400).json({ message: 'Name must be a non-empty string' }); return; }
    if (description !== undefined && !isValidDescription(description)) { res.status(400).json({ message: 'Description must be a non-empty string if provided' }); return; }
    if (active !== undefined && !isValidActive(active)) { res.status(400).json({ message: 'Active must be a boolean if provided' }); return; }
    if (dataCategories !== undefined && !isValidDataCategories(dataCategories)) { res.status(400).json({ message: 'dataCategories must be a non-empty array of non-empty strings' }); return; }
    if (name === undefined && description === undefined && active === undefined && dataCategories === undefined) { res.status(400).json({ message: 'At least one field is required to update' }); return; }

    try {
      const department = await Department.findById(id);
      if (!department) { res.status(404).json({ message: 'Department not found' }); return; }
      const previousActive = department.active;

      if (name !== undefined) department.name = (name as string).trim();
      if (description !== undefined) department.description = (description as string).trim();
      if (active !== undefined) department.active = active as boolean;
      if (dataCategories !== undefined) department.dataCategories = (dataCategories as string[]).map(c => c.trim());
      await department.save();

      await auditService.record({
        actorId: req.user!.id, actorRole: req.user!.role, action: 'DEPARTMENT_UPDATED',
        resource: 'department', resourceId: department._id.toString(), department: department.code,
        requestId: req.requestId, outcome: 'SUCCESS',
        metadata: { name: department.name, active: department.active, activeChanged: active !== undefined && active !== previousActive, dataCategories: department.dataCategories },
      });
      res.json({ message: 'Department updated successfully', department });
    } catch { res.status(500).json({ message: 'Failed to update department' }); }
  }

  async remove(req: Request<{ id: string }>, res: Response): Promise<void> {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ message: 'Invalid department ID' }); return; }
    try {
      if (await Integration.countDocuments({ departmentId: id }) > 0) { res.status(409).json({ message: 'Cannot delete department: integrations reference this department' }); return; }
      const department = await Department.findByIdAndDelete(id);
      if (!department) { res.status(404).json({ message: 'Department not found' }); return; }
      await auditService.record({
        actorId: req.user!.id, actorRole: req.user!.role, action: 'DEPARTMENT_DELETED',
        resource: 'department', resourceId: id, department: department.code,
        requestId: req.requestId, outcome: 'SUCCESS', metadata: { name: department.name, code: department.code },
      });
      res.json({ message: 'Department deleted successfully' });
    } catch { res.status(500).json({ message: 'Failed to delete department' }); }
  }
}
