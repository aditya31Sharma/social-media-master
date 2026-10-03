# Story Creator Drive Save Implementation Plan

Goal: Save ready WebP stories to a product folder in the `team@tenzen.in` Drive when selected.

1. Add product ID to the shared Shopify catalogue result. Search its current title/SKU in the Story editor and refresh on demand.
2. Add a focused Drive API module. Authorize with Google Identity Services and `drive.file`, confirm the account with `about.get`, find or create the root and product folder using product ID metadata, then upload canvas WebPs with folder ID in metadata.
3. Add compact controls for connection, product search, destination, save progress, and folder link. Keep existing download behavior.
4. Add meaningful mock-Drive tests for new SKU creation, stable folder reuse, account mismatch, upload metadata and failure handling. Run project syntax, Story integrity, crop and browser checks at relevant widths.
5. Update Story manifest, README and the machine playbook. Keep changes local until the owner explicitly authorizes a live release. Real Google OAuth testing requires a configured web client ID and the account owner signing in.
