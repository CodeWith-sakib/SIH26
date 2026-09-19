import { VerificationController } from '../controller/verificationController.js';
import { VerificationService } from '../service/verificationService.js';
import { integrationEngine } from '../../integrationEngine/engine/IntegrationEngineImpl.js';
import { entityMatcher } from '../../integrationEngine/entityMatcher/EntityMatcherImpl.js';

function createContainer() {
  const service = new VerificationService({
    integrationEngine,
    entityMatcher
  });
  const controller = new VerificationController(service);

  return { service, controller };
}

export const verificationContainer = createContainer();
