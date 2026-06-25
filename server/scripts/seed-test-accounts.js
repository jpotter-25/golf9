import path from 'path';
import { fileURLToPath } from 'url';
import { seedDevTestAccountsInStore } from '../testAccounts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(serverDir, 'data');
const dataFile = path.join(dataDir, 'auth-store.json');
const result = seedDevTestAccountsInStore(dataFile);

console.log(result.changed ? 'Seeded local test accounts.' : 'Local test accounts already exist.');
for (const account of result.accounts) {
  console.log(`${account.displayName} / ${account.password}`);
}
