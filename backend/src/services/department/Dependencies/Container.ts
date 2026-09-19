import { DepartmentController } from '../controller/departmentController.js';

function createContainer() {
  const controller = new DepartmentController();
  return { controller };
}

export const departmentContainer = createContainer();
