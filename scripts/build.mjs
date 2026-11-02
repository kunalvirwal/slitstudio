import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
await rm(project + 'dist', { recursive: true, force: true });
await mkdir(project + 'dist', { recursive: true });
await cp(project + 'index.html', project + 'dist/index.html');
await cp(project + 'src', project + 'dist/src', { recursive: true });
await cp(project + 'public', project + 'dist', { recursive: true });
console.log('Built Slit Studio → dist/');
