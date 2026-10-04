# Social Media Master

**Live: https://aditya31sharma.github.io/social-media-master/**

Tenzen's browser workspace for Instagram Carousels, Reels and review Stories.

Give it a cover image and a product, and it returns six 3:4 slides, ready to
save: the cover with the wordmark on it, then the five product slides in the
order that SKU's tag calls for, backgrounds cut out and everything set on the
brand gradient.

Everything runs in the browser. There is no server and no build step, which is
what lets it sit on GitHub Pages.

## Aditya Tools Design System

All three tools share one page. Switch between **Carousel**, **Reel** and **Story**
without losing selections, photos, framing or generated output. Hash links
`./#carousel`, `./#reel` and `./#story` open each tool; old `./stories/` bookmarks
redirect to the Story tab. Drafts remain in memory until the page is reloaded.

The workspace follows the Constitution's Aditya Tools Design System, using its
a preset derived from the supplied gradient app icon, self-hosted Plus Jakarta
Sans, 44px touch targets and 54px primary
actions. Phones have bottom navigation and a contextual plus button. Desktop
has a controls card beside previews. Secondary settings fold away. Settings
offers Light, Dark and System appearance; Light is the initial default. Exported
artwork retains its original typography, colours, geometry and resolution.

The header and empty states use the supplied app icon. Purple accents come from
its artwork; exported Tenzen logos remain unchanged. The Reel navigation uses
Google Material Symbols `movie` at weight 300, normalized to the adjacent 1.6px
outlines. The source SVG is preserved in `assets/icons/`.

Changed workspace resources share the release key `20261004-reel2` in the
root HTML/import map and Story markup fetch. The cover renderer overrides its
module key with `20261004-gradient1`; the Reel UI uses the same key. Update that key together when
changing those resources so returning sessions cannot mix old and new layouts.

See [the implementation and feature checklist](docs/WORKSPACE-REVAMP.md).

## Reel cover

The Reel tab exports a separate PNG cover beside the MP4. It renders the video's
last frame (frame 899 of 900) at the selected resolution, keeping the final garment
pose and logo while omitting all four background photos and product labels. Cover
computation runs after video encoding and never replaces a video frame. The
original garment entrance/blur, photo arrival, rotation, logo/text fades and
15-second timing are preserved. Reel, cover and fit preview share the Figma
225-degree gradient from `#F2F2F2` to `#C6C9CC`. The Reel/cover Tenzen logo is
`#AAAAAA`. These colours are independent of the workspace theme.

## Reel photo-switch timing

Photo switches keep a steady0.20-second cadence after the original introduction
and settling beat, through second12. From12 to15 seconds the cut frequency eases
down with a smoothstep curve. Its slope is zero at the start and end of the
slowdown. The selected closing photos hold through the final frame; a short final
partial beat is merged so the end cannot flash faster again. All four corners and
switch sounds share the same timestamps. Garment entrance, rotation, text, logo
and separate cover behavior stay unchanged.

The schedule lives in `lib/reel.js`, with `DECEL_FROM = 12` in `lib/reel-geom.js`.
Both modules use the `20261004-timing1` import-map release key. Timing regressions
are in `docs/qa/reel-timing.test.mjs`.

## Automatic Reel fit

Selecting topwear applies these defaults. You can adjust them under **The fit**.
Fit sliders use compact rows with their values inline. Desktop places the preview
beside the controls; phones keep a sticky preview above them. Touch targets stay
44px. The setup panel uses an840px desktop width and viewport-sized preview.
Changing bottoms or switching tools preserves your manual adjustments; selecting
a new top applies its preset and resets the preview Turn to0 degrees.

| Topwear | Size | Height | Sideways | Depth | Top-only rotation |
| --- | --- | --- | --- | --- | --- |
| Polo Sweatshirt |103% |-11cm |0cm |+1cm |0 degrees |
| Oversized Hoodie |105% |-4cm |0cm |0cm |0 degrees |
| Oversized Sweatshirt |103% |-11cm |0cm |+2cm |0 degrees |
| Baby Tee |107% |-5cm |0cm |0cm |0 degrees |
| Henley Waffle Tee |96% |-12cm |+1cm |+2cm |0 degrees |
| Oversized Tee, including Acid Wash Tee |90% |-9cm |0cm |+2cm |180 degrees |

