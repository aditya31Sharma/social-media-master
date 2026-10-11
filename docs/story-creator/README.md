# Story Creator: portable recovery package

**Current dataset:** 6,000 local profiles and JPEGs: the original600 retained in order, plus5,400 additions covering160 source countries and territories. No India profiles were added in this expansion. The complete6,000-profile source collection remains separate from the dashboard's selected5,400 additions.

The original600-profile recovery archive was published and verified through a fresh clone, six crop tests and41 live browser checks. Read [UPLOAD-STATUS.md](UPLOAD-STATUS.md) for that historical check. Historical cleanup applied to the original standalone working copies; the maintained repository is the current source.

This package supersedes the machine-local storage and uncommitted-state notes in the original handoff. The feature and all collected project data are now intended to travel with the Git repository. No file under Documents, /tmp, or a previous developer home directory is needed to run the editor.

## Restore on a fresh machine

```sh
git clone https://github.com/aditya31Sharma/social-media-master.git
cd social-media-master
python3 docs/story-creator/verify.py
node --test docs/story-creator/qa/crop.test.mjs
python3 -m http.server 8801 --bind 127.0.0.1
```

Open http://localhost:8801/stories/ . The deployed route is https://aditya31sharma.github.io/social-media-master/stories/ . GitHub Pages is configured to publish the root of main. The editor requires no npm install, API key, remote profile API, or backend. Carousel, Reel and Story now share the root workspace. The old /stories/ URL redirects to ./#story. No separate Story page or iframe is used.

## Drive save integration

Connection/account status appears above the workspace. Product search and
selection come first in the sidebar; mobile order is connection, product,
previews, editing. Save to Drive sits alongside preview downloads. The connection
strip keeps success, pending and retry states visible independently of upload
status. Selection outlines have 12px scroll padding so their 6px extent fits at
both ends. `../qa/story-setup-check.js` covers this layout and connection failures.

Story Creator can search the current published Shopify catalogue by product title or SKU and save all ready WebPs to an app-created `Tenzen Reviews/<product title>` folder in the `team@tenzen.in` Drive. Folders are created when first needed, keyed by Shopify product ID in Drive properties. Google OAuth is configured for both hosted origins and localhost:8088; see [DRIVE-SETUP.md](DRIVE-SETUP.md).
Choose a SKU and complete the global Drive check before assigning a profile. Connection and each SKU change scan every product folder under `Tenzen Reviews`, including nested folders and every results page. Scans batch up to20 parent folders per query, with at most3 concurrent requests. Earlier saves use the `story-<number>-<username>-<time><m|h>.webp` filename; new saves also store username metadata. A read-only inventory recorded82 saved WebPs and80 distinct usernames; the current scan always supplies exclusions.

The manual picker and Randomize exclude saved usernames across all SKUs. Other drafts' current usernames never appear in the picker, and random draws do not repeat within the session. Search covers all6,000 profiles while rendering at most100 matching options. Initial drafts have no default profile; failed or incomplete checks keep manual selection, Randomize and Drive saving unavailable. Product changes retain saved-user and session exclusions while waiting for a fresh result. Reconnect to retry a failed check.

Before uploading, the editor scans again and rejects a batch if a username was saved elsewhere or appears twice in the batch. Each successful upload immediately updates exclusions. The connection strip reports global saved WebP and username counts.

HEIC and HEIF review photos are decoded in the browser through a pinned `heic-to@1.6.5` script when native decoding fails. The converter loads only for those photos. Run `qa/heic-check.js` on a fresh Story page to check actual HEIC input and WebP export; its fixture is `qa/heic-sample.heic`.

## What is preserved

