import 'dotenv/config';

import { startMockServers } from '../__tests__/mock-department-servers';
import { seedDemoData } from './demo-seed';

async function main(): Promise<void> {
  await startMockServers();
  await seedDemoData();
  const { startServer } = require('../../server');
  await startServer();
}

main().catch((error: unknown) => {
  console.error(
    `Demo startup failed: ${error instanceof Error ? error.message : 'Unknown startup error'}`
  );
  process.exit(1);
});