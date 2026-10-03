# Story Creator: portable recovery package

**Recovery archive published and verified:** GitHub contains the complete package. A fresh GitHub clone passed file/archive verification and all six crop tests. The live story editor loaded all600 DPs and passed41 browser checks. Read [UPLOAD-STATUS.md](UPLOAD-STATUS.md). Historical cleanup applied to the original standalone working copies; the maintained repository is the current source.

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

Story Creator can search the current published Shopify catalogue by product title or SKU and save all ready WebPs to an app-created `Tenzen Reviews/<product title>` folder in the `team@tenzen.in` Drive. Folders are created when first needed, keyed by Shopify product ID in Drive properties. Google OAuth is configured for both hosted origins and localhost:8088; see [DRIVE-SETUP.md](DRIVE-SETUP.md).
After connection and product selection, the editor reads the saved WebPs in that product folder and excludes their Instagram usernames from **Randomize user**. Earlier saves are identified by their `story-<number>-<username>-<time><m|h>.webp` filenames; new saves also store the username in Drive properties. The full 600-account profile picker remains available for manual selection. Randomize is disabled if Drive is disconnected or the folder scan fails, and the Drive status reports the saved WebP and excluded-user counts. Each new successful upload updates the exclusion immediately.

HEIC and HEIF review photos are decoded in the browser through a pinned `heic-to@1.6.5` script when native decoding fails. The converter loads only for those photos. Run `qa/heic-check.js` on a fresh Story page to check actual HEIC input and WebP export; its fixture is `qa/heic-sample.heic`.

## What is preserved

- `../../stories/`: complete runnable editor,600 DP JPEGs, users.json, local font/license and original Figma SVGs.
- `data/instagram_users.json`: original100 full metadata records.
- `data/instagram_users_india.json`: supplemental500 full metadata records, including source URLs and image hashes.
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

Run the verifier after cloning. It checks600 unique usernames/photos, metadata-to-photo hashes, all archive members, shipped-file hashes, safe paths and local JS module dependencies. It does not replace browser tests.

Browser tests in `qa/` run after the Story tab loads on a fresh `./#story` page using the receiving session's approved browser tool. Run batch-check.js on a blank editor. Random-user and India checks require a connected Drive account and selected product before Randomize becomes available. Upload qa/figma-sample.png via .story-file before random-user-check.js or progress-check.js. Reload between scripts. These tests mutate the page; some intercept download clicks to inspect actual WebP bytes. The preserved old result files are historical evidence, not proof of a new deployment.
For a repeatable no-login check of saved-user exclusion, run `qa/saved-users-check.js` on a fresh editor page. It simulates 11 older WebPs in one product folder, verifies manual selection and 25 random clicks, then simulates a new upload and verifies that user is excluded in 25 more clicks.

The shared workspace owns navigation in `lib/workspace.js` and mounts the existing
Story markup through `mountStory(root, {isActive})`. Story selectors are scoped,
profile/icon URLs are module-relative, and paste/drop handlers act only while
Story is active. Both photo ratios and all600 profiles are retained. The
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
