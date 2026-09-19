import { ConsentController } from '../controller/consentController.js';

function createContainer() {
  const controller = new ConsentController();
  return { controller };
}

export const consentContainer = createContainer();
