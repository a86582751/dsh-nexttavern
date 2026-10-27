/** Quality-runner entry for the existing Linux/JDK-only native core test. No APK build. */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'linux') {
  console.error('BLOCKED: this native-core check uses the documented Linux/JDK toolchain.');
  process.exitCode = 2;
} else {
  const module = process.argv[2] ?? 'app';
  if (module !== 'app' && module !== 'mobile') throw new Error('Expected app or mobile core suite');
  const script = resolve(dirname(fileURLToPath(import.meta.url)), '../' + module + '/tools/test-core.sh');
  const result = spawnSync('bash', [script], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
