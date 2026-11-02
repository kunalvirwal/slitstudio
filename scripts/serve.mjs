import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)), process.argv.includes('--production') ? 'dist' : '.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.split('/').some(part => part.startsWith('.') || ['node_modules', 'scripts', 'test'].includes(part))) throw new Error('Private path');
    const vendor = pathname === '/vendor/mediabunny.min.mjs' && !process.argv.includes('--production');
    const file = vendor ? resolve(root,'node_modules/mediabunny/dist/bundles/mediabunny.min.mjs') : resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname === '/favicon.svg' ? (process.argv.includes('--production') ? '/favicon.svg' : '/public/favicon.svg') : pathname));
    if (!file.startsWith(root + sep) && file !== root) throw new Error('Invalid path');
    response.setHeader('Content-Type', vendor ? 'text/javascript' : types[extname(file)] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});
const hostOption = process.argv.indexOf('--host');
const bindHost = hostOption === -1 ? '127.0.0.1' : process.argv[hostOption + 1];
if (!bindHost || bindHost.startsWith('--')) throw new Error('Provide a hostname after --host.');
const port = Number(process.env.PORT) || 4173;
server.listen(port, bindHost, () => console.log(`Slit Studio: http://${bindHost}:${port}`));