- `../../stories/`: complete runnable editor,6,000 DP JPEGs, users.json, local font/license and original Figma SVGs.
- `data/instagram_users.json`: original100 full metadata records.
- `data/instagram_users_india.json`: supplemental500 full metadata records, including source URLs and image hashes.
- `data/instagram_users_expansion.json`: selected5,400 full metadata records, source hash and deterministic regional/country quotas. All160 source countries are retained, with90% of each source region selected.
- `import-profiles.py`: reproducible import from the complete6,000-profile source JSON and its local photos; preserves the original600 and checks all image hashes before copying additions.
- `archives/source-dataset.zip`: complete original Documents dataset including all600 source photos and both metadata files.
- `archives/global-collection.zip`: original global collection scripts, public source HTML snapshots, raw downloaded images, candidate pools, download results and contact sheet.
- `archives/india-collection.zip`: India collection scripts, public source HTML snapshots, candidate pools, selected/eligible records, failures, raw downloads and staged JPEGs, including unused candidates.
- `archives/historical-qa.zip`: all original temporary QA files, screenshots and Figma reference fixture. Old tests inside are historical and can describe superseded behavior.
- `qa/`: current handoff QA scripts, fixture, screenshots and historical result files. Crop-test imports are now repository-relative. This directory is the preferred QA entry point.
- `history/`: the two feature/data collection progress logs, captured at packaging time.
- `../STORY-CREATOR-HANDOFF.md`: detailed requirements, implementation, geometry, data provenance and integration guidance.
- `../superpowers/plans/2026-10-02-story-creator.md`: original plan, superseded where current handoff differs.
- `archive-manifest.json`: path, byte size and SHA-256 for every archived source file.
- `files-manifest.json`: path, byte size and SHA-256 for shipped feature/recovery files at publication, except the manifest itself. A later cleanup completion note may be added separately.
- `verify.py`: standard-library-only archive, file integrity, dataset and module-reference checks.

Python bytecode caches, OS metadata, browser session state, credentials and unrelated machine data are excluded. Archives store source bytes unchanged; historical content can contain old absolute paths, expired source-image URLs, or old design decisions. These are provenance records, not runtime dependencies. Collection/install scripts are archived for reference and must be reviewed/adapted before running on a different machine. Running them is unnecessary for restoration.

Archives are below GitHub's ordinary per-file limit and committed directly; no Git LFS, external artifact storage, or expiring download links are needed. You can extract them with Python's zipfile module or any ZIP utility. The verifier checks each entry without extraction.

## Verification and integration

Run the verifier after cloning. It checks6,000 unique usernames/photos, original600 continuity, the5,400-profile supplement, metadata-to-photo hashes, all archive members, shipped-file hashes, safe paths and local JS module dependencies. It does not replace browser tests.

Browser tests in `qa/` run after the Story tab loads on a fresh `./#story` page using the receiving session's approved browser tool. Run batch-check.js on a blank editor. Select a SKU and finish the Drive check before scripts that export or randomize profiles. Upload qa/figma-sample.png via .story-file before random-user-check.js or progress-check.js. Reload between scripts. These tests mutate the page; some intercept download clicks to inspect actual WebP bytes. Preserved old result files are historical evidence, not proof of a new deployment.

`qa/india-check.js` requires no Drive connection: it verifies the original500 India profiles and decodes all6,000 local JPEGs at32-96px. `qa/random-user-check.js` checks DP/name correspondence, the100-option limit, draft reservations and session draw uniqueness after SKU/Drive setup.

For repeatable no-login checks, run `qa/saved-users-check.js` on a fresh editor page. It mocks Drive responses to cover saved-user exclusions, whole-pool search, SKU checks, draft reservations, stale/failed scans, upload rechecks and exhausted pools. `../qa/story-setup-check.js`, `story-retry-check.js` and `workspace-check.js` cover disconnected gating, retry and shared workspace state.

The shared workspace owns navigation in `lib/workspace.js` and mounts the existing
Story markup through `mountStory(root, {isActive})`. Story selectors are scoped,
profile/icon URLs are module-relative, and paste/drop handlers act only while
Story is active. Both photo ratios and all6,000 profiles are available. The
workspace uses the Aditya Tools Design System in `styles/`, while Story canvas
artwork keeps its original font and geometry. See [the workspace plan](../WORKSPACE-REVAMP.md).

The shared root document must remain non-isolated for the Google sign-in popup;
only the Reel lab retains COOP/COEP. Background removal uses its supported
single-thread fallback. Keep all paths relative for the deployed subpath.

Additional verification:

```sh
node --test docs/story-creator/qa/*.test.mjs docs/qa/*.test.mjs
```

Run `docs/qa/workspace-check.js` with the approved browser tool for in-page
navigation, draft preservation, shared IDs, theme and confirmation checks.
