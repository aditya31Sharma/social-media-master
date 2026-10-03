# Branding and Story setup corrections

Goal: follow Aditya's supplied favicon branding, fix Reel icon weight and Story
selection clipping, and make Drive/product prerequisites obvious.

Approved direction: the user's explicit layout and branding instructions.
Retain all creators, exporters and manual editing without requiring Drive.

- [x] Replace the UI header/empty-state Tenzen mark with the supplied icon.
  Derive the UI accent from its sampled purple #7B3FC9, retaining the design
  system's spacing, type and theme roles. Leave exported artwork untouched.
- [x] Use Google's Material Symbols movie outline, locally stored, matching the
  neighbouring navigation's1.6px visual stroke at24px. Document the source.
- [x] Put Drive connection in its own top strip with persistent account state.
  Put product search/selection first in the left controls. On mobile order:
  connection, product, preview, editing. Keep save controls near the previews.
- [x] Give the selection ring more than6px scroll padding and test both ends.
- [x] Verify disconnected, connecting, connected and failed Drive states;
  retain saved-user exclusion and all600 manual accounts. Test real exports,
  keyboard/navigation, mobile and desktop in both themes.
- [x] Update README, playbook and recovery hashes. Publish under the continuing
  authorization to publish this platform's changes, then verify the live build (release verification follows the commit).

Evidence before changes: the track had4px side padding while the2px outline plus
4px offset extends6px. The first selected ring was clipped by2px. Drive controls
were the last sidebar section and no persistent connection indicator existed.
