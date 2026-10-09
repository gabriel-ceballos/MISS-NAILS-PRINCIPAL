
import {cp, mkdir, rm} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');

await rm(out, {recursive: true, force: true});
await mkdir(out, {recursive: true});

for (const file of ['index.html', 'manifest.webmanifest']) {
  await cp(join(root, file), join(out, file));
}

for (const dir of ['app', 'styles', 'assets']) {
  await cp(join(root, dir), join(out, dir), {recursive: true});
}

// Empaqueta el punto de entrada y resuelve los módulos
// de Capacitor y los módulos locales de la aplicación.
await build({
  entryPoints: [join(root, 'app', 'app.js')],
  outfile: join(out, 'app', 'app.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022'
});

console.log('MISS NAILS web build: www generado y JavaScript empaquetado.');
