# Instagram Story Creator: Claude session handoff

Prepared 2026-10-03 for Aditya's existing Claude session that hosts Social Media Master.

## GitHub preservation update (2026-10-03)

Read [the portable recovery guide](story-creator/README.md) first. It supersedes the historical local-only/untracked notes below. Runtime files, all600 profiles, full source datasets, collection caches, QA and session history are packaged in this repository. Use repository-relative QA paths from that guide on a new machine. Dashboard navigation integration remains the receiving Claude session's task.

## Objective and boundary

Add the completed Story Creator as the third feature alongside the existing Carousel and Reel features in the hosted Social Media Master dashboard. Reuse this implementation. Continue with your existing hosting context and deployment workflow. Do not rebuild the editor or replace the dashboard.

This handoff task did not integrate dashboard navigation, commit, push, open a PR, or deploy. Those integration and hosting steps remain for the receiving session. Read the current local files and your existing session context before making changes. Apply the machine/project instructions, preserve unrelated work, and only change what this integration needs.

## Local project and Git state

- Repository: `/Users/adityasharma/Codes/social-media-master`
- Remote: `https://github.com/aditya31Sharma/social-media-master.git`
- Branch at handoff: `main`, tracking `origin/main`; no `upstream` remote.
- HEAD: `0abc8febd0325f9639edab5856cab4255cbd6565` (`feat(reel): the turning outfit, finished`).
- Current status: untracked `stories/` and `docs/`. No tracked application files changed by this project. All Story Creator code and assets are uncommitted. A new clone WILL NOT contain them. Preserve/copy or stage the complete local directory when integrating.
- Plain HTML, CSS, native JavaScript modules and canvas. No new dependencies or build system.
- README hosting URL: `https://aditya31sharma.github.io/social-media-master/`. Your existing hosting session may have newer information; use its actual deployment target.
- Local preview: `http://localhost:8801/stories/`.
- Server previously started from repository root using `python3 -m http.server 8801 --bind 127.0.0.1`; PID observed 47726. Recheck before starting another server.
- Progress/history: `/Users/adityasharma/.claude/progress/Instagram-story-creator-progress.md`.
- Earlier plan: `docs/superpowers/plans/2026-10-02-story-creator.md`. Historical single-story/inset-photo/PNG decisions in that plan are superseded by this document and current code.

## User requests, in order

1. Build an Instagram-looking story creator using pasted customer review photos, with username and DP from local Instagram users JSON; host inside the existing social media manager.
2. Match the supplied Figma frame. User repeatedly requested checking the Figma connection, installed the MCP plugin, then requested localhost first.
3. Random timestamp number from 1 through 60 and switch between minutes and hours.
4. Photo container fixed in ratio, aligned to the top and both edges, filled regardless of source photo ratio. User called this 16:9; the Figma content is portrait 9:16. See the preserved resolution below.
5. Add more stories to the right, download individually, download all as WebPs.
6. Randomize usernames and matching DPs.
7. Add 500 Indian accounts alongside the existing 100.
8. Control progress-bar fill manually or randomize from 0 through 100.
9. Hand the complete project to the Claude session already hosting the dashboard, which will add this as feature three.

## Implemented behavior

- Upload, drop or Cmd/Ctrl+V paste a review image. Pasting replaces the selected story's photo; dropping on a specific card targets that card.
- Add story appends a card on the right and selects it. The sidebar edits only the selected story. Photo, profile, timestamp, unit, progress, crop, photo ratio and export height are independent per story.
- Search profiles, including searches with `@`, and select from 600 local profiles. Search can select the first matching profile.
- Randomize user picks from all 600, excluding the current username, clears search, and updates the matching DP. Async requests use last-request-wins guards.
- Timestamp integer 1-60, inclusive randomizer, M/H controls. Canvas displays lowercase `m` or `h` to match Figma.
- Progress range slider and numeric field 0-100, inclusive randomizer, default 19%. Selected story restores its own value. Preview and exports use the same renderer.
- Drag photo; wheel/pinch or range slider zoom; keyboard arrows, Shift+arrows and +/-; reset. Cover crop is bounded so no empty edges can appear. Zoom 1x-5x.
- Export each card, selected card, or all ready stories as actual WebP files. Bulk export skips unfinished cards and reports their count. Files download separately, not in a ZIP. Browser multiple-download permissions may apply.
- Export snapshot captured before asynchronous encoding, quality 0.95, MIME checked, filenames `story-ID-USERNAME-TIMEm.webp` or `...h.webp`, 250ms spacing for bulk downloads. Status says download started, without claiming browser save completion.
- Local photos are processed in browser; there is no upload backend.
- New story defaults: no review photo, first profile, 3m, progress 19%, portrait photo ratio; inherits current export height.
- No persistence across reloads and no remove-story button. These were not requested. Do not expand scope to add them.

