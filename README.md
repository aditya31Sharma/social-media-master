# Social Media Master

Builds a Tenzen Instagram carousel from one cover shot and one product link.

Give it a cover image and a product, and it returns six 3:4 slides, ready to
save: the cover with the wordmark on it, then the five product slides in the
order that SKU's tag calls for, backgrounds cut out and everything set on the
brand gradient.

Everything runs in the browser. There is no server and no build step, which is
what lets it sit on GitHub Pages.

## Using it

1. **Cover shot.** Tap the box, drop a file on it, or paste an image - any size
   or shape. It opens in a fixed 3:4 frame you drag the photo around inside.
   Scroll, pinch or use the Size slider to scale it; arrow keys nudge, shift for
   bigger steps. It clicks into place at the centre on both axes and against
   each of the four edges, and a red guide shows which alignment caught. The
   photo can never be pulled far enough to leave a gap. The wordmark is drawn in
   the frame so you can frame around it; its size and position are fixed by the
   layout, so the only choice is white or black.
2. **Product.** Search by name, paste a product link (`tenzen.in/...`,
   `shop.tenzen.in/products/...`), or type the six-character SKU code.
   The heading, subheading, SKU and order are filled in and stay editable.
3. **Output.** Choose a width (1080 / 1620 / 3000) and a format, then Build.
4. **Review and edit.** On a phone the draft is a run of slides you swipe
   through, one at a time, with dots underneath; on a wide screen it is a grid.
   Tap any slide to open it full screen.

   Every slide starts **locked**. Locked, the gestures inspect: pinch, wheel or
   double-tap to zoom to 6x, drag to pan, swipe or the arrows to move through
   the set. Turn on **Allow changes** and the same gestures reframe the
   photograph inside that slide, with the same snapping the cover has. Nothing
   can be changed by accident.

   Every slide frames against the whole 3:4, the cover included, so all six
   move and zoom the same way. *Recentre* returns a slide to where it started:
   full frame for the cover and the close-up, the board's inset placement (89%)
   for the flats and the model shots. Those can go below 100%, because the
   gradient is drawn behind them; the cover and the close-up cannot, because
   there the photo is the background.

5. **Save into the draft.** *Save image* does not write to the device. It
   re-renders that slide at export size and makes it the draft's current version
   of it, which is what the tile shows. Edit several slides and *Save all*
   commits them together. A slide that has been changed but not saved is flagged
   both in the editor and on its tile.

6. **Download.** Separately, and only when you want the files: each tile has its
   own Download, *Download all* writes them one by one, and on a phone *Share*
   hands the whole set to the share sheet so they land in Photos together.
   Always separate images, never a zip.
   On a phone *Share* hands the whole set to the share sheet, so they land in
   Photos together. Always separate images, never a zip.

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
| `app.css` | the tool's chrome, built from the storefront's own parts |
| `app.js` | wiring only |
| `lib/shopify.js` | catalogue, product, carousel orders, image fallbacks |
| `lib/cutout.js` | the matting model and its IndexedDB cache |
| `lib/render.js` | the slides, drawn in Figma's 3000x4000 space |
| `lib/frame.js` | where a photo sits in a frame: clamping, snapping, zoom |
| `lib/framer.js` | the gestures that move it - drag, pinch, wheel, keys |
| `lib/cropper.js` | the inline 3:4 cover editor |
| `lib/editor.js` | the full-screen slide surface, locked and unlocked |
| `coi-serviceworker.js` | adds COOP/COEP so WebAssembly gets threads |
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

**Threads.** The service worker makes the page cross-origin isolated so the
model can use every core. Safari does not support COEP `credentialless`, so it
stays single-threaded, which is slower but correct. Add `?nocoi` to the URL to
turn the worker off.

**Rendering.** Slides are drawn once at their final size. All geometry is held
in Figma's 3000x4000 design space and multiplied by a single scale factor, so
1080 and 3000 are the same drawing, not one resampled from the other.

## Hosting

Static. Push to a repo, enable Pages on the branch root, done. `.nojekyll` is
there so Jekyll leaves the files alone. It must be served over HTTPS (or
localhost) or the service worker and the cut-out model will not load.

Local:

```sh
python3 -m http.server 8801
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
- The editor's preview redraws on every pointer move. That is affordable only
  because decoded photos and computed mattes are held in memory, so a redraw is
  a few drawImage calls rather than a fetch and a decode.
- PNG is the default for fidelity, which makes a photographic cover slide large.
  Switch to JPEG when the file size matters more than the last bit of gradient.
- The static outro slide is not generated here, by design.