Unlisted types retain100% size and0cm offsets. **Top sideways** and **Top depth**
range from-30cm to+30cm. Positive values move the top right and forward in its
starting pose; negative values move left and backward. These adjustments affect
the preview, MP4 and separate cover. The bottom stays anchored, and the original
entrance and turning animation remain unchanged.

**Lighting** under **The fit** defaults to **Dramatic side** for every garment.
It affects both garments in the preview, MP4 and separate cover, persists when
changing products, and marks an existing export for regeneration when changed.

| Preset | Lighting |
| --- | --- |
| Defined edges | Directional key and rim with controlled fill |
| Soft studio | Balanced frontal fill and environment lighting |
| Sculpted side | Low side key to reveal folds, with restrained opposite fill |
| Overhead | Nearly vertical key with low frontal fill |
| Rim silhouette | Strong rear light with a weaker front key and fill |
| Cross light | Two opposing front-side lights, at different strengths |
| Dramatic side (default) | High side key, very little fill and an opposite rear rim |
| Original | Previous neutral lighting calibration |

All lights are neutral white. The five additional arrangements vary individual
key/fill/rim positions and strengths while retaining Defined edges exposure,
tone mapping and environment response. No colored light, tint or filter is used.
Dramatic side is the default for all models. Defined edges remains available
with its existing positions and intensities. Explicit user choices persist across product
changes; missing or unknown preset names use Dramatic side. The Figma gradient,
logo, animation and export resolution stay the same.

Every stage clones its materials before adjusting them. Three.js scene clones
share materials by default, so modifying them used to increase cached roughness
with each preview rebuild. Cached GLB materials now remain unchanged. Texture
filtering uses the device's maximum anisotropy. Temporary materials, lighting
resources and environment maps are released after rendering; cached models stay
available. No textures are upscaled and no animation frames are changed.

H.264 export targets0.20 bits per pixel per frame (24.9Mbps at1080p60, previously
13.7Mbps), with variable bitrate and quality latency mode. Larger exports retain
their existing resolution choices. Instagram's subsequent compression is outside
this tool's control; the downloaded MP4 is the quality reference.

Preset values live in `lib/reel-fit.js`; lighting lives in `lib/reel-lighting.js`.
Stage and lighting use release key `20261004-neutral1`; the UI retains
`20261004-cinema1`. Fit presets and
encoder retain `20261004-light1`. Geometry and photo timing retain
`20261004-timing1`. These keys live in the root import map.

## Story Creator and review folders

The Story tab makes individual Instagram-style WebPs from review photos, with bundled
profile pictures, independent frames, and separate downloads. A product search by
name or SKU can save all ready WebPs to `Tenzen Reviews/<product title>` in the
`team@tenzen.in` Google Drive. If a published Shopify product has no folder yet, the
first save creates it. Refresh products to see newly published SKUs.
The Drive connection strip sits above the Story workspace and keeps connection
and account status visible. Product search and selection are first in the left
controls. On phones the order is connection, product, previews, then editing.
Save to Drive sits beside the preview download actions.
Connecting Drive scans saved WebPs across every product folder in `Tenzen Reviews`,
including nested folders and paginated results. New stories start with no username
or DP. Selecting a SKU triggers a fresh global scan and then assigns unused random
profiles. Selecting the SKU before connecting waits for the successful connection
scan. Connecting without a SKU leaves profiles blank. Filtering the profile list
never selects a user implicitly.

Automatic assignment and Randomize exclude saved usernames across ALL SKUs,
including earlier filenames and upload metadata, plus usernames already assigned
to other open stories. Adding another story uses this same checked pool. Clearing
the SKU clears the profiles. A failed or incomplete scan, or an exhausted pool,
leaves unassigned stories blank and Randomize disabled. Older scan/avatar requests
cannot overwrite newer selections. Each completed upload extends the exclusions
immediately while retaining the identity displayed on the saved card.

