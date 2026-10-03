# Aditya Tools Design System: Social Media Master

## Design and implementation plan

Goal: one phone-first workspace for Carousel, Reel and Story, with every existing
editor and export capability retained. Reference: the complete 840-line
`Aditya-tools-design-system.md` in the Constitution folder and Brainboard's Mono
tokens. The UI uses self-hosted Plus Jakarta Sans, quiet monochrome cards, 44px
minimum touch targets, 54px primary actions, safe areas, restrained motion,
bottom navigation on phones and a wider workspace on desktop. Export artwork
keeps its existing fonts, geometry and colours.

The requested design system supplies the design direction. This is an adaptation
of its components to the existing static HTML/ES-module application, without a
framework migration, new dependencies, hosting changes or another backend.

## Features to preserve

| Tool | Existing capability |
| --- | --- |
| Carousel | Product search, SKU/link resolution, catalogue order and fallback photos |
| Carousel | Cover upload/paste/drop, wordmark white/black/custom colour |
| Carousel | Editable headings, subheading, SKU and order; background-removal toggle |
| Carousel | 1080/1620/3000 widths, PNG/JPEG, multiple separate carousel sets |
| Carousel | Full slide editor, locked inspection, photo/wordmark framing, align, zoom, reset, dirty state, save one/all |
| Carousel | Individual, six-slide and all-set downloads; native share when supported |
| Carousel | Caption templates, hook/tag suggestions, copy and stats |
| Reel | Top/bottom selection, 3D fit preview, top scale/height, preview turn |
| Reel | Four photo sequences, selection/order, per-photo framing and alignment |
| Reel | Text overrides, music/switch audio uploads, music trim/preview, volume controls, YouTube helper |
| Reel | 1080p/1440p/4K, 15-second MP4, progress, edit after export, separate final-frame PNG cover without background photos |
| Story | Multiple independent stories, upload/paste/drop including HEIC/HEIF |
| Story | 600 profiles, manual search, randomize excluding Drive-saved users |
| Story | Timestamp 1-60 with M/H, random timestamp, progress 0-100 and random progress |
| Story | Both container ratios, cover crop/drag/pinch/zoom/reset, both export heights |
| Story | Individual/all WebP downloads and Drive saves to selected Shopify product folder |
| Story | Account validation, folder creation/rename by product ID, prior-file scan and immediate exclusion after save |

## Implementation

- [x] Shared design foundations: add local fonts, Mono tokens and styles. Keep
  existing rendering modules and media processing. Reuse existing button/icon
  markup, introduce theme preferences and a safe Start over confirmation.
- [x] Shared shell: lift tool tabs out of the composer; provide desktop navigation,
  mobile bottom tabs, a contextual add action, and a clear active-tool title.
  Preserve each tool's DOM and in-memory drafts on tab changes and browser Back.
- [x] Story integration: export `mountStory(root, {isActive})`, scope all selectors
  and input handlers, resolve assets relative to modules, and lazily mount the
  existing Story markup into the root page. Keep old `/stories/` bookmarks working
  by opening the Story tab. Avoid iframe embedding and duplicate element IDs.
- [x] OAuth compatibility: the shared page must allow Google's popup. Update the
  existing optional isolation worker so the root workspace stays non-isolated;
  preserve isolation for the Reel lab. Background removal uses its supported
  single-thread fallback. Verify migration from an older controlling worker.
- [x] Phone layout: controls and preview remain reachable with bottom navigation;
  advanced controls fold, Story settings use existing sections grouped into
  details. On desktop, show a controls card beside the preview surface. All
  existing sheets and editors adopt the same theme and touch sizing.
- [x] Verification: baseline and final Node tests, syntax checks, manifest check;
  browser flows for tab preservation, paste ownership, Story exports/HEIC/Drive
  mock, actual Carousel output and Reel cover/export where available. Capture
  all three tools at 375/768/1024/1440 in light/dark and check overflow/targets.
