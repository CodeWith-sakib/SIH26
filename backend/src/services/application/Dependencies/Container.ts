import { ApplicationController } from '../controller/applicationController.js';

function createContainer() {
  const controller = new ApplicationController();
  return { controller };
}

export const applicationContainer = createContainer();
