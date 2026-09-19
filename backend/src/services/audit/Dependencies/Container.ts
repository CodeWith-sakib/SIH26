import { AuditController } from '../controller/auditController.js';

/**
 * DI Container for the audit service — matches api-monitoring-system Container.js pattern.
 */
function createContainer() {
  const controller = new AuditController();
  return { controller };
}

export const auditContainer = createContainer();
