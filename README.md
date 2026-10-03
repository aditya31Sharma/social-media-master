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
module key with `20261004-cover3` to remove product labels. Update that key together when
changing those resources so returning sessions cannot mix old and new layouts.

See [the implementation and feature checklist](docs/WORKSPACE-REVAMP.md).

## Reel cover

The Reel tab exports a separate PNG cover beside the MP4. It renders the video's
last frame (frame 899 of 900) at the selected resolution, keeping the final garment
pose and logo while omitting all four background photos and product labels. Cover
computation runs after video encoding and never replaces a video frame. The
original garment entrance/blur, photo arrival, rotation, logo/text fades and
15-second timing are preserved.

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
including nested folders and paginated results. Randomize excludes usernames found
in earlier filenames or upload metadata across all SKUs. It works without a
selected product after the complete scan succeeds. Selecting, filtering or
refreshing products does not reset exclusions; the product only chooses the save
destination. Each successful upload immediately extends the global exclusion list.
The connection strip shows total saved WebPs and excluded users. Reconnect to pick
up saves from another session. Randomize stays disabled if any folder scan fails.
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
