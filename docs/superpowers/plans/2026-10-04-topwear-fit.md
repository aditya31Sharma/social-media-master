# Automatic topwear fit and position controls

User-supplied presets (size%, height cm, top-only yaw degrees):
Polo Sweatshirt103/-9/0; Oversized Hoodie105/-4/0;
Oversized Sweatshirt102/-9/0; Baby Tee107/-5/0;
Henley Waffle Tee97/-12/0; Oversized Tee91/-9/180.

- [x] Add a pure preset module keyed by catalogue type, returning fresh settings.
- [x] Apply the preset when choosing topwear; keep manual changes through bottom
      selection, opening/closing setup and tab switching. Unknown types use100/0.
- [x] Extend existing fit controls with top sideways and depth offsets, in cm.
      Positive X is right, positive Z is forward in the garment's initial pose.
      Rotate top-only pivot180deg for oversized tees; keep full-outfit Turn as
      preview inspection and preserve original animation timing/turns.
- [x] Share tune values in preview, video and separate cover; anchor bottoms.
- [x] Test all six presets, unknown types, fresh copies, stage transforms,
      entry/turn stability, picker application and draft/edit persistence.
- [x] Verify mobile and real WebGL/exports, update documentation and manifest,
      publish under existing authorization and verify the live release.

Reuse existing range rows and tune callbacks; no new dependencies or UI system.
Do not guess a forward offset for sweatshirts: expose the control starting at0cm.

All local checks passed; release verification follows the commit.
