import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

test('Connect manifest is valid YAML', () => {
  assert.doesNotThrow(() => load(readFileSync(new URL('../../connect.yaml', import.meta.url), 'utf8')));
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
  assert.equal(config.icon, '${path:./express-resolve-logo-sidebar-mark.svg}');
  assert.ok(!JSON.stringify(config).includes(process.env.CTP_CLIENT_SECRET));
});
