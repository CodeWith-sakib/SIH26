import { ProfileController } from '../controller/profileController.js';

function createContainer() {
  const controller = new ProfileController();
  return { controller };
}

export const profileContainer = createContainer();
