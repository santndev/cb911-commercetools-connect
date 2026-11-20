import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lifecycle } from '../src/index.mjs';

const env = { CB911_LIFECYCLE_URL: 'https://saas.example.com/api/platforms/commercetools/installations/' + 'a'.repeat(32) + '/lifecycle',
  CONNECT_SERVICE_URL: 'https://service-demo.us-east-2.aws.preview.commercetools.app/service', CTP_API_URL: 'https://api.us-east-2.aws.commercetools.com', CTP_PROJECT_KEY: 'test-project',
  CTP_CLIENT_ID: 'client', CTP_CLIENT_SECRET: 'secret' };

test('sends generated credentials to the lifecycle endpoint and disables redirects', async () => {
  for (const action of ['install', 'uninstall']) {
    await lifecycle(action, env, async (url, request) => {
      assert.equal(url, env.CB911_LIFECYCLE_URL);
      assert.equal(request.redirect, 'error');
      assert.deepEqual(JSON.parse(request.body), { action, api_url: env.CTP_API_URL,
        project_key: env.CTP_PROJECT_KEY, client_id: 'client', client_secret: 'secret', service_url: env.CONNECT_SERVICE_URL });
      assert.equal(request.headers['X-CB911-Deployment-Signature'], undefined);
      return { ok: true };
    });
  }
});
test('requires the Connect service URL for either lifecycle operation', async () => {
  for (const action of ['install', 'uninstall']) {
    await assert.rejects(lifecycle(action, { ...env, CONNECT_SERVICE_URL: '' },
      () => assert.fail('No network request expected')), /Missing CONNECT_SERVICE_URL/);
  }
});
test('retries transient failures but never retries rejected authorization', async () => {
  let calls = 0;
  await lifecycle('install', env, async () => ({ ok: ++calls === 3, status: 503 }), async () => {});
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(lifecycle('uninstall', env, async () => { calls++; return { status: 403 }; }), /403/);
  assert.equal(calls, 1);
});
test('rejects unsafe targets before sending credentials', async () => {
  for (const target of ['http://saas.example.com', env.CB911_LIFECYCLE_URL + '?redirect=1']) {
    await assert.rejects(lifecycle('install', { ...env, CB911_LIFECYCLE_URL: target },
      () => assert.fail('No network request expected')), /Invalid/);
  }
});
