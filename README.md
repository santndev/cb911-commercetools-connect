# Chargebacks911 Prevent for commercetools

This connector runs the installation lifecycle service in Connect. Chargebacks911 SaaS hosts the Merchant Center application from the `merchant-center` source in this repository.

## Source access and license

Public visibility permits viewing this source; it does not grant an open-source license. Copyright remains with SQUARE ONE COMMUNICATIONS LLC. Use and redistribution require the applicable commercial agreement; see [LICENSE](LICENSE). Dependency licenses remain applicable. Never commit project credentials or deployment configuration.

## Release from Admin Console

Create the app in Chargebacks911 Admin Console. In **Configure installation**, save the Release API client credentials with `manage_connectors:<projectKey>`, region, project key, repository and reviewed tag. Use **Create draft**, **Apply repository tag**, **Request Preview** and **Check release status** from the app settings. Use **Submit marketplace listing** only for a release approved for submission. Merchant installation credentials are separate and are supplied by Connect.

## Prepare a Preview release from the browser

1. In GitHub, open **Releases → Draft a new release**. Create a unique tag targeting the reviewed commit and publish the release. GitHub repository write access is required.
2. In Merchant Center, open **Connect → Manage connectors → Organization connectors** and select the Preview draft. Edit its GitHub source, select the new tag, and save. Keep the supported projects limited to the intended QA projects.
3. Select **Request preview**. After Merchant Center reports **Preview Accepted**, follow the installation steps below. This approval applies to the selected tag and enables QA deployment.

## Install in Preview

Installations register the fixed Application URL `https://apps.chargebacks911.com/api/platforms/commercetools/marketplace`, displayed in the installation wizard. The app resolves its public SDK configuration from the uniquely matching deployment-confirmed project, region and entry point before loading the Merchant Center SDK. Local Preview tags display the local SaaS origin and cannot be submitted for listing. The optional SaaS Connect entry links to the same native installation wizard; it does not create a separate setup or collect application configuration.

1. In Admin Console, create a commercetools app, save its release authorization, repository, tag, region and project, then use **Create draft**. Request Preview and configure the new draft's installation URL. Assign and publish Payscout TEST billing, then activate the app.
2. Open **Deploy on Preview** for the accepted draft and select the intended project. Alternatively, open the app's SaaS Installation URL and select **Connect commercetools** to open that same wizard. In Merchant Center, select **your organization → Custom Applications → Configure Custom Applications → Add a Custom Application**. Copy the fixed Application URL from the wizard's field guidance, choose an unused entry point such as `chargebacks911`, add `view_project_settings` in the default View permission group and save as Draft.
3. In the installation wizard, paste the Custom Application ID and its entry point. Install the service for the intended project. No Chargebacks911 callback URL or shared secret is requested.
4. After the lifecycle callback has configured the hosted app, verify the organization's contact email, set the Custom Application to Ready and install its menu for the same project. Open Chargebacks911 Prevent from that menu. The signed Merchant Center session verifies project, region and app permissions before onboarding.
5. Verify the project details, select protection and complete the test checkout with explicit Activate. Open **Pre-Chargebacks** to verify the report belongs to the project.

The service verifies its API client and service URL against its project deployment, then sends the callback to the fixed Chargebacks911 endpoint in the reviewed source. SaaS independently verifies the grant and identifies the app from its deployment's Connector ID. No access to the creator organization's draft is needed. Local Preview preparation sets the same local SaaS origin in the callback and wizard guidance; those immutable tags cannot be submitted for listing. Merchant configuration cannot override the callback destination.

## Removal and reinstall

Use **Stop protection** in Chargebacks911 to stop protection and new fees while retaining previous usage. Alternatively, use **Connect → Manage connectors → Installations → Uninstall** for the selected project; the service sends its uninstall callback before removal. Neither action removes the Custom Application menu item: remove its project installation separately in **Manage organizations & teams → Custom Applications** if desired. Reinstall creates a new deployment. Reopen the SaaS-hosted application from Merchant Center and explicitly Activate to resume protection and billing.

## Access and tests

Connect creates the project API client with read access to orders, payments, project settings and Connect deployments. The service and SaaS use deployment read access to verify the API client belongs to a specific deployment. The Merchant Center session must identify the same project and have the application management permission. Use Node.js `^22.23.4`, `^24.22.1` or `>=26.12.1` for the application build. From `merchant-center`, run `npm ci`, `npm test` and `npm run build`. `npm run build:saas` copies the build into a sibling `marketplace` checkout; it does not deploy a production service.

To run the service and configuration tests from the repository root, use:

    node --test connect-service/tests/lifecycle.test.mjs merchant-center/tests/config.test.mjs

## Public installation status

Public source visibility does not certify or list the app. Preview and production use the same deployment-verified destination discovery; no environment-specific source tag is required. Deploy the matching SaaS endpoint before releasing this service version. Verify the complete merchant installation before requesting marketplace certification. Custom Application registration remains a merchant organization prerequisite for the embedded interface.

## Security reports

Do not post credentials, tokens or customer data in public issues. Use GitHub private vulnerability reporting when available, or the existing Chargebacks911 support channel.
