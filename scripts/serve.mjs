import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)), process.argv.includes('--production') ? 'dist' : '.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.split('/').some(part => part.startsWith('.') || ['node_modules', 'scripts', 'test'].includes(part))) throw new Error('Private path');
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname === '/favicon.svg' ? (process.argv.includes('--production') ? '/favicon.svg' : '/public/favicon.svg') : pathname));
    if (!file.startsWith(root + sep) && file !== root) throw new Error('Invalid path');
    response.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
server.listen(Number(process.env.PORT) || 4173, '127.0.0.1', () => console.log('Slit Studio: http://127.0.0.1:4173'));
