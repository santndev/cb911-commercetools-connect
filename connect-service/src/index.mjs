import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export const LIFECYCLE_URL = 'https://apps.chargebacks911.com/api/platforms/commercetools/lifecycle';

async function lifecycleUrl(env, send) {
  const api = new URL(env.CTP_API_URL);
  const region = api.hostname.match(/^api\.(us-central1\.gcp|us-east-2\.aws|europe-west1\.gcp|eu-central-1\.aws|australia-southeast1\.gcp)\.commercetools\.com$/)?.[1];
  if (!region || api.protocol !== 'https:' || api.username || api.password || api.port || api.pathname !== '/' || api.search || api.hash) {
    throw Object.assign(new Error('Invalid Connect API origin'), { status: 400 });
  }
  const request = async (url, options = {}) => {
    const response = await send(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Object.assign(new Error(`Connect discovery failed (${response.status})`), { status: response.status });
    return response.json();
  };
  const token = await request(`https://auth.${region}.commercetools.com/oauth/token`, {
    method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${env.CTP_CLIENT_ID}:${env.CTP_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: `view_connectors_deployments:${env.CTP_PROJECT_KEY}` }),
  });
  if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Connect returned no access token');
  const matches = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await request(`https://connect.${region}.commercetools.com/${encodeURIComponent(env.CTP_PROJECT_KEY)}/deployments?limit=100&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' } });
    if (!Array.isArray(page.results)) throw new Error('Connect returned no deployments');
    matches.push(...page.results.filter(deployment => deployment.apiClient?.id === env.CTP_CLIENT_ID
      && deployment.applications?.some(app => app.applicationName === 'connect-service'
        && (app.url === env.CONNECT_SERVICE_URL || (deployment.status === 'Deploying' && !app.url)))));
    if (page.results.length < 100) break;
    if (offset === 900) throw new Error('Connect deployment lookup exceeded its limit');
  }
  if (matches.length !== 1) throw new Error('Connect has not confirmed a unique deployment');
  const own = matches[0];
  const connectorId = own.connector?.id;
  if (typeof connectorId !== 'string' || !connectorId || !['preview', 'sandbox', 'production'].includes(own.type)) {
    throw new Error('Connect deployment identity is incomplete');
  }
  return LIFECYCLE_URL;
}

export async function lifecycle(action, env = process.env, send = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  if (!['install', 'uninstall'].includes(action)) throw new Error('Invalid lifecycle operation');
  for (const key of ['CONNECT_SERVICE_URL', 'CTP_API_URL', 'CTP_PROJECT_KEY', 'CTP_CLIENT_ID', 'CTP_CLIENT_SECRET']) {
    if (!env[key]?.trim()) throw new Error(`Missing ${key}`);
  }
  const body = JSON.stringify({ action, api_url: env.CTP_API_URL, project_key: env.CTP_PROJECT_KEY,
    client_id: env.CTP_CLIENT_ID, client_secret: env.CTP_CLIENT_SECRET, service_url: env.CONNECT_SERVICE_URL });
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      const url = await lifecycleUrl(env, send);
      response = await send(url, { method: 'POST', redirect: 'error',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body,
        signal: AbortSignal.timeout(60000) });
    } catch (error) {
      if (error.status && error.status !== 429 && error.status < 500) throw error;
      if (attempt === 2) throw new Error(`Chargebacks911 lifecycle request failed: ${error.message}`);
    }
    if (response?.ok) return;
    if (response && response.status !== 429 && response.status < 500) {
      throw new Error(`Chargebacks911 rejected lifecycle request (${response.status})`);
    }
    if (attempt === 2) throw new Error('Chargebacks911 lifecycle request failed');
    await wait(1000 * 2 ** attempt);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2]) {
    lifecycle(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1; });
  } else {
    createServer((request, response) => {
      response.writeHead(request.method === 'GET' && request.url === '/service' ? 200 : 404,
        { 'Content-Type': 'application/json' });
      response.end('{}');
    }).listen(Number(process.env.PORT || 8080));
  }
}
