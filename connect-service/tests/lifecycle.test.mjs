import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { lifecycle, LIFECYCLE_URL } from '../src/index.mjs';

const env = {
  CONNECT_SERVICE_URL: 'https://service-demo.us-east-2.aws.preview.commercetools.app/service', CTP_API_URL: 'https://api.us-east-2.aws.commercetools.com', CTP_PROJECT_KEY: 'test-project',
  CTP_CLIENT_ID: 'client', CTP_CLIENT_SECRET: 'secret' };

const ENTRY_URL = 'https://saas.example.com/connector?platform=commercetools&app=11111111111111111111111111111111';
const connector = { id: 'connector-id', documentationUrl: ENTRY_URL };
const deployment = { apiClient: { id: 'client' }, status: 'Deploying', type: 'preview',
  connector: { id: connector.id }, applications: [{ applicationName: 'connect-service', url: env.CONNECT_SERVICE_URL }] };
const withDeployment = (callback, rows = [deployment], metadata = connector) => async (url, request) => {
  assert.equal(request.redirect, 'error');
  if (url.endsWith('/oauth/token')) {
    assert.equal(new URLSearchParams(request.body).get('scope'), 'view_connectors_deployments:test-project');
    assert.match(request.headers.Authorization, /^Basic /);
    return { ok: true, json: async () => ({ access_token: 'deployment-read-token' }) };
  }
  if (new URL(url).pathname.endsWith('/deployments')) return { ok: true, json: async () => ({ results: rows }) };
  if (new URL(url).pathname.includes('/connectors/')) return { ok: true, json: async () => metadata };
  return callback(url, request);
};

test('sends generated credentials to the lifecycle endpoint and disables redirects', async () => {
  for (const action of ['install', 'uninstall']) {
    await lifecycle(action, env, withDeployment(async (url, request) => {
      assert.equal(url, LIFECYCLE_URL);
      assert.equal(request.redirect, 'error');
      assert.deepEqual(JSON.parse(request.body), { action, api_url: env.CTP_API_URL,
        project_key: env.CTP_PROJECT_KEY, client_id: 'client', client_secret: 'secret', service_url: env.CONNECT_SERVICE_URL });
      assert.equal(request.headers['X-CB911-Deployment-Signature'], undefined);
      return { ok: true };
    }));
  }
});
test('requires the Connect service URL for either lifecycle operation', async () => {
  for (const action of ['install', 'uninstall']) {
    await assert.rejects(lifecycle(action, { ...env, CONNECT_SERVICE_URL: '' },
      () => assert.fail('No network request expected')), /Missing CONNECT_SERVICE_URL/);
  }
});

test('delivers a cross-org Preview callback when the creator draft is not readable', async () => {
  let callbacks = 0;
  const send = withDeployment(async () => { callbacks++; return { ok: true }; });
  await lifecycle('install', env, (url, request) => new URL(url).pathname.includes('/connectors/')
    ? Promise.resolve({ ok: false, status: 404 }) : send(url, request));
  assert.equal(callbacks, 1);
});
test('retries transient failures but never retries rejected authorization', async () => {
  let calls = 0;
  await lifecycle('install', env, withDeployment(async () => ({ ok: ++calls === 3, status: 503 })), async () => {});
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(lifecycle('uninstall', env, withDeployment(async () => { calls++; return { status: 403 }; })), /403/);
  assert.equal(calls, 1);
});
test('never lets deployment configuration redirect generated credentials', async () => {
  await lifecycle('install', { ...env, CB911_LIFECYCLE_URL: 'https://attacker.example.com' }, withDeployment(async (url) => {
    assert.equal(url, LIFECYCLE_URL);
    return { ok: true };
  }));
});

test('delivers install, uninstall and reinstall over HTTP, retrying a temporary failure', async () => {
  const received = [];
  const discovery = [];
  const server = createServer(async (request, response) => {
    if (request.url === '/oauth/token') {
      discovery.push('token');
      const id = Buffer.from(request.headers.authorization.slice(6), 'base64').toString().split(':')[0];
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ access_token: `read:${id}` }));
      return;
    }
    if (request.url.startsWith('/test-project/deployments?')) {
      discovery.push('deployment');
      const id = request.headers.authorization.slice('Bearer read:'.length);
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ results: [{ ...deployment, apiClient: { id } }] }));
      return;
    }
    if (request.url === '/connectors/drafts/connector-id') {
      discovery.push('connector');
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(connector));
      return;
    }
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
    const send = (url, options) => fetch(new URL(new URL(url).pathname + new URL(url).search, origin), options);
    await lifecycle('install', env, send, async () => {});
    await lifecycle('uninstall', env, send);
    await lifecycle('install', { ...env, CTP_CLIENT_ID: 'replacement' }, send);

    assert.deepEqual(discovery, Array(4).fill(['token', 'deployment']).flat());
    assert.deepEqual(received.map(({ body }) => [body.action, body.client_id]), [
      ['install', 'client'], ['install', 'client'], ['uninstall', 'client'], ['install', 'replacement'],
    ]);
    assert.ok(received.every(({ method, path, body }) => method === 'POST'
      && path === new URL(LIFECYCLE_URL).pathname
      && body.project_key === env.CTP_PROJECT_KEY && body.service_url === env.CONNECT_SERVICE_URL));
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});


