# Story Creator Drive save design

The editor stays a static GitHub Pages app. On demand it fetches the current published Shopify catalogue, lets the operator search by product title or SKU, and saves all ready story canvases as WebPs to an app-created `Tenzen Reviews/<product title>` folder in the signed-in `team@tenzen.in` My Drive. A missing product folder is created at save time. The folder records the stable Shopify product ID in Drive properties so title changes do not split reviews; the visible folder name can be updated when the product is renamed. Properties remain readable by a future website integration with access to those Drive files.

Google Identity Services obtains a short-lived `drive.file` token through a button click. The token stays in memory. Drive `about.get` must identify `team@tenzen.in` before folder lookup or creation. All Drive operations use the Drive REST API directly in the browser; no server, paid service, Admin API token, or new dependency. The existing local download buttons remain. Incomplete stories are skipped and counted. The UI reports upload progress and links the destination folder.

A Google Cloud OAuth web client ID with Google Drive API enabled and both public website origins authorized is required. Until configured, the Drive control reports setup incomplete. This is an external prerequisite, not a secret. No real Drive write is attempted without user sign-in, consent, account check, and a deliberate Save action.

The supplied Apps Script is not used: it only creates folders on a schedule and cannot search or save stories from the editor. The website later showing reviews is a separate integration outside this repository.