All 600 accounts remain in the manual profile picker.
HEIC and HEIF iPhone photos are accepted. A pinned browser decoder loads only when
the browser cannot open one natively; conversion stays in the browser.

Drive saving uses Tenzen's Google Cloud project and the configured public OAuth
web client. Sign in as `team@tenzen.in` when prompted. Local WebP downloads also
work without signing in. See [Drive setup](docs/story-creator/DRIVE-SETUP.md).

The same GitHub Pages files are also served inside Tenzen HQ at
`https://dashboard.tenzen.in/social-media-master/`. A push to `main` releases both.

## Using it

1. **Pick a product.** Search it, paste a link (`tenzen.in/...`,
   `shop.tenzen.in/products/...`), or type the six-character SKU. Everything
   else appears once there is a product to apply it to.
2. **Add a cover shot**, choose the wordmark in white or black, set the export
   width and format, and **Build**. Six slides appear: the cover, then the five
   product slides in that SKU's order, backgrounds cut out.
3. **Add another SKU.** The composer clears itself and the next carousel stacks
   below the last. Each keeps its own product, its own slides and its own six
   files, because each one is a separate post.
4. **Edit.** Every slide has an Edit button and opens full screen. It starts
   **locked** - the gestures inspect, and you can swipe through the set. Turn on
   **Allow edits** and the same gestures move the photograph inside the 3:4
   frame: drag, pinch, scroll, arrow keys.

   The lock re-arms every time you leave, so a slide you edited once does not
   open unlocked the next time. Snapping offers the centre and each edge, and six alignment buttons put an
   edge or a centre exactly where it belongs. Nothing is confined: a photo can
   hang off any edge or sit in half the frame and leave the rest to the
   background.

5. **Save changes** re-renders that slide at export size, makes it the draft's
   current version, and takes you back to the set. **Save all** does the same
   for everything you changed. Neither writes to the device. A slide changed but
   not saved is flagged in both places.
6. **Download.** Separately: each slide has its own Save, each carousel has
   **Download 6**, and **Download everything** writes every carousel in order.
   Always separate images, never a zip.

On a phone the slides scroll horizontally, with dots underneath. The composer
sits above the preview and expands inline. Story previews sit above their
controls. The bottom navigation remains available throughout the workspace.

## What it decides for you

**Order.** Each product carries one of four tags, and each tag fixes the run of
five, per the Figma board:

| Tag | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| `man-front` | Front | Model-Man-Front | Macro-Front | Model-Woman-Back | Back |
| `man-back` | Back | Model-Man-Back | Macro-Back | Model-Woman-Front | Front |
| `woman-front` | Front | Model-Woman-Front | Macro-Front | Model-Man-Back | Back |
| `woman-back` | Back | Model-Woman-Back | Macro-Back | Model-Man-Front | Front |

These are the *carousel* orders. They are deliberately not the website's media
orders, which lead with a model shot rather than the flat.

**Treatment.** Position 1 and 5 are the flats: cut out, set on the gradient,
carrying the heading, the subheading and the `tenzen.in/CODE` pill. Positions 2
and 4 are the model shots: cut out, gradient, no copy. Position 3 is the
close-up and is the one slide that bleeds to all four edges, because a fabric
macro has no subject to lift off a background.

**Missing frames.** Not every SKU was shot the same way, so a slot that has no
exact file walks outwards: its own `-Alt` and `-Full` crops, then the same pose
on the other model, then the other pose. A photo already used earlier in the
carousel is skipped where there is any alternative, so a baby tee does not show
the same frame twice. Whatever gets substituted is named in the status line.

**Copy.** The heading is the part of the title before the product type and the
subheading is the rest, so *Narcissistic Tendency Oversized Hoodie Black* splits
at *Oversized Hoodie*. Both fields are editable before you build.

## How it is put together