test('uses the release-owned callback destination regardless of merchant app metadata', async () => {
  for (const origin of ['https://saas.example.com', 'https://local-tunnel.example.com']) {
    const entry = new URL(ENTRY_URL); entry.hostname = new URL(origin).hostname;
    await lifecycle('install', env, withDeployment(async url => {
      assert.equal(url, LIFECYCLE_URL);
      return { ok: true };
    }, [deployment], { ...connector, documentationUrl: entry.href }));
  }
});

test('rejects foreign, missing or ambiguous deployment proof without sending a callback', async () => {
  for (const rows of [[], [deployment, deployment], [{ ...deployment, apiClient: { id: 'foreign' } }],
    [{ ...deployment, applications: [{ applicationName: 'connect-service', url: 'https://foreign.example/service' }] }]]) {
    await assert.rejects(lifecycle('install', env, withDeployment(() => assert.fail('No callback'), rows), async () => {}), /lifecycle request failed/);
  }
});

test('ignores unsafe app metadata and rejects unsafe API origins before exposing project credentials', async () => {
  for (const url of ['http://saas.example.com/connector', 'https://user:pass@saas.example.com/connector',
    'https://saas.example.com/other', 'https://saas.example.com/connector?platform=commercetools&app=wrong']) {
    await lifecycle('install', env, withDeployment(async destination => {
      assert.equal(destination, LIFECYCLE_URL);
      return { ok: true };
    }, [deployment], { ...connector, documentationUrl: url }));
  }
  for (const api of ['https://api.attacker.example.com', 'http://api.us-east-2.aws.commercetools.com',
    'https://user:pass@api.us-east-2.aws.commercetools.com', 'https://api.us-east-2.aws.commercetools.com/path']) {
    await assert.rejects(lifecycle('install', { ...env, CTP_API_URL: api }, () => assert.fail('No request')), /Invalid Connect API origin/);
  }
});

test('accepts its provisioning deployment before its service URL is populated', async () => {
  await lifecycle('install', env, withDeployment(async () => ({ ok: true }),
    [{ ...deployment, applications: [{ applicationName: 'connect-service' }] }]));
});


test('finds only the matching deployment across bounded pages', async () => {
  const offsets = [];
  const send = withDeployment(async url => {
    assert.equal(url, LIFECYCLE_URL);
    return { ok: true };
  });
  await lifecycle('install', env, async (url, options) => {
    if (new URL(url).pathname.endsWith('/deployments')) {
      const offset = new URL(url).searchParams.get('offset'); offsets.push(offset);
      return { ok: true, json: async () => ({ results: offset === '0'
        ? Array(100).fill({ ...deployment, apiClient: { id: 'other' } }) : [deployment] }) };
    }
    return send(url, options);
  });
  assert.deepEqual(offsets, ['0', '100']);
});

test('fails closed on discovery authentication failure without retry or callback', async () => {
  let requests = 0;
  await assert.rejects(lifecycle('install', env, async url => {
    requests++; assert.ok(url.endsWith('/oauth/token'));
    return { status: 401 };
  }), /Connect discovery failed/);
  assert.equal(requests, 1);
});


test('does not require creator access for production or sandbox and rejects incomplete deployment identity', async () => {
  for (const type of ['production', 'sandbox']) {
    const send = withDeployment(async url => { assert.equal(url, LIFECYCLE_URL); return { ok: true }; }, [{ ...deployment, type }]);
    await lifecycle('install', env, async (url, options) => {
      assert.ok(!new URL(url).pathname.includes('/connectors/'));
      return send(url, options);
    });
  }
  await assert.rejects(lifecycle('install', env, withDeployment(() => assert.fail('No callback'),
    [{ ...deployment, connector: {} }]), async () => {}), /deployment identity is incomplete/);
});

test('does not use destination data injected into the deployment projection', async () => {
  await lifecycle('install', env, withDeployment(async url => { assert.equal(url, LIFECYCLE_URL); return { ok: true }; },
    [{ ...deployment, connector: { id: connector.id, documentationUrl: 'https://attacker.example.com' } }]));
});
