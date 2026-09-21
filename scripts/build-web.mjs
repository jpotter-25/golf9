// Export the browser game only. Never load developer dotenv files or inherit
// unrelated EXPO_PUBLIC_* values from the server's production environment.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const clientRoot = path.join(repoRoot, 'client');
const outputDirectory = path.join(repoRoot, 'server', 'game-public');
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('EXPO_PUBLIC_')));
Object.assign(env, {
  NODE_ENV: 'production',
  EXPO_NO_DOTENV: '1',
  EXPO_PUBLIC_APP_TARGET: 'web',
  EXPO_PUBLIC_APP_ENV: 'staging',
  EXPO_PUBLIC_RELEASE_CHANNEL: 'playtest',
});

const result = spawnSync(process.execPath, [
  path.join(clientRoot, 'node_modules', 'expo', 'bin', 'cli'),
  'export', '--platform', 'web', '--max-workers', '2', '--output-dir', outputDirectory,
], { cwd: clientRoot, env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