## Photo ratio decision: preserve both options

The user said 16:9, but the actual Figma image container is 1080 x 1920, which is portrait 9:16. A clarification was asked but not answered. The implemented assumption was disclosed and both options were provided:

- Default `Portrait 9:16 · Figma`: fixed photo rectangle x=0, y=0, width=1080, height=1920.
- `Landscape 16:9`: fixed photo rectangle x=0, y=0, width=1080, height=607.5.

Both always fill their container, regardless of input dimensions, with no top or side inset. The container does not stretch with export height. Preserve both until the user directs otherwise. Do not describe literal landscape 16:9 as the default.

Export dimensions are independently selectable:

- Figma frame: 1080 x 2150. Reply footer sits below the portrait photo.
- Standard story: 1080 x 1920. Footer overlays the lower photo area.

## Figma source and design details

Reference: https://www.figma.com/design/H8vihtRHHXMz32hzHMQ09s/Q2-Designs-FY26-27?node-id=4919-57629&m=dev

- File key: `H8vihtRHHXMz32hzHMQ09s`.
- Published frame: `4919:57629`, 1080 x 2150.
- Content: `4919:57630`, instance of `4919:57623`, 1080 x 1920.
- Initial browser access returned 403. After the user installed Figma MCP, official design tools successfully retrieved the reference. This was not implemented solely from a guessed Instagram layout.
- Figma design-to-code resource was read via MCP: `skill://figma/figma-design-to-code/SKILL.md`; design-context requests used `skillNames: "resource:figma-design-to-code"`.
- Integration needs no fresh Figma connection because the required assets are local. Reinspect Figma only if changing design. Remote asset URLs are temporary and must not replace local assets.

Canvas geometry at 1080px width:

- Avatar: x36, y56, 96px circle.
- Username: x168, top80, Roboto bold42; timestamp regular42, gap28 after measured username. Long names reduce down to28px. Text baseline120.
- More icon: x976, y69, 64px.
- Progress stroke: x21 to1059, center y26, width5, rounded caps. Full track white at40% opacity; opaque white fill; 0% draws no fill.
- Header gradient height289.
- Footer gradient top H-324, height298, bottom26.
- Reply outline approximately x24, yH-194, width888, height145. Renderer uses centered stroke x25.5, yH-192.5, width885, height142, radius71.
- Reply text x75, yH-104; share icon x960.5, yH-173.

An early implementation used an inset artwork region at y289. That was corrected to the full content container. Do not restore that inset. `progress.svg` is retained as an original asset but no longer rendered: dynamic progress uses the same geometry.

## File map and dependencies

| Path under repository | Responsibility |
| --- | --- |
| `stories/index.html` | Standalone editor entry, sidebar, toolbar, card template, return link |
| `stories/story.css` | Editor layout, responsive controls and horizontal card rail, inherited-brand mobile fix |
| `stories/story.js` | Shared UI, selected story, user/time/progress controls, paste/drop, bulk export |
| `stories/card.js` | Per-card state, image/avatar loading, crop gesture binding, render and download |
| `stories/crop.js` | Clamp zoom/offsets to cover the fixed photo rectangle |
| `stories/render.js` | Full-resolution shared canvas preview/export renderer and Figma geometry |
| `stories/progress.js` | Dynamic progress-track/fill rendering |
| `stories/download.js` | Snapshot, WebP encoding, download sequencing and filenames |
| `stories/profiles/users.json` | 600 compact `{username, photo}` entries |
| `stories/profiles/*.jpg` | 600 local DP JPEGs, maximum96px |
| `stories/assets/Roboto.ttf` | Local font, 488584bytes |
| `stories/assets/Roboto-LICENSE.txt` | Font license |
| `stories/assets/more.svg`, `share.svg`, `progress.svg` | Local Figma assets |

