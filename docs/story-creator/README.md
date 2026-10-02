# Story Creator: portable recovery package

This package supersedes the machine-local storage and uncommitted-state notes in the original handoff. The feature and all collected project data are now intended to travel with the Git repository. No file under Documents, /tmp, or a previous developer home directory is needed to run the editor.

## Restore on a fresh machine

```sh
git clone https://github.com/aditya31Sharma/social-media-master.git
cd social-media-master
python3 docs/story-creator/verify.py
node --test docs/story-creator/qa/crop.test.mjs
python3 -m http.server 8801 --bind 127.0.0.1
```

Open http://localhost:8801/stories/ . The deployed route is https://aditya31sharma.github.io/social-media-master/stories/ . GitHub Pages is configured to publish the root of main. The editor requires no npm install, API key, remote profile API, or backend. The existing dashboard navigation still needs the third feature entry, delegated to the receiving Claude session. Carousel and Reel files are unchanged.

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
- `files-manifest.json`: path, byte size and SHA-256 for all shipped feature/recovery files except the manifest itself.
- `verify.py`: standard-library-only archive, file integrity, dataset and module-reference checks.

Python bytecode caches, OS metadata, browser session state, credentials and unrelated machine data are excluded. Archives store source bytes unchanged; historical content can contain old absolute paths, expired source-image URLs, or old design decisions. These are provenance records, not runtime dependencies. Collection/install scripts are archived for reference and must be reviewed/adapted before running on a different machine. Running them is unnecessary for restoration.

Archives are below GitHub's ordinary per-file limit and committed directly; no Git LFS, external artifact storage, or expiring download links are needed. You can extract them with Python's zipfile module or any ZIP utility. The verifier checks each entry without extraction.

## Verification and integration

Run the verifier after cloning. It checks600 unique usernames/photos, metadata-to-photo hashes, all archive members, shipped-file hashes, safe paths and local JS module dependencies. It does not replace browser tests.

Browser tests in `qa/` run in a fresh `/stories/` page using the receiving session's approved browser tool. Run batch-check.js on a blank editor. india-check.js requires no upload. Upload qa/figma-sample.png via .story-file before random-user-check.js or progress-check.js. Reload between scripts. These tests mutate the page; some intercept download clicks to inspect actual WebP bytes. The preserved old result files are historical evidence, not proof of a new deployment.

For dashboard integration, prefer a relative link to `./stories/`. Existing app.js assumes only Carousel/Reel in its template switch and has a global paste listener. Do not simply add an unsupported data-tpl value or load both page scripts into one DOM. Preserve both photo-ratio options and all600 profiles. Follow the detailed handoff acceptance checklist, then verify the deployed route and all assets.

## Paste into the existing Claude hosting session

```text
Continue in your existing Social Media Master hosting context. Fetch the latest repository state using your established workflow, preserving unrelated work. Read docs/story-creator/README.md first, then docs/STORY-CREATOR-HANDOFF.md.

The completed editor,600 profiles, source data, assets, collection snapshots and QA are in GitHub. No files from the previous machine are required. Reuse stories/ and add Story Creator as the third dashboard feature beside Carousel and Reel. Do not rebuild the editor or refactor unrelated features.

Run the recovery verifier and relevant browser checks, integrate navigation, and use your established deployment workflow. Report the tested live URL and any remaining issues. Only make changes needed for this integration.
```
