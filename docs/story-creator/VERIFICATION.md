# Preservation verification: 2026-10-03

Before GitHub publication:

- Integrity verifier passed for all packaged files and1876 archived source entries.
-600 unique profile handles,600 unique JPEG hashes; all match full source metadata.
-22 app/library/story JavaScript syntax checks passed.
- Six repository-relative Node crop tests passed, zero failures.
- Fresh localhost browser runs: batch22/22, dataset7/7 (all600 DPs decoded), progress12/12, random-user6/6. Total47 checks.
- Runtime application files and existing Carousel/Reel source were not changed by the preservation work.
- Credential-pattern scan found no matching private-key, GitHub-token or Slack-token patterns in packaged text/source and archive text entries. Browser session state and unrelated machine data are excluded.

The verifier initially resolved profile photo filenames against stories/ instead of stories/profiles/. The verification helper was corrected to match the existing index, then all integrity checks passed. The app itself was unaffected.

The deployment branch is main and GitHub Pages publishes its root. Fresh-clone and deployed-route verification follow publication and are reported in the session handoff response. Use verify.py to independently reproduce file/data integrity checks.