Shared existing dependencies: `../app.css`, `../lib/frame.js`, `../lib/framer.js`, and root branding/favicon assets. Preserve these relative paths if moving or copying the feature. The story folder has614 files and approximately4.39MB total. Authored HTML/CSS/JS currently totals488 lines; profile JSON and images are separate generated/data assets.

## Dashboard integration: remaining work

Prefer adding a third feature navigation entry that opens `./stories/` on the same hosted site. The story page already links back to `../`. Fit the actual existing dashboard UI from your hosting session instead of creating a new dashboard.

Inspect these current integration points before editing:

- Root `index.html`, around148-160: template buttons use `data-tpl="carousel"` and `data-tpl="reel"`.
- Root panels use `data-panel`; Carousel around160 and Reel around281.
- Root `app.js`, around973: a generic `[data-tpl]` click loop shows the matching panel, changes the build button and uses a two-way Reel/Carousel label conditional.
- Root `app.js`, around774: global paste listener.

Do not simply add `data-tpl="story"` to that two-feature switch: it would hide existing panels without providing a story panel and would apply Carousel-oriented logic. Do not load root `app.js` and `stories/story.js` together blindly: global selectors and paste/drop listeners can conflict. Separate-page navigation avoids that collision while keeping the feature on the same site. If your actual dashboard requires an in-page mount, isolate lifecycle, selectors and event listeners deliberately.

Use relative URLs compatible with a GitHub Pages repository subpath. A root-absolute `/stories/` link may incorrectly target the domain root instead of `/social-media-master/stories/`.

Deployment must include every local profile, users.json, fonts, SVGs, all six modules, CSS and HTML, plus shared imports. Keep existing Carousel/Reel functionality and their hosting behavior. No new top-level dependency is necessary. Story Creator does not load root `app.js` or the COI service worker.

## Profile data and provenance records

- Original source JSON, unchanged100 entries: `/Users/adityasharma/Documents/Tenzen/Instagram users/instagram_users.json`.
- Supplemental500 records with source URLs and hashes: `/Users/adityasharma/Documents/Tenzen/Instagram users/instagram_users_india.json`.
- Source photos directory: `/Users/adityasharma/Documents/Tenzen/Instagram users/photos/`, now600 photos.
- Original100 cover43 countries and10 regions. App users.json preserves that original prefix and appends500.
- Additional profiles came from public Modash directories with explicit creator location equal to India. Audience country and name-based inference were not used.
- Collection discovered235 category/city links. Ambiguous cache filenames were excluded;716 eligible profiles remained; selection seed20261002; final500 span38 source categories.
- All600 usernames unique, all600 local JPEG hashes unique; every DP decoded successfully in browser during dataset verification. Supplemental JPEGs total3206190bytes.
- These are directory-derived India-based profiles, not authenticated direct Instagram validation or a uniform random sample of India's population.
- App is fully local-data driven. No scraping/API call is required at runtime or during integration.
- Historical collection scripts/caches: `/tmp/instagram-users-collection/` and `/tmp/instagram-india-collection/`. These temporary folders are not needed to deploy and may disappear. Full selected source metadata and final photos remain at the durable Documents paths above.
- Earlier collection history: `/Users/adityasharma/.claude/progress/instagram-users-progress.md`.

## Verification evidence and repeatable checks

Durable QA bundle, outside the deployable repository:
`/Users/adityasharma/.claude/progress/Instagram-story-creator-handoff/`

Preserved files:

| File | Purpose and status |
| --- | --- |
| `crop.test.mjs` | Six Node tests, 750 crop combinations plus valid-crop identity; freshly rerun at handoff and passed |
| `crop-results.txt` | Fresh test output, six passed, zero failed |
| `syntax-results.json` | Fresh syntax check of22 JavaScript files, zero errors |
| `batch-check.js` |22 browser checks: crop/coverage, ratios, cards, isolation, WebP signatures/dimensions and unfinished-card skipping |
| `random-user-check.js` | Six browser checks: different username, matching DP pixels, cleared search, isolation and rapid-click repeat exclusion |
| `india-check.js` | Seven browser checks:600 users, uniqueness, all DPs decode, added-profile reachability and search restoration |
| `progress-check.js` |12 browser checks:0/50/100 fill pixels, bounds, inclusive random endpoints,200 random samples, isolation and WebP pixels |
| `figma-sample.png` | Reference upload fixture, QA only; do not bundle into product |
| `batch-1440.png`, `batch-375.png`, `batch-768.png`, `batch-1024.png` | Historical responsive multi-card screenshots before later600-profile/progress additions |
| `india-600.png` | Dataset expansion screenshot |
| `progress-mobile.png` | Latest preserved mobile screenshot including600 profiles and progress controls |

