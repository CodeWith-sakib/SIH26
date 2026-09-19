import { EmploymentController } from '../controller/employmentController.js';
import { EmploymentService } from '../service/employmentService.js';

function createContainer() {
  const service = new EmploymentService();
  const controller = new EmploymentController(service);
  return { service, controller };
}

export const employmentContainer = createContainer();
