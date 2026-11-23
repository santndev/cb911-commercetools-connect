# Chargebacks911 Prevent for commercetools

This connector runs the installation lifecycle service in Connect. Chargebacks911 SaaS hosts the Merchant Center application from the `merchant-center` source in this repository.

## Prepare a Preview release from the browser

1. In GitHub, open **Releases → Draft a new release**. Create a unique tag targeting the reviewed commit and publish the release. GitHub repository write access is required.
2. In Merchant Center, open **Connect → Manage connectors → Organization connectors** and select the Preview draft. Edit its GitHub source, select the new tag, and save. Keep the supported projects limited to the intended QA projects.
3. Select **Request preview**. After Merchant Center reports **Preview Accepted**, follow the installation steps below. This approval applies to the selected tag and enables QA deployment.

## Install in Preview

1. In Admin Console, create a commercetools app, save its release authorization, repository, tag, region and project, then use **Create draft**. Request Preview and configure the new draft's installation URL. Assign and publish Payscout TEST billing, then activate the app.
2. Open the app's Installation URL in a new tab. Register a new Custom Application in Merchant Center using the Application URL displayed by SaaS and an unused entry point. Add `view_project_settings` to the default View permission group. Enter the generated application ID, entry point, project and region once on the SaaS Connect page.
3. In Connect, confirm the project and deploy the accepted Preview. The current Preview manifest requires the Chargebacks911 administrator to enter the app's lifecycle URL. This remains a public installation blocker. Connect supplies the project credentials and service URL.
4. Set the Custom Application to Ready and install it for the same project. The Application URL remains the SaaS URL supplied at registration.
5. Open Chargebacks911 from Merchant Center, verify the project details, select protection and complete the test checkout. Open **Pre-Chargebacks** to verify the report belongs to the project.

## Removal and reinstall

Use **Connect → Manage connectors → Installations → Uninstall** for the selected project. The service sends its uninstall callback before removal. Confirm the installation status and usage cutoff in Chargebacks911. Reinstall creates a new deployment. Reopen the SaaS-hosted application from Merchant Center.

## Access and tests

Connect creates the project API client with read access to orders, payments, project settings and Connect deployments. QA uses deployment read access to verify the API client belongs to a specific deployment. The Merchant Center session must identify the same project and have the application management permission. To run the service and configuration tests from the repository root, use:

    node --test connect-service/tests/lifecycle.test.mjs merchant-center/tests/config.test.mjs