| Piece | What it does |
|---|---|
| `index.html` | markup |
| `app.css` | original editor/component layout, overridden by the shared design system |
| `styles/tokens.css`, `styles/workspace.css`, `styles/fonts.css` | Aditya Tools theme, responsive workspace and self-hosted UI type |
| `lib/workspace.js`, `lib/theme.js` | persistent panels, hash navigation, lazy Story mount and appearance preference |
| `app.js` | wiring only |
| `lib/shopify.js` | catalogue, product, carousel orders, image fallbacks |
| `lib/cutout.js` | the matting model and its IndexedDB cache |
| `lib/render.js` | the slides, drawn in Figma's 3000x4000 space |
| `lib/frame.js` | where a photo sits in a frame: clamping, snapping, zoom |
| `lib/framer.js` | the gestures that move it - drag, pinch, wheel, keys |
| `lib/editor.js` | the full-screen slide surface, locked and unlocked |
| `coi-serviceworker.js` | keeps the shared workspace compatible with Google sign-in; retains isolation for the Reel lab |
| `stories/entry.js`, `stories/story.js` | old URL compatibility and native in-page Story editor |
| `assets/logo.svg` | the wordmark, drawn with `currentColor` so it recolours |

**Catalogue** comes from Shopify's Storefront API. The token in `app.js` is the
public read-only kind that every headless storefront ships in its client bundle:
it reads products already published on tenzen.in and nothing else. It is not the
Admin token. To rotate it, create a new Storefront access token in the Shopify
admin and replace `SF_TOKEN`.

**Cut-outs** run locally through `@imgly/background-removal` (ISNet, ONNX,
WebAssembly). The weights are about 88MB, fetched from a CDN the first time you
pick a cover or a product and cached by the browser thereafter. Computed mattes
are cached in IndexedDB per image, so rebuilding a carousel is close to instant.

**Threads and Drive.** Google's sign-in popup needs the shared document to remain
non-isolated. Background removal uses its supported single-thread WebAssembly
fallback, which can be slower on an uncached image. The Reel lab retains
COOP/COEP isolation. An older controlling worker is updated automatically; an
isolated document reloads once when the replacement takes control. Add `?nocoi`
to skip worker registration.

**Rendering.** Slides are drawn once at their final size. All geometry is held
in Figma's 3000x4000 design space and multiplied by a single scale factor, so
1080 and 3000 are the same drawing, not one resampled from the other.

## Hosting

Static. Push to a repo, enable Pages on the branch root, done. `.nojekyll` is
there so Jekyll leaves the files alone. It must be served over HTTPS (or
localhost) or the service worker and the cut-out model will not load.

Local:

```sh
python3 -m http.server 8088
```

## Known edges

- The slide copy is set in Helvetica Neue, which is present on Apple devices and
  not on most others. Elsewhere it falls back to Arial and the tool says so.
- A crop is three resolution-independent numbers: scale as a multiple of "just
  covers the frame", and the photo's centre offset as a fraction of the frame.
  The same three describe it at 340px in the rail, at 1000px in the editor's
  live preview and at 3000px on export, so the preview can be trusted as the
  thing that will be saved. Scale has a floor of 1, which is why a gap is not
  something you can produce.
- The editor draws a slide as three layers - a background canvas, the cut-out
  as an `<img>`, a foreground canvas - so moving the photograph is one transform
  on one element and the compositor does the work. A 40-step drag makes zero
  canvas calls. Redrawing the whole canvas per pointer move, which this
  replaced, rebuilt an offscreen surface and recomposited a matte every frame.
- The gesture tracks an unsnapped position and snapping is applied on top of it.
  Writing the snapped value back as the new truth traps the photo: every move
  smaller than the snap radius lands in the zone and is pulled back, so nudging
  did nothing and only a flick escaped. Snapping stays on through the release,
  or the alignment the drag just found springs off again the moment you let go.
- The tile shows a slide at about 300px and gets its own small JPEG. Handing
  it the 1620px export meant twelve tiles held 38MB of PNG and roughly 170MB
  once decoded, which is what made a phone crawl; the export stays a Blob and
  is never decoded until it is saved.
- Every `min-width: 900px` override lives in one block at the end of the
  stylesheet. Scattered through the file, three of them were declared before
  the base rule they meant to beat and silently lost the cascade.
