const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(label, command, args) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function jsFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return jsFiles(fullPath);
      return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
    });
}

run('main.js syntax', 'node', ['--check', 'main.js']);
run('preload.js syntax', 'node', ['--check', 'preload.js']);

for (const file of jsFiles(path.join(root, 'src', 'main'))) {
  run(path.relative(root, file), 'node', ['--check', file]);
}

run('Unit tests', 'node', ['scripts/test-main.js']);
run('TypeScript', pnpmCommand, ['exec', 'tsc', '--noEmit']);
run('Vite production build', pnpmCommand, ['run', 'build']);
run('Electron smoke tests', 'node', ['scripts/smoke-electron.js']);

console.log('\nVerification passed.');
