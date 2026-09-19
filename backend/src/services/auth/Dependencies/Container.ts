import { UserRepository } from '../repository/UserRepository.js';
import { AuthService } from '../service/authService.js';
import { AuthController } from '../controller/authController.js';

/**
 * DI Container for auth service — matches api-monitoring-system Container.js pattern.
 */
function createContainer() {
  const userRepository = new UserRepository();
  const authService = new AuthService(userRepository);
  const controller = new AuthController(authService);
  return { userRepository, authService, controller };
}

export const authContainer = createContainer();
