import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ApplicationShell, setupGlobalErrorListener } from '@commercetools-frontend/application-shell';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import { useAsyncDispatch, actions } from '@commercetools-frontend/sdk';
import LoadingSpinner from '@commercetools-uikit/loading-spinner';
import PrimaryButton from '@commercetools-uikit/primary-button';
import Text from '@commercetools-uikit/text';

function Workspace() {
  const projectKey = useApplicationContext(context => context.project?.key);
  return <ProjectWorkspace key={projectKey} projectKey={projectKey} />;
}

function ProjectWorkspace({ projectKey }) {
  const dispatch = useAsyncDispatch();
  const [workspace, setWorkspace] = useState(null);
  const [failed, setFailed] = useState(false);
  const requestSequence = useRef(0);
  const connect = useCallback(async () => {
    if (!projectKey) return;
    const sequence = ++requestSequence.current;
    setFailed(false);
    try {
      const result = await dispatch(actions.forwardTo.post({
        uri: window.app.connectorSessionUrl, includeUserPermissions: true,
        payload: { project_key: projectKey, region: new URL(window.app.mcApiUrl).hostname.replace(/^mc-api\./, '').replace(/\.commercetools\.com$/, '') },
      }));
      const url = new URL(result.data.launch_url);
      if (url.origin !== new URL(window.app.connectorSessionUrl).origin) throw new Error('Invalid workspace');
      if (sequence === requestSequence.current) setWorkspace(url.href);
    } catch {
      if (sequence === requestSequence.current) setFailed(true);
    }
  }, [dispatch, projectKey]);
  useEffect(() => {
    connect();
    return () => { requestSequence.current += 1; };
  }, [connect]);
  if (failed) return <section role="alert"><Text.Headline as="h2">Unable to open your workspace</Text.Headline><Text.Body>Please try again. If this continues, contact your project administrator.</Text.Body><PrimaryButton label="Try again" onClick={connect} /></section>;
  if (!workspace) return <LoadingSpinner>Preparing your Chargebacks911 workspace…</LoadingSpinner>;
  return <iframe title="Chargebacks911 workspace" src={workspace} referrerPolicy="no-referrer" style={{ width: '100%', height: 'calc(100vh - 100px)', border: 0 }} />;
}

setupGlobalErrorListener();
createRoot(document.getElementById('app')).render(
  <ApplicationShell environment={window.app} applicationMessages={async () => ({})}>
    <Workspace />
  </ApplicationShell>
);