The random-user script originally asserted100 users; its durable copy was corrected to600 during handoff. This corrected copy has not been browser-rerun in the handoff turn. Browser results listed here were obtained at their respective implementation stages, not as one fresh combined run. Fresh handoff verification did rerun all22 JS syntax checks and six crop tests, and confirmed600 entries,600 JPEGs and600 unique photo hashes. No application source was changed during handoff.

Historical browser runs passed the listed checks. Responsive widths375,768,1024,1440 had no document overflow; internal story-rail scrolling is intentional. Browser app console had no errors. Pixel-read diagnostics produced a Canvas2D willReadFrequently advisory from QA code only. Synthetic clipboard/drop checks do not prove every OS clipboard workflow. Actual file-input upload was also exercised.

There is no configured project linter/build/test runner. Report syntax checks as syntax checks, not a lint suite. Old `/tmp/story-creator-qa/check.js` is obsolete single-story/PNG/100-user QA. Do not use it as current acceptance.

Repeat Node verification:

```sh
cd /Users/adityasharma/Codes/social-media-master
node --test /Users/adityasharma/.claude/progress/Instagram-story-creator-handoff/crop.test.mjs
```

Browser work follows the local browse skill at `/Users/adityasharma/.claude/skills/browse/SKILL.md` if present, or its installed gstack location. Known executable:
`/Users/adityasharma/.claude/skills/gstack/browse/dist/browse`

For each script, navigate to a FRESH editor page first. Use `browse eval /absolute/path/to/script.js` according to the skill. `batch-check.js` expects the initial blank card and creates its own fixtures, so do not upload before it. `india-check.js` needs no photo. `random-user-check.js` and `progress-check.js` require uploading `figma-sample.png` using `.story-file` first, then waiting until Download enables. Tests mutate the page and may intercept browser download clicks to inspect encoded bytes; reload between them. Node test imports contain this machine's absolute repository paths, so adjust only if moving repositories.

## Acceptance for receiving Claude session

1. Existing dashboard exposes three features: Carousel, Reel, Story Creator.
2. Story entry and return navigation work on the actual hosted base path and localhost.
3. Existing Carousel and Reel remain operational.
4. All600 usernames and DPs load, search and randomization work, and no assets404.
5. Paste/upload/drop photo, top-edge full-width cover crop, both ratio options and both export heights behave as described.
6. Multiple cards append to the right and independently retain profile, photo, timestamp, crop and progress.
7. Individual and bulk files are valid WebPs with selected dimensions and progress pixels; unfinished cards are handled explicitly.
8. Controls and preview remain usable at375,768,1024,1440px; no page-level horizontal overflow.
9. Run relevant syntax/tests and browser checks after integration; verify actual deployed URL/assets after hosting. Report exact outcomes and anything not tested.

## Guardrails and lessons

- Follow current project and global instructions. Keep user-facing replies under100 words; do not use em dashes in authored content.
- Preserve unrelated changes; no file deletions, destructive Git operations, new dependencies, secret/config changes, or unsolicited PRs.
- Use your already established hosting authorization/workflow. This document does not invent a new deployment platform or require replacing your existing setup.
- If a PR is later requested, the user's500-line ceiling applies to changed source, excluding generated/lock/vendor/snapshot files. Current488 source lines plus integration may exceed it; calculate actual stats and split concretely if needed. No PR was requested in this handoff.
- Do not regress to inset photo placement, PNG-only downloads, one shared story state,100-profile hardcoding or static progress SVG.
- Preserve local font/icons and both ratio choices. Do not add live profile-image dependencies.
- Fetching Figma assets with urllib returned empty files previously; curl succeeded. Existing checked local assets avoid this issue.
- No claim that hosting or root dashboard integration is already complete. They are the next work.
