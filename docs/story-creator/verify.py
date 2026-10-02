"""Verify the complete Story Creator package after cloning; no dependencies."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = Path(__file__).resolve().parent


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(root, name):
    path = (root / name).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError(f"Path escapes package: {name}")
    return path


def verify():
    manifest = json.loads((PACKAGE / "files-manifest.json").read_text())
    for item in manifest:
        data = safe_path(ROOT, item["path"]).read_bytes()
        assert len(data) == item["bytes"], item["path"]
        assert digest(data) == item["sha256"], item["path"]

    entries = json.loads((PACKAGE / "archive-manifest.json").read_text())
    for archive in sorted({item["archive"] for item in entries}):
        expected = [item for item in entries if item["archive"] == archive]
        with zipfile.ZipFile(safe_path(PACKAGE / "archives", archive)) as bundle:
            assert sorted(bundle.namelist()) == sorted(item["path"] for item in expected)
            for item in expected:
                safe_path(PACKAGE, item["path"])
                data = bundle.read(item["path"])
                assert len(data) == item["bytes"], item["path"]
                assert digest(data) == item["sha256"], item["path"]

    profiles = ROOT / "stories/profiles"
    users = json.loads((profiles / "users.json").read_text())
    originals = json.loads((PACKAGE / "data/instagram_users.json").read_text())["users"]
    added = json.loads((PACKAGE / "data/instagram_users_india.json").read_text())["users"]
    assert len(originals) == 100 and len(added) == 500 and len(users) == 600
    assert [u["username"] for u in users] == [u["username"] for u in originals + added]
    assert len({u["username"].lower() for u in users}) == 600
    assert len(list(profiles.glob("*.jpg"))) == 600
    hashes = set()
    for user, source in zip(users, originals + added):
        data = safe_path(profiles, user["photo"]).read_bytes()
        assert data.startswith(b"\xff\xd8\xff"), user["username"]
        assert digest(data) == source["sha256"], user["username"]
        hashes.add(digest(data))
    assert len(hashes) == 600
    for module in (ROOT / "stories").glob("*.js"):
        for ref in re.findall(r"from\s+['\"]([^'\"]+)['\"]", module.read_text()):
            if ref.startswith("."):
                assert safe_path(ROOT, str((module.parent / ref).relative_to(ROOT))).is_file(), ref
    print(f"PASS: {len(manifest)} shipped files, {len(entries)} archive entries, "
          "600 unique profiles/photos, metadata hashes and local module imports.")


if __name__ == "__main__":
    verify()
