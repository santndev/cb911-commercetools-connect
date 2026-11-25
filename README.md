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

1. In Admin Console, create a commercetools app, save its release authorization, repository, tag, region and project, then use **Create draft**. Request Preview and configure the new draft's installation URL. Assign and publish Payscout TEST billing, then activate the app.
2. Open the app's Installation URL in a new tab. Register a Custom Application in Merchant Center using the Application URL displayed by SaaS and entry point `chargebacks911`. Add `view_project_settings` to the default View permission group and set the application to Ready. Copy its configuration page URL into the SaaS Connect page once; the application ID and organization are read from that URL. Project and region are verified when the application opens in Merchant Center.
3. In Connect, confirm the project and deploy the accepted Preview. There are no callback URL or shared-secret fields. Connect supplies the project credentials and service URL. The service sends lifecycle callbacks to `https://apps.chargebacks911.com/api/platforms/commercetools/lifecycle`; SaaS verifies the deployment with Connect and resolves the matching app from its Connector ID.
4. Return to the SaaS Connect page and use **Install app in Merchant Center**. Select the same project and save. Installing the connector alone does not add the menu item. The Application URL remains the SaaS URL supplied at registration.
5. Open Chargebacks911 from Merchant Center, verify the project details, select protection and complete the test checkout. Open **Pre-Chargebacks** to verify the report belongs to the project.

## Removal and reinstall

Use **Stop protection** in Chargebacks911 to stop protection and new fees while retaining previous usage. Alternatively, use **Connect → Manage connectors → Installations → Uninstall** for the selected project; the service sends its uninstall callback before removal. Neither action removes the Custom Application menu item: remove its project installation separately in **Manage organizations & teams → Custom Applications** if desired. Reinstall creates a new deployment. Reopen the SaaS-hosted application from Merchant Center and explicitly Activate to resume protection and billing.

## Access and tests

Connect creates the project API client with read access to orders, payments, project settings and Connect deployments. QA uses deployment read access to verify the API client belongs to a specific deployment. The Merchant Center session must identify the same project and have the application management permission. Use Node.js `^22.23.4`, `^24.22.1` or `>=26.12.1` for the application build. From `merchant-center`, run `npm ci`, `npm test` and `npm run build`. `npm run build:saas` copies the build into a sibling `marketplace` checkout; it does not deploy a production service.

To run the service and configuration tests from the repository root, use:

    node --test connect-service/tests/lifecycle.test.mjs merchant-center/tests/config.test.mjs

## Public installation status

Public source visibility does not certify or list the app. Preview and production use the same fixed Chargebacks911 callback and deployment verification. Deploy the matching SaaS endpoint before releasing this service version. Verify the complete merchant installation before requesting marketplace certification. Custom Application registration remains a merchant organization prerequisite for the embedded interface.

## Security reports

Do not post credentials, tokens or customer data in public issues. Use GitHub private vulnerability reporting when available, or the existing Chargebacks911 support channel.
