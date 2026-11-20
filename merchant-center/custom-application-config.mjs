const applicationUrl = process.env.APPLICATION_URL || process.env.MC_APPLICATION_URL;
const sessionUrl = process.env.CB911_SESSION_URL;
// Connect validates the build before a deployment supplies its HTTPS session URL.
const saasOrigins = sessionUrl?.startsWith('https://') && URL.canParse(sessionUrl)
  ? [new URL(sessionUrl).origin]
  : [];

export default {
  name: 'Chargebacks911',
  entryPointUriPath: process.env.ENTRY_POINT_URI_PATH || 'chargebacks911',
  cloudIdentifier: process.env.CLOUD_IDENTIFIER || process.env.MC_CLOUD_IDENTIFIER || 'aws-us',
  env: {
    development: { initialProjectKey: process.env.MC_PROJECT_KEY || '' },
    production: {
      applicationId: process.env.CUSTOM_APPLICATION_ID || process.env.MC_APPLICATION_ID,
      url: applicationUrl ? (/^https?:\/\//.test(applicationUrl) ? applicationUrl : `https://${applicationUrl}`) : undefined,
    },
  },
  additionalEnv: { connectorSessionUrl: sessionUrl },
  headers: { csp: { 'connect-src': saasOrigins, 'frame-src': saasOrigins } },
  oAuthScopes: { view: ['view_orders', 'view_payments', 'view_project_settings'], manage: [] },
  icon: '${path:./express-resolve-logo-sidebar-mark.svg}',
  mainMenuLink: { defaultLabel: 'Chargebacks911', permissions: ['ViewChargebacks911'] },
  submenuLinks: [],
};
