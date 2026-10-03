# Global Story username exclusions

Goal: exclude usernames saved anywhere under Tenzen Reviews, independent of SKU.
Architecture: traverse all root folders with this name and their descendants,
paginate every listing, deduplicate normalized usernames. Publish exclusions only
after a complete scan. Reuse existing filename/metadata parser and upload logic.
No new dependencies, permissions, storage or account scopes.

- [x] Add regression coverage for five SKU folders, nested files, pagination and failures.
- [x] Replace product-scoped scan in drive-api.js with whole-tree traversal.
- [x] Scan on connection, keep exclusions across product changes and catalogue refresh.
- [x] Show global counts in connection strip; product controls select save destination only.
- [x] Verify browser randomize before choosing SKU, after switching and after uploading.
- [x] Update release versions, docs, Constitution and manifest; test and publish.

All 600 manual profiles remain selectable as previously requested. A successful
upload immediately extends the current global exclusions. Reconnect refreshes
stories added by another session. Google drive.file visibility remains limited to
folders/files this app can access; existing app saves are within that scope.

Validation:19 Node tests and global browser simulation passed. Live deployment
verification follows the release commit. No real account writes in automated QA.
