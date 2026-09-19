import { NotificationService } from '../service/notificationService.js';
import { NotificationController } from '../controller/notificationController.js';

function createContainer() {
  const notificationService = new NotificationService();
  const controller = new NotificationController();
  return { notificationService, controller };
}

export const notificationContainer = createContainer();
