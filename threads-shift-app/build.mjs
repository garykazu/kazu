// This app is plain HTML/JavaScript; preserve its GitHub Pages directory layout.
import { readFile, mkdir, copyFile, cp } from 'node:fs/promises';
import { Script } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, process.argv[2] || '/tmp/kazu-threads-build');
if (output === root || root.startsWith(output + '/') || output.startsWith(root + '/')) throw new Error('Output must not overwrite source');
const html = await readFile(join(root, 'index.html'), 'utf8');
for (const [, attributes, code] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (!/\bsrc=/.test(attributes)) new Script(code, { filename: 'index.html inline script' });
}
new Script(await readFile(join(root, 'profile-import.js'), 'utf8'), { filename: 'profile-import.js' });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'profile-import.js']) await copyFile(join(root, file), join(output, file));
await cp(join(root, 'core'), join(output, 'core'), { recursive: true });
console.log('Threads Shift Studio: JavaScript syntax checked; static build saved to ' + output);
