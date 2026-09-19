import { IntegrationController } from '../controller/integrationController.js';

function createContainer() {
  const controller = new IntegrationController();
  return { controller };
}

export const integrationContainer = createContainer();
