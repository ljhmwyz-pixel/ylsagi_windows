const { spawn } = require('node:child_process');
const path = require('node:path');

async function main() {
  const root = path.join(__dirname, '..');
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: path.join(root, 'vite.config.ts'),
    server: {
      host: '127.0.0.1',
      port: 5173
    }
  });

  await server.listen();
  server.printUrls();

  const electronBin = require('electron');
  const url = server.resolvedUrls.local[0];
  const env = {
    ...process.env,
    VITE_DEV_SERVER_URL: url
  };

  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(electronBin, ['.'], {
    cwd: root,
    env,
    stdio: 'inherit',
    windowsHide: false
  });

  const shutdown = async (code = 0) => {
    await server.close();
    process.exit(code);
  };

  child.on('exit', (code) => {
    shutdown(code ?? 0);
  });

  process.on('SIGINT', () => {
    child.kill();
    shutdown(0);
  });

  process.on('SIGTERM', () => {
    child.kill();
    shutdown(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
