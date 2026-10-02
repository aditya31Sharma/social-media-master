# Instagram story creator: localhost implementation

Goal: paste a review photo, select a local Instagram profile, set a randomized time and export an image matching Figma frame 4919:57629.

Architecture: an independent /stories/ entry point within Social Media Master. Reuse app.css tokens/buttons and lib/frame.js plus lib/framer.js for gestures. A single canvas paints both preview and downloadable PNG, preventing export drift. No existing source edits, dependencies, server API, push or deployment.

Approved direction: user requested continuation and localhost first on 2026-10-02.

## Files and steps
- [x] stories/index.html: semantic editor controls, profile search/selection, paste/upload/drop, 1-60 input and randomizer, M/H controls, format selector, canvas and download.
- [x] stories/story.css: reuse app tokens, desktop sidebar and mobile stacked preview; 44px touch controls; visible focus and reduced-motion support.
- [x] stories/render.js: original Figma assets, local Roboto, avatar clip, dynamic username/time, image clipping and reply footer; export 1080x2150 or 1080x1920.
- [x] stories/story.js: load users/avatar, decode local file with async race protection, route clipboard/drop/upload to one loader, use existing framer for crop, export via canvas.toBlob.
- [x] stories/profiles: copy all 100 source avatars and compact username/photo index; original JSON stays untouched.
- [x] stories/assets: original Figma SVG files; Roboto font and license.
- [x] Baseline/check: node --check on JS modules (project has no configured linter/build/test runner). Validate image paths and non-empty assets.
- [x] Browser proof: upload and synthetic clipboard/drop; profile change/search; random endpoints and M/H; zoom/reset; actual PNG dimensions; invalid-image behavior; zero console errors.
- [x] Responsive proof: 375, 768, 1024 and 1440 widths without horizontal overflow, verify frame against Figma screenshot.
- [x] Keep local HTTP server alive and open /stories/ for user review.

## Design measurements
Frame 1080x2150; content 1080x1920 on #222. Avatar x36 y56 size96. Username x168 y80, Roboto bold42, gap28 to timestamp Roboto regular42. More x976 y69 size64. Progress x18.5 y23.5 width1043 height5. Header gradient height289. Footer top H-324 height298; reply x24 yH-194 width888 height145; share x960.5 yH-173 width96.5 height96.5. Photo inset x0 y289 width1074 height1342 at default size.

The Figma center image is dynamic review input. The exact original menu, progress and send SVG assets are used. Story chrome is preview artwork, not a live messaging interface. No external publishing or fabricated review text.

## Verification evidence
25 browser assertions passed; keyboard crop and exact reset also verified. Both PNG sizes match canvas pixels. 375/768/1024/1440 layouts have no horizontal overflow. No browser console errors. 16 existing and 2 new JS modules pass node --check; no configured linter exists. All 100 local avatars and 3 original SVGs are non-empty. Review scanners report zero high findings. Screenshots and temporary browser checks: /tmp/story-creator-qa/. Local server: 127.0.0.1:8801. Opened localhost URL in default browser. Existing source files untouched; no deployment.

## Revision: full photo container and multiple stories
Supersedes the original inset photo/PNG/single-story implementation. Figma Content is portrait 1080x1920 at x0,y0; this is now the default photo container. Landscape16:9 (1080x607.5) is selectable because the user named 16:9 while referring to portrait Figma. Images cover either container with scale >=1 and constrained offsets.

Each adjacent story owns its bitmap, crop, profile, time/unit, ratio and export size in card.js. Shared controls edit only the selected card. Add story appends to the right. Individual and bulk downloads are WebP quality0.95 with separate numbered filenames and click-time canvas snapshots. Incomplete stories are skipped explicitly in the status message. All source changes are under stories/; original app modules remain untouched.

Revision verification: 6 crop tests cover 750 geometry combinations plus identity preservation. 22 browser checks pass for five photo shapes, edge coverage, zoom/drag bounds, separate story state, WebP binary signatures and dimensions, individual and bulk export, and skipped-empty reporting. 21 JS files pass syntax checks (zero errors, unchanged baseline). Responsive widths375/768/1024/1440 confine overflow to the story track. Original Figma sample used only for manual browser QA. Screenshots: /tmp/story-creator-qa/batch-1440.png and batch-375.png. Browser test pixel-readback emitted only a diagnostic performance warning; ordinary UI interactions checked separately.

## Dataset expansion
Added500 India-based accounts to the original100, total600. Source: public Modash category pages with explicit creator location India. Deduplicated usernames and DP hashes. Original100 app entries preserved; original source JSON untouched. New source supplement: ~/Documents/Tenzen/Instagram users/instagram_users_india.json with500 source tuples, image hashes and local photos. New DP bytes:3,206,190. Browser decoded600/600 photos and passed7 picker/search/randomizer checks, no console errors. Screenshot:/tmp/story-creator-qa/india-600.png.

## Editable progress fill
Added per-story integer progress0-100 (default19), slider, numeric input and inclusive randomizer. Renderer uses same original rounded5px track geometry/40% white opacity, now dynamically filled. Original static SVG remains on disk. All12 browser checks pass:0/50/100 visual fill, value bounds, random endpoints,200 randomized values, per-story isolation/restoration, and WebP pixel verification. Changed JS modules pass syntax checks.
