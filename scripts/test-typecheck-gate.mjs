import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
assert.match(manifest.scripts.build, /npm run typecheck\s*&&\s*vite build/, 'Build must stop when typecheck fails');
assert.match(manifest.scripts.typecheck, /typecheck:app\s*&&\s*npm run typecheck:node/);
const run = args => {
  const result = spawnSync('npm', ['run', ...args], { cwd: root, encoding: 'utf8', timeout: 60_000 });
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr };
};
for (const [script, expected] of [
  ['typecheck:app', 'src/features/identity/DesignConfiguratorEditor.tsx'],
  ['typecheck:node', 'vite.config.ts'],
]) {
  const result = run([script, '--', '--listFiles']);
  assert.equal(result.status, 0, result.output);
  assert.ok(result.output.includes(join(root, expected)), `${script} must actually check ${expected}`);
}

// Generate a deliberately invalid app source outside the worktree. Extending
// the real app config keeps its existing include/options, adding this fixture.
const directory = mkdtempSync(join(tmpdir(), 'sa-typecheck-gate-'));
try {
  const probe = join(directory, 'app-type-error.ts');
  writeFileSync(probe, 'export const deliberateTypeError: number = "must fail";\n');
  const config = join(directory, 'tsconfig.json');
  writeFileSync(config, JSON.stringify({
    extends: join(root, 'tsconfig.app.json'), files: [probe],
  }));
  const result = run(['typecheck:app', '--', '--project', config]);
  assert.notEqual(result.status, 0, 'The actual npm command must fail on a type error');
  assert.match(result.output, /app-type-error\.ts\(1,14\): error TS2322/, result.output);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
console.log('Typecheck gate: editor and Vite config included; deliberate app type error blocks the npm command and therefore the build.');
