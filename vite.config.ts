import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import path from 'node:path';

const productionCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'"
].join('; ');

const developmentCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'"
].join('; ');

function htmlCspPlugin(command: string) {
  return {
    name: 'html-csp',
    transformIndexHtml(html: string) {
      return html.replace('%CSP_CONTENT%', command === 'serve' ? developmentCsp : productionCsp);
    }
  };
}

export default defineConfig(({ command }) => {
  return {
    root: path.resolve(__dirname, 'src/renderer'),
    base: './',
    plugins: [solid(), htmlCspPlugin(command)],
    server: {
      host: '127.0.0.1',
      port: 5173
    },
    build: {
      outDir: path.resolve(__dirname, 'renderer-dist'),
      emptyOutDir: true,
      target: 'es2022'
    }
  };
});
