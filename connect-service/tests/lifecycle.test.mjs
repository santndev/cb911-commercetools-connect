import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
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

test('delivers install, uninstall and reinstall over HTTP, retrying a temporary failure', async () => {
  const received = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received.push({ method: request.method, path: request.url, body: JSON.parse(Buffer.concat(chunks).toString()) });
    response.writeHead(received.length === 1 ? 503 : 200).end();
  });
  server.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    // Route the validated HTTPS destination to a self-contained HTTP fixture.
    const send = (url, options) => fetch(new URL(new URL(url).pathname, origin), options);
    await lifecycle('install', env, send, async () => {});
    await lifecycle('uninstall', env, send);
    await lifecycle('install', { ...env, CTP_CLIENT_ID: 'replacement' }, send);

    assert.deepEqual(received.map(({ body }) => [body.action, body.client_id]), [
      ['install', 'client'], ['install', 'client'], ['uninstall', 'client'], ['install', 'replacement'],
    ]);
    assert.ok(received.every(({ method, path, body }) => method === 'POST'
      && path === new URL(env.CB911_LIFECYCLE_URL).pathname
      && body.project_key === env.CTP_PROJECT_KEY && body.service_url === env.CONNECT_SERVICE_URL));
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
