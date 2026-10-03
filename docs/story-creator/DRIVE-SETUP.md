# Connect Story Creator to Tenzen's Google Drive

The editor uses the `team@tenzen.in` Google Workspace account and a dedicated Google Cloud project. Google Drive API, an internal OAuth consent screen, and the Web application client are configured. Billing is disabled. The public client ID belongs in browser code; never put a client secret or Shopify Admin token in this repository.

Project ID: `tenzen-social-media-master`. Project number: `228802016632`. OAuth client: `Social Media Master Story Drive`. Public client ID: `228802016632-5ni4kkfmdf5025lmulcs3o63otk5aere.apps.googleusercontent.com`. Authorized JavaScript origins: `https://aditya31sharma.github.io`, `https://dashboard.tenzen.in`, and `http://localhost:8088`. OAuth audience is Internal. Data Access includes `https://www.googleapis.com/auth/drive.file`.

To use it, open Story Creator, search a product title or SKU, select it, connect as `team@tenzen.in`, upload review photos, and choose **Save all WebPs to Drive**. The app checks the Drive account email before any write. Confirm `Tenzen Reviews/<Shopify product title>` contains the WebPs. Use **Refresh products** after adding a published SKU. The folder is created on its first save.

If the client must be recreated, use the same origins and internal audience, enable Drive API and the `drive.file` scope, and update `stories/drive-config.js`. The browser token flow does not need a redirect URI. Update the file manifest and run the verifier. The root service worker must let `stories/` load without COOP/COEP response headers, because COOP `same-origin` prevents Google's popup from communicating with the page.

The folder is created on the first save for that product, so the app does not need a daily Apps Script trigger. Folder and file properties record the stable Shopify product ID, and file properties also record the SKU. Renaming a product updates the app-created folder's visible name on the next save. Only products returned by the published Storefront catalogue are searchable. Existing folders made by another Google app are not guaranteed to be visible with the limited `drive.file` scope; do not run the old folder-generation script for this workflow.

The tool saves images to Drive. Showing them on the Shopify website later requires a separate website data integration and appropriate Drive access for that integration. Automated browser tests simulate Drive responses; a real upload requires an interactive `team@tenzen.in` sign-in.

References: [Google Identity Services token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Drive scope choice](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Drive multipart uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
