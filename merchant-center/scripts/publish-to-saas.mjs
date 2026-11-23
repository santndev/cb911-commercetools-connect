import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'public');
const marketplace = resolve(root, '../../marketplace');
const destination = resolve(marketplace, 'storage/app/connector-shells/commercetools/merchant-center');

if (!existsSync(resolve(source, 'index.html'))) {
  throw new Error('Merchant Center build output is missing index.html. Run the build before publishing.');
}

if (!existsSync(resolve(marketplace, 'artisan'))) {
  throw new Error('The marketplace checkout must be beside the Connect checkout.');
}
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });
