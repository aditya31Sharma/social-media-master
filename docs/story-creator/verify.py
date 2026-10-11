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
    expansion = json.loads((PACKAGE / "data/instagram_users_expansion.json").read_text())
    sources = originals + added + expansion["users"]
    assert len(originals) == 100 and len(added) == 500 and len(expansion["users"]) == 5400
    assert len(users) == 6000 and len(sources) == 6000
    assert [u["username"] for u in users] == [u["username"] for u in sources]
    assert len({u["username"].lower() for u in users}) == 6000
    assert len(list(profiles.glob("*.jpg"))) == 6000
    assert all(u["country_or_territory"] != "India" for u in expansion["users"])
    assert len({u["country_or_territory"] for u in expansion["users"]}) == 160
    hashes = set()
    for user, source in zip(users, sources):
        data = safe_path(profiles, user["photo"]).read_bytes()
        assert data.startswith(b"\xff\xd8\xff"), user["username"]
        assert digest(data) == source["sha256"], user["username"]
        hashes.add(digest(data))
    assert len(hashes) == 6000
    for module in (ROOT / "stories").glob("*.js"):
        for ref in re.findall(r"from\s+['\"]([^'\"]+)['\"]", module.read_text()):
            if ref.startswith("."):
                assert safe_path(ROOT, str((module.parent / ref).relative_to(ROOT))).is_file(), ref
    print(f"PASS: {len(manifest)} shipped files, {len(entries)} archive entries, "
          "6000 unique profiles/photos, metadata hashes and local module imports.")


if __name__ == "__main__":
    verify()
