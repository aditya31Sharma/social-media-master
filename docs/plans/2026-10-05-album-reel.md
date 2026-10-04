# Album showcase reel implementation plan

Goal: add a second Reel template on the current page, preserving the outfit reel and other tools.

Architecture: a deterministic Canvas 2D timeline shared by preview and MP4 export, a separate album editor, and small wiring changes to the existing Reel panel. Reuse the MP4 encoder, audio mixer, HEIC decoder, background-removal dependency and design tokens. No new packages or hosting changes.

Reference: latest Downloads video inspected at21 frames over10.613 seconds. The reference uses cutout photo figures on white, a horizontal stack/line and rapid three-band slides. User additionally specifies album intro, top/bottom transition, vertical five-model stack/line and final-model zoom. Use photos unless user redirects the pending clarification.

## Deliverables

- [x] Pure timeline in lib/album-motion.js:15-second normalized timing, optional3-second intro, first model reveal, stack, horizontal fan/zoom-out, model2 zoom-in, three-band staggered slide to model3, model3 downward/model4 from above, stack, vertical line, pan/zoom to model5. Smoothstep transforms; directional motion trails during slice/slide cuts.
- [x] Renderer in lib/album-render.js: white background, shared normalized model sizing, transparent images, optional cover, independently styled heading/album/creator. Letter spacing and multiline line height measured/drawn consistently. Preview/edit guides excluded from exports.
- [x] Text editor in lib/album-text.js: font picker, installed font discovery via explicit queryLocalFonts gesture, local font-file import fallback, size, spacing, line height, color, alignment, X/Y position, drag with center guides and keyboard nudges. Raw pointer origins retained while snapping to avoid sticky drags. No server font uploads.
- [x] Album UI in lib/album-ui.js and styles/album.css: scoped same-page editing surface, sticky preview, playback/scrubbing, five ordered image slots (replace/move earlier/later), cover toggle/upload, independent label toggles, music upload/start/volume, MP4 and PNG cover downloads. Image loading/decoding errors visible, obsolete async results ignored, export controls locked during render.
- [x] Integration: index.html template selector/album host; app.js active template routing/edit action/shared output; dialogs.js focus handling; workspace descriptive copy. Existing reel state persists across template switches.
- [x] QA: Node timeline/text geometry tests; actual upload/font/snapping/playback/reorder/optional-intro browser checks; full-duration encoded MP4 plus PNG;375/768/1024/1440 layout/light-dark checks; existing suite. Update README, Constitution and integrity manifest before release.

Timing (seconds at15s total with intro):0-.25 white; .25-.85 cover; .85-1.25 creator;1.25-1.8 album;1.8-2.35 heading;2.35-3 intro fade;3-3.5 model1;3.5-4.2 stack;4.2-5.5 horizontal spread;5.5-6.6 model2 zoom;6.6-7.1 hold;7.1-7.7 three-band cut to model3;7.7-8.6 hold;8.6-9.2 vertical slide to model4;9.2-10 hold;10-10.7 stack;10.7-12.4 vertical spread;12.4-14 pan/zoom model5;14-15 hold. With all intro elements off, showcase starts immediately and uses all15seconds.

Validation boundaries: browser font enumeration requires permission and supporting desktop browser; font file loading covers unsupported environments. Background removal uses existing free local WASM model only when requested. No copied private credentials/reference video in public repo.

## Revision: centered SKU showcase

Supersedes the initial15s timing above. User deferred the intro, requested an
exactly centered opening stack, longer lineup holds, a bottom-left detail zoom
with product front/name and return before each transition, and five preset SKUs.

- [x] Package five cutout models plus five cutout product fronts, source map included.
- [x] Default intro off; retain all intro editing behind an explicit switch.
- [x]45s timeline with30s option; shared preview/export timing and metadata.
- [x] Detail starts at7/14/20.8/27.6/39.3s, each lasting4.5s including return.
- [x] Horizontal hold3-5s, vertical hold34.7-37s; all stacks share X/Y/scale.
- [x] Preserve manual uploads, background removal, reordering, fonts and audio.
- [x] Unit/browser/export checks; responsive checks, recovery hashes and release.