- Slide width on a phone is a viewport unit, never a percentage. A percentage
  resolves against a container whose own width depends on this content, and the
  browser breaks that cycle with the max-content size - which quietly puts the
  whole page into sideways scroll.
- PNG is the default for fidelity, which makes a photographic cover slide large.
  Switch to JPEG when the file size matters more than the last bit of gradient.
- The static outro slide is not generated here, by design.


## Verification

```sh
python3 docs/story-creator/verify.py
node --test docs/story-creator/qa/*.test.mjs docs/qa/*.test.mjs
```

Use `http://localhost:8088/#story` for the current Story browser checks.
`docs/qa/` contains workspace, paste, recovery and Reel-control integration checks.
See [local revamp evidence and limits](docs/WORKSPACE-REVAMP.md#local-verification-2026-10-03).
A live release requires Aditya's explicit approval before pushing main.


## Website and Home Screen icons

The browser favicons and iOS Home Screen icon use Aditya's `social-m-m.png`,
with the original preserved at `assets/social-m-m.png`. Browser sizes are16,32
and96px, Apple touch icon180px, and manifest icons192/512px. All four HTML entry
pages reference these assets using relative URLs and a new icon cache key.
`site.webmanifest` launches the shared root workspace in standalone mode, scoped
within the current `/social-media-master/` deployment. No offline cache is added.
In iPhone Safari, use Share > Add to Home Screen. Replace an older saved shortcut
if iOS keeps its cached icon. Physical-device installation has not been tested.

Implementation follows [Apple's Web Clip icon guidance](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
and [WebKit's Home Screen manifest guidance](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Fit layout CSS is versioned as `20261004-light1` in the root HTML.


Lighting/fit QA:32 Node tests, including all900 animation-frame command comparisons
and the cached-material regression;18 browser fit/lighting checks. Real Chrome
exported24 sampled frames from the900-frame timeline at1080x1920/60fps, plus a
matching1080x1920 PNG cover, with no page errors. Lighting changes enabled
regeneration. The entire900-frame MP4 was not re-encoded in this check. Responsive
preview/control checks covered320,375,768,1024 and1440px widths.

Photo-timing QA:35 Node tests passed. Real Chrome exported all900 frames at60fps
using540x960 as the QA resolution, with AAC switch audio and a separate cover.
Video duration is15 seconds; production resolution options remain unchanged.

Neutral lighting QA:42 Node tests cover independent light directions, neutral
configurations, exact Defined edges calibration, defaults, timing and Story
behavior. Browser checks cover all six topwear defaults and retained choices.

Story identity QA:40 Node tests plus browser regressions verify blank initial
profiles, no implicit search selection, assignment after SKU/global scan, global
saved-user exclusions, distinct draft users, upload updates, failed/exhausted
scans and stale requests. All600 manual profiles remain; the empty-state option
is excluded from profile counts. Story/card/render/Drive UI use20261004-users1.

Neutral lighting browser/export QA: all8 presets rendered on white and black garments;24 fit/default/persistence checks passed. Real Chrome exported24 sampled frames from the900-frame timeline to1080p H.264 and a1080p PNG cover with zero page errors. Lighting changes enable regeneration.


Fit preview performance: the setup view uses a320x568 canvas,512px texture copies
and512px shadow maps. It retains one WebGL scene across fit and lighting changes;
slider input is coalesced per animation frame. Garment downloads start on product
selection and both garments load concurrently. Originals remain cached at full
quality for video/cover exports. The preview shows loading feedback and a Retry
button after a failure; failed GLB requests are evicted from the shared cache.
`lib/reel-preview.js` owns the preview lifecycle and ignores stale product loads.
Preview texture Sources must be separate from cached original Sources: Three.js
texture clones otherwise share image data. Stage/UI/preview modules and stylesheet
use20261004-preview1. Model downloads are still the original Shopify GLBs.

Preview QA:47 Node tests;24 browser fit/default checks; real Chrome confirms one renderer across12 slider updates and8 lighting choices, network-failure Retry recovery, plus sampled24-frame1080p H.264 and1080p PNG cover export with zero page errors.

Default lighting update: Dramatic side (`lowkey`) is selected initially and used for missing/unknown presets. Lighting import-map key20261004-default2; custom choices still persist across garment selections.


## Album showcase reel

Choose **Reel > Reel template > Album showcase > Set up album reel**. The original
Outfit reel remains available with separate drafts and finished outputs.

Five cutout photos and their product fronts load automatically: Stand Unshaken,
Victor Doom, California Love, The Ragnarsons and Kingdom Of Northumbria, in that
order. The first four use Model-Man-Front-Full; Northumbria uses
Model-Woman-Front-Full. Exact product titles, handles and source URLs are recorded
in `assets/album-defaults/products.json`. Ten transparent WebPs are bundled locally
(3.4MB total), so photo defaults require neither Shopify access nor runtime matting.
They load only when the album editor opens. Failed loads can be retried with
**Load missing SKU photos**. A late default load cannot replace a newer upload.

Replace or reorder models as before. JPG/WebP/PNG/HEIC uploads and **Remove
background** retain the existing free local matting engine. Model images are
capped at2560px; alpha margins are trimmed for consistent sizing. Product name
and front image can be edited per slot and follow the model when reordered.
Replacing a model photo preserves its associated product details.

The default20-second9:16 animation begins with all five models at identical
X/Y/scale, Stand Unshaken in front. After the horizontal expansion it zooms to
Victor Doom first, then California Love, Ragnarsons, Northumbria and finally
Stand Unshaken. Cuts take0.4s; horizontal and vertical lineups hold for0.5s.
Each outfit gets a2.5s detail sequence: fast bottom-left zoom, rotating3D garment
and full product name on the right, then a return and brief full-view pause.
There is no white product panel. **Sound and export > Duration** retains30s/45s
options, proportionally scaling the same choreography.

All moving layers share nine temporal shutter samples over85ms, producing
visible directional motion blur on spreads, zooms, slices and slides. Three
angular samples add rotational blur to the actual3D garments. Stationary holds
and text remain sharp. The transparent garment stage uses Dramatic side lighting,
shared cached GLB loading and cloned fabric materials from the existing Outfit
renderer. One context serves all five garments. Preview uses240x360 and512px
texture copies; export uses480x720 and original textures, with1024px shadows.
The preview loads lazily after photos appear. Export waits for3D readiness;
failed3D downloads have a retry button. **Choose3D garment** accepts a localGLB.
The previous front-image workflow remains available in each Product detail
selector, but the bundled SKUs default to rotating3D.

The intro is off by default. **Album intro > Include intro** restores the optional
cover and independently editable heading, album and creator labels. It occupies
three seconds within the selected total duration. Font, size, tracking, line
height, color, weight, italic, alignment and X/Y controls remain available.
**Edit intro** supports dragging, center snapping within8screen pixels, arrow-key
nudges of1export pixel (10 with Shift), and center buttons. Local font discovery
requires a supported browser and permission; TTF/OTF/WOFF/WOFF2 file import works
as a fallback. Font files stay in the page session.

Playback and export share one deterministic Canvas renderer. Optional local
music supports a start offset and volume. Exports are720p or1080p,60fps H.264 MP4
with optional AAC audio. PNG covers use the finished intro, or the final model
when the intro is off. Shared output metadata uses the selected duration; the
original Outfit reel remains15s.

Modules: `lib/album-motion.js`, `album-render.js`, `album-text.js`, `album-ui.js`
`album-defaults.js` and `album-product.js`, with scoped `styles/album.css`. Release key:
20261005-album3. No new dependencies, server or hosting changes.

Current revision QA:56 unit tests pass, covering centered stack, new2/3/4/5/1
order,20s duration, detail rotation/return, holds and temporal shutter width.
Real Chrome rendered every garment and choreography phase without page errors.
Full export, browser regression and release checks are recorded below.

Release QA:16 actual3D browser checks and375/768/1024/1440px layout checks pass,
plus24 original fit and13 workspace checks. GLB failure blocks export, Retry
recovers, transparent-corner pixels remain alpha0, and rendered pixels change
with rotation. Photo mode still works. Full1080x1920 H264 export:1200frames,
20.000s, completed18.247s using AppleM4/ANGLEMetal, zero browser errors.
SoftwareWebGL QA was much slower; use hardwareMetal on this Mac for full exports.
Recovery manifest now covers744 shipped files.


## Album creator V2 (2026-10-05)

Choose **Reel > Reel template > Album creator V2 > Set up Album creator V2**.
This is a separate template with independent settings and finished outputs.
The existing Album showcase and Outfit reel remain available.

The bundled `intro-winter.mp4` plays in full (10.7667 seconds, 720x1280 source),
with its original audio enabled. Replace the intro, omit it, or mute it in the
editor. The gallery adds 23 seconds by default, with a 30-second option.
Gallery music starts after the intro; the intro audio plays once and never loops.
Default total length is 33.7667 seconds at 60fps.

Five Shopify Shoot-1 photos load automatically, in this order: Victor Doom,
California Love, The Ragnarsons, Kingdom Of Northumbria, Stand Unshaken.
Original backgrounds stay in the photos. Each portrait 2:3 card sits in a
perspective stack on a dark stage. The camera pushes into a photo, holds its
product detail, pulls back, then flips/drops the current card to reveal the next.
Seven shutter samples over 60ms blur gallery flips and camera moves.

The centered frosted card is 86% of frame width by 82% of height, occupying
70.52% of the viewport. It contains the rotating 3D garment, editable product
name and animated Add to Bag button. Behind it, the shoot photo is blurred,
desaturated and dimmed. Garments use the existing Dramatic side lighting and
shared GLB cache, original export textures and three angular blur samples.
V2 garment canvases are 320x384 in preview and 960x1152 in export. The optional
size argument in `createAlbumProducts` leaves V1's default dimensions unchanged.

The button visibly receives a cursor click, then becomes an Added/check pill
and Visit bag pill. Their 30:70 split, 8px-equivalent gap and 0.5-second
cubic-bezier(.32,.72,0,1) transition follow the live Tenzen product page.
This is a rendered video animation and sends no cart requests.

Each product can be reordered, renamed, given a replacement shoot photo
(including HEIC) or a local GLB. Preview playback and scrubbing use the same
clock as export. Output is 720p or 1080p, 60fps H.264 MP4 with AAC when audio is
included, plus a PNG cover. Intro seeking is deterministic at 30fps; the final
MP4 repeats those source frames on its 60fps timeline. The source intro is
720p and is scaled when exporting 1080p.

Files: `lib/album-v2-{motion,media,render,ui}.js`, `styles/album-v2.css`, and
`assets/album-v2/` containing five shoot WebPs, intro MP4/AAC and product/source
metadata. All media is bundled for recovery; GLBs use existing Shopify URLs.
App, dialog and import-map registration connect V2 without replacing V1.
Cache key: `20261005-albumv2-1`. No dependencies, services or HQ changes.

Loading failures show Retry and block export. After a failed replacement GLB,
choose a valid GLB and retry. A failed rebuild cannot export an old preview
with newly edited product data. Local uploads and settings last for the page
session, matching the other Reel templates.

V2 verification: 63 unit tests, 15 V2 browser checks, 16 V1 checks, 24 Outfit fit
checks and 13 workspace checks passed. Layouts verified at 375/768/1024/1440px.
Full 1080x1920 H.264/AAC export contains 2027 frames (33.7833s video, 33.856s
including AAC padding), with zero browser errors. All five products and CTA
states were inspected in exported frames. Intro source frames visibly advance.

Known trap: Python's simple HTTP server does not offer byte-range seeking;
Chrome can report seek completion while remaining at time zero. Load the intro
as a complete Blob URL before seeking. The seek loop also rejects an unchanged
position, preventing an infinite loop. Normal source-frame seeks measured 3-4ms.

Final V2 export took 26.145s on hardware Metal. Seven additional checks passed:
GLB failure blocks export, Retry recovers, custom intro retains audio, invalid
replacement blocks stale export, valid replacement restores it, Escape closes,
and keyboard focus stays in the dialog. Recovery manifest covers 760 files.
