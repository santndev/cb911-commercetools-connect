# Chargebacks911 Prevent for commercetools

This connector embeds Chargebacks911 Prevent in Merchant Center. Connect builds the service and Merchant Center application from the repository tag selected on the connector draft.

## Install in Preview

1. An organization administrator makes the Custom Application available to the test project and records its application ID, entry point and cloud identifier.
2. A Chargebacks911 administrator activates the matching SaaS app, assigns a test billing profile and downloads its Connect Preview configuration. The current Preview release requires the administrator to supply that configuration in Merchant Center. Keep the deployment secret in its secured field.
3. In Connect, open the accepted draft, select **Deploy on Preview**, confirm the project and install. When the status is **Installed**, set the Custom Application deployment preview URL to the new merchant-center host.
4. Open Chargebacks911 from Merchant Center, verify the project details, select protection and complete the test checkout. Open **Pre-Chargebacks** to verify the report belongs to the project.

## Removal and reinstall

Use **Connect → Manage connectors → Installations → Uninstall** for the selected project. The service sends its uninstall callback before removal. Confirm the installation status and usage cutoff in Chargebacks911. Reinstall creates a new deployment. Update the Preview URL to the replacement host and reopen the application from Merchant Center.

## Access and tests

Connect creates the project API client with read access to orders, payments and project settings. The Merchant Center session must identify the same project and have the application management permission. To run the service and configuration tests from the repository root, use:

    node --test connect-service/tests/lifecycle.test.mjs merchant-center/tests/config.test.mjs
