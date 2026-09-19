import 'dotenv/config';

import { seedDemoData } from './demo-seed.js';

async function main(): Promise<void> {
  await seedDemoData();
  const { startServer } = require('../server.js');
  await startServer();
}

main().catch((error: unknown) => {
  console.error(
    `Demo startup failed: ${error instanceof Error ? error.message : 'Unknown startup error'}`
  );
  process.exit(1);
});