# Restore Reel animation and isolate cover rendering

- [x] Restore animation logic and geometry from831e322^ without changing timing.
- [x] Add separate final-frame cover render with only corner photos omitted.
- [x] Encode video with the original drawFrame callback; create PNG afterwards.
- [x] Compare all900 frame operations against historical renderer and verify cover.
- [x] Test real Chrome encoding/downloads, update docs/hashes, publish and verify.

Retain final pose, logo and product text in the cover. Video frames must preserve
all original garment entry/blur, photo arrival/cuts, rotation and logo/text fades.

Validation:21 Node tests pass. Real Chrome encoded24 sampled frames from the
original900-frame timeline at1080x1920 H.264. Separate PNG downloaded correctly;
inspected final frame and cover. No full900-frame encode repeated this session.
Live release verification follows commit.
