import { cpSync, existsSync, mkdirSync, rmSync, rmdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'public');
const destination = resolve(root, '../../../storage/app/connector-shells/commercetools/merchant-center');
const legacyDestination = resolve(root, '../../../public/connector/commercetools/merchant-center');

if (!existsSync(resolve(source, 'index.html'))) {
  throw new Error('Merchant Center build output is missing index.html. Run the build before publishing.');
}

rmSync(destination, { recursive: true, force: true });
rmSync(legacyDestination, { recursive: true, force: true });
try {
  rmdirSync(resolve(legacyDestination, '..'));
} catch (error) {
  if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error;
}
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });
