import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import PrimaryButton from '@commercetools-uikit/primary-button';
import Text from '@commercetools-uikit/text';

let ApplicationShell, setupGlobalErrorListener, useApplicationContext, useAsyncDispatch, actions;

function WorkspaceError({ status, configuration = false, onRetry }) {
  useEffect(() => { window.onAppLoaded?.(); }, []);
  const setupMissing = configuration && status === 404;
  const accessDenied = status === 401 || status === 403;
  const [projectKey, entryPath] = window.location.pathname.split('/').filter(Boolean);
  return <section role="alert" aria-label="Workspace recovery" style={{ maxWidth: 640, margin: '48px auto', padding: 32,
    fontFamily: 'var(--font-family, system-ui)', lineHeight: 1.6,
    border: '1px solid var(--color-neutral-90, hsl(232, 18%, 90%))', borderRadius: 'var(--border-radius-8, 8px)' }}>
    <Text.Detail tone="secondary">Chargebacks911 Prevent</Text.Detail>
    <Text.Headline as="h1">{setupMissing ? 'Check your app installation' : accessDenied ? 'Check your access' : 'Your workspace is temporarily unavailable'}</Text.Headline>
    <Text.Body>{setupMissing
      ? 'We could not match this app to a connector installation for this project. The connector may not be installed yet, or it may use a different Custom Application.'
      : accessDenied ? 'Your session may have expired, or your account may not have permission to manage this application.'
        : 'We could not load your workspace. Try again in a moment. Your saved setup and billing have not been changed.'}</Text.Body>
    <Text.Detail tone="secondary">Project: {projectKey} · App entry point: {entryPath}</Text.Detail>
    {setupMissing && <ol style={{ paddingLeft: 24, lineHeight: 1.6 }}>
      <li><Text.Body>In Merchant Center → Manage connectors → Installations, check that the connector is installed for this project.</Text.Body></li>
      <li><Text.Body>In your organization → Custom Applications → Configure Custom Applications, check that its Application ID and entry point match the connector installation configuration.</Text.Body></li>
      <li><Text.Body>Set that Custom Application to Ready, install it for the same project, then open it from the project menu.</Text.Body></li>
    </ol>}
    {accessDenied && <Text.Body>Reload the application. If access is still denied, ask your organization administrator to check your application permissions for this project.</Text.Body>}
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24, marginTop: 24 }}>
      <PrimaryButton label="Try again" onClick={onRetry} />
      {setupMissing && <a href="/account/organizations">Open organization settings</a>}
    </div>
  </section>;
}

function Workspace() {
  const projectKey = useApplicationContext(context => context.project?.key);
  return <ProjectWorkspace key={projectKey} projectKey={projectKey} />;
}

function ProjectWorkspace({ projectKey }) {
  const dispatch = useAsyncDispatch();
  const [workspace, setWorkspace] = useState(null);
  const [failed, setFailed] = useState(null);
  const requestSequence = useRef(0);
  const connect = useCallback(async () => {
    if (!projectKey) return;
    const sequence = ++requestSequence.current;
    setFailed(null);
    try {
      const result = await dispatch(actions.forwardTo.post({
        uri: window.app.connectorSessionUrl, includeUserPermissions: true,
        payload: { project_key: projectKey, region: new URL(window.app.mcApiUrl).hostname.replace(/^mc-api\./, '').replace(/\.commercetools\.com$/, '') },
      }));
      const url = new URL(result.data.launch_url);
      if (url.origin !== new URL(window.app.connectorSessionUrl).origin) throw new Error('Invalid workspace');
      if (sequence === requestSequence.current) setWorkspace(url.href);
    } catch (error) {
      if (sequence === requestSequence.current) setFailed({ status: error.statusCode });
    }
  }, [dispatch, projectKey]);
  useEffect(() => {
    connect();
    return () => { requestSequence.current += 1; };
  }, [connect]);
  if (failed) return <WorkspaceError status={failed.status} onRetry={connect} />;
  if (!workspace) return <LoadingSpinner>Preparing your Chargebacks911 workspace…</LoadingSpinner>;
  return <iframe title="Chargebacks911 workspace" src={workspace} referrerPolicy="no-referrer" style={{ width: '100%', height: 'calc(100vh - 100px)', border: 0 }} />;
}

async function start() {
  if (window.app.connectorConfigurationUrl) {
    const [projectKey, entryPath] = window.location.pathname.split('/').filter(Boolean);
    const url = new URL(window.app.connectorConfigurationUrl);
    url.search = new URLSearchParams({ project_key: projectKey || '', entry_path: entryPath || '',
      region: new URL(window.app.mcApiUrl).hostname.replace(/^mc-api\./, '').replace(/\.commercetools\.com$/, '') });
    const response = await fetch(url, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw Object.assign(new Error('Application configuration is unavailable'), { statusCode: response.status });
    Object.assign(window.app, (await response.json()).data);
  }
  ({ ApplicationShell, setupGlobalErrorListener } = await import('@commercetools-frontend/application-shell'));
  ({ useApplicationContext } = await import('@commercetools-frontend/application-shell-connectors'));
  ({ useAsyncDispatch, actions } = await import('@commercetools-frontend/sdk'));
  setupGlobalErrorListener();
  createRoot(document.getElementById('app')).render(
    <ApplicationShell environment={window.app} applicationMessages={async () => ({})}>
      <Workspace />
    </ApplicationShell>
  );
}

start().catch(error => createRoot(document.getElementById('app')).render(
  <WorkspaceError status={error.statusCode} configuration onRetry={() => window.location.reload()} />
));
