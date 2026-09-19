import { DocumentController } from '../controller/documentController.js';
import { DocumentService } from '../service/documentService.js';

function createContainer() {
  const service = new DocumentService();
  const controller = new DocumentController(service);
  return { service, controller };
}

export const documentContainer = createContainer();