- [x] Update PRODUCT, README, Story handoff/readme, Constitution playbook and
  manifest. Leave a reviewed local result for Aditya's explicit live-release go.

## Implementation traps

- Root and Story originally both had `#status`. Story now needs `#storyStatus`.
- Document-relative Story photo/icon/profile URLs fail when mounted at the root.
- Window paste/drop listeners must act only for the active tool.
- COOP `same-origin` blocks GIS popup communication. A same-page Story cannot
  inherit the original root page's isolation policy.
- Never recreate a tool panel on tab changes; it would discard draft photos,
  framing, product selection and Drive authorization.
- UI typography/theme must not alter the exported canvas or Reel first frame.

## Local verification (2026-10-03)

- Node:18/18 tests, comprising crop6, Drive5, saved-user4 and isolation3.
- Story:22 export/crop checks,12 progress checks, real HEIC fixture decoded to
  1080x2150 WebP. Mock Drive:11 older files plus1 new save,50 random clicks
  excluded saved users while the manual picker retained600.
- Workspace:13 checks for same-document panels, drafts, unique IDs, theme and
  reset confirmation;6 paste/Back/Forward checks. Simulated503 profile fetch
  offered Retry, then restored one editor with600 profiles and one add handler.
- Carousel: real six-slide generation with cutouts;7 interaction checks for
  generation, caption controls, locked editor, framing/save, relocking, removal
  confirmation/cancel and tab-state preservation. The latter used cutouts off.
- Reel:9 interaction checks for keyboard selection, modal focus, nested Escape,
  photo framing, four shots, text/fit/turn/audio/resolution state and tab switching.
  Full production900-frame1080x1920 H.264 export completed with AAC audio,
  15seconds video and matching PNG cover. First-frame/PNG SSIM0.979303.
  Software-rendered Chrome took414.9seconds; no page errors. An initial240second
  harness timeout was increased to720seconds. No shortened export used for this
  final check. The normal browse browser lacks WebGL, so encoding used the
  playbook's installed-Chrome exception with SwiftShader.
-24 main-surface screenshots: all3 tools at375/768/1024/1440 in Light and Dark.
  No horizontal page overflow or undersized visible main controls. Also inspected
  mobile Reel sheets, slide editor and real generated previews. Fixed the Reel
  sheet's intrinsic column overflow and enlarged framing/edit-lock targets.
- Real private Google Drive upload still requires interactive sign-in. Browser
  tests simulate Drive responses. Root remains service-worker-controlled and
  non-isolated for OAuth; lab isolation is covered by the Node checks.

No dependencies, hosting changes, files deleted, PR or live push. Local preview:
`http://localhost:8088/`. Release requires Aditya's explicit go because pushing
main publishes both GitHub Pages and the Tenzen HQ mirror.

## Branding and Story setup polish, 2026-10-04

The initial Mono preset is superseded by a purple preset sampled from the supplied
app icon. The icon replaces the header and empty-state Tenzen marks; exported
artwork stays unchanged. Google Material Symbols movie weight 300 is normalized
to 1.6px for the Reel tab. Drive connection now has a separate top strip, product
selection leads the controls, and saves sit beside previews. Mobile order is
connection, product, previews, editing. Story scroll padding accommodates the
full selected outline at either edge. Release query keys cover changed CSS and
workspace/Story modules to prevent mixed cached versions.

## Reel animation correction, 2026-10-04

The opening-cover change831e322 had removed the original garment entrance/blur
and logo fade. Restore animation and geometry from its parent. Cover generation
now runs separately after encoding at frame899, with only the four photos hidden.
Final pose, logo and product text remain. The MP4 keeps the original animation.
The historical first-frame cover verification above describes the superseded
implementation. docs/qa/reel-animation.test.mjs compares all900 renderer-command
sequences against831e322^ and checks cover separation and final pose/text.
The comparison test needs Git history containing831e322^.
