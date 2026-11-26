import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { runInNewContext } from 'node:vm';

test('fixed Marketplace hosting resolves SDK identity before startup without credentials', async () => {
  const source = readFileSync(new URL('../src/index.jsx', import.meta.url), 'utf8');
  const bootstrap = source.split('async function start() {')[1].split('  ({ ApplicationShell, setupGlobalErrorListener }')[0];
  assert.ok(!source.includes("from '@commercetools-frontend/"));
  const window = { app: { connectorConfigurationUrl: 'https://saas.example.com/configuration', mcApiUrl: 'https://mc-api.us-east-2.aws.commercetools.com' },
    location: { pathname: '/merchant-project/merchant-app/reports' } };
  let started = false;
  let requested;
  const run = (ok = true) => runInNewContext(`(async () => {${bootstrap}\n startup(); })()`, {
    window, URL, URLSearchParams, AbortSignal,
    fetch: async (url, options) => {
      requested = url;
      assert.equal(options.credentials, 'omit');
      assert.equal(options.redirect, 'error');
      return { ok, json: async () => ({ data: { applicationId: 'merchant-id:merchant-app', entryPointUriPath: 'merchant-app' } }) };
    },
    startup: () => { assert.equal(window.app.applicationId, 'merchant-id:merchant-app'); started = true; },
  });
  await run();
  assert.equal(started, true);
  assert.deepEqual(Object.fromEntries(requested.searchParams), { project_key: 'merchant-project', entry_path: 'merchant-app', region: 'us-east-2.aws' });
  started = false;
  await assert.rejects(run(false), /configuration is unavailable/);
  assert.equal(started, false);
  delete window.app.connectorConfigurationUrl;
  await run(false);
  assert.equal(started, true);
});

test('Connect installs only the lifecycle service', () => {
  const manifest = load(readFileSync(new URL('../../connect.yaml', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.deployAs.map(({ name, applicationType }) => [name, applicationType]), [
    ['connect-service', 'service'],
  ]);
  assert.deepEqual(manifest.deployAs[0].configuration.standardConfiguration.map(({key, required}) => [key, required]), [
    ['CUSTOM_APPLICATION_CONFIGURATION_URL', true], ['ENTRY_POINT_URI_PATH', true],
  ]);
  assert.equal(manifest.deployAs[0].configuration.securedConfiguration, undefined);
});

test('Connect deployment uses provider URL and IDs without exposing generated API credentials', async () => {
  Object.assign(process.env, {
    CUSTOM_APPLICATION_ID: 'connect-app-id', APPLICATION_URL: 'shell.example.com',
    ENTRY_POINT_URI_PATH: 'chargebacks911', CLOUD_IDENTIFIER: 'aws-us',
    CB911_SESSION_URL: 'https://saas.example.com/api/platforms/commercetools/installations/app/session',
    CTP_CLIENT_SECRET: 'must-not-be-in-browser', MC_APPLICATION_URL: 'https://legacy.example.com',
  });
  const { default: config } = await import('../custom-application-config.mjs?connect');
  assert.equal(config.env.production.url, 'https://shell.example.com');
  assert.equal(config.env.production.applicationId, 'connect-app-id');
  assert.equal(config.additionalEnv.connectorSessionUrl, process.env.CB911_SESSION_URL);
  assert.deepEqual(config.headers.csp['frame-src'], ['https://saas.example.com']);
  assert.deepEqual(config.headers.csp['connect-src'], ['https://saas.example.com']);
  assert.equal(config.icon, '${path:./express-resolve-logo-sidebar-mark.svg}');
  assert.ok(!JSON.stringify(config).includes(process.env.CTP_CLIENT_SECRET));
});

test('Connect validation builds before a deployment URL is configured', async () => {
  process.env.CB911_SESSION_URL = 'CB911_SESSION_URL';
  const { default: config } = await import('../custom-application-config.mjs?validation');
  assert.deepEqual(config.headers.csp['frame-src'], []);
  assert.deepEqual(config.headers.csp['connect-src'], []);
});

test('patched build glob and development transport retain their required APIs', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const scriptsRequire = createRequire(require.resolve('@commercetools-frontend/mc-scripts/package.json'));
  const shellRequire = createRequire(require.resolve('@commercetools-frontend/application-shell/package.json'));
  const permissionsRequire = createRequire(shellRequire.resolve('@commercetools-frontend/permissions/package.json'));
  const componentsRequire = createRequire(shellRequire.resolve('@commercetools-frontend/application-components/package.json'));
  assert.equal(permissionsRequire.resolve('@commercetools-frontend/application-shell-connectors'),
    require.resolve('@commercetools-frontend/application-shell-connectors'));
  assert.equal(componentsRequire.resolve('@commercetools-frontend/application-shell-connectors'),
    require.resolve('@commercetools-frontend/application-shell-connectors'));
  const { glob } = scriptsRequire('glob');
  assert.ok((await glob('src/*.jsx', { cwd: new URL('../', import.meta.url) })).some(path => path.replaceAll('\\', '/') === 'src/index.jsx'));
  const transportRequire = createRequire(scriptsRequire.resolve('webpack-dev-server'));
  const sockjsRequire = createRequire(transportRequire.resolve('sockjs'));
  const { v4 } = sockjsRequire('uuid');
  assert.match(v4(), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(typeof transportRequire('sockjs').createServer().installHandlers, 'function');
});
