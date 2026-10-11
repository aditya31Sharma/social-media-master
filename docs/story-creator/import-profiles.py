"""Import 5,400 geographically balanced profiles while retaining the original 600."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re

from verify import digest, safe_path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = Path(__file__).resolve().parent
SELECTION_KEY = "story-creator-expansion-v1"


def rank(user):
    return hashlib.sha256(f"{SELECTION_KEY}:{user['username'].lower()}".encode()).digest()


def select(users):
    regions = defaultdict(lambda: defaultdict(list))
    for user in users:
        regions[user["region"]][user["country_or_territory"]].append(user)
    selected = []
    for countries in regions.values():
        count = sum(map(len, countries.values()))
        assert count * 9 % 10 == 0, "Regional source count must support a 90% quota"
        target = count * 9 // 10
        quotas = {country: max(1, len(rows) * 9 // 10) for country, rows in countries.items()}
        remaining = target - sum(quotas.values())
        assert remaining >= 0, "Regional quota cannot preserve every country"
        order = sorted(
            (country for country in countries if quotas[country] < len(countries[country])),
            key=lambda country: (-(len(countries[country]) * 9 % 10), country),
        )
        assert remaining <= len(order)
        for country in order[:remaining]:
            quotas[country] += 1
        for country, rows in countries.items():
            selected.extend(sorted(rows, key=rank)[:quotas[country]])
    return sorted(selected, key=rank)


def import_profiles(source_path):
    source_bytes = source_path.read_bytes()
    source = json.loads(source_bytes)
    source_users = source["users"]
    assert len(source_users) == 6000
    assert len({user["username"].lower() for user in source_users}) == 6000
    profiles = ROOT / "stories/profiles"
    current = json.loads((profiles / "users.json").read_text())
    legacy = []
    for name in ("instagram_users.json", "instagram_users_india.json"):
        legacy.extend(json.loads((PACKAGE / "data" / name).read_text())["users"])
    assert len(legacy) == 600
    originals = [{"username": user["username"], "photo": user["username"] + ".jpg"}
                 for user in legacy]
    assert current[:600] == originals, "Original profile order or filenames changed"
    for user, metadata in zip(originals, legacy):
        assert digest(safe_path(profiles, user["photo"]).read_bytes()) == metadata["sha256"]
    selected = select(source_users)
    assert len(selected) == 5400
    assert {user["country_or_territory"] for user in selected} == {
        user["country_or_territory"] for user in source_users
    }
    assert all(user["country_or_territory"] != "India" for user in selected)
    additions = [{"username": user["username"], "photo": user["username"] + ".jpg"}
                 for user in selected]
    combined = originals + additions
    assert len({user["username"].lower() for user in combined}) == 6000
    assert len({user["photo"].lower() for user in combined}) == 6000
    assert len(current) == 600 or current == combined, "Unexpected existing expansion"
    hashes = {user["sha256"] for user in legacy}
    pending = []
    for user, entry in zip(selected, additions):
        assert re.fullmatch(r"[A-Za-z0-9_.]{1,30}", user["username"])
        data = safe_path(source_path.parent, user["profile_picture"]).read_bytes()
        assert data.startswith(b"\xff\xd8\xff") and data.endswith(b"\xff\xd9")
        assert len(data) == user["photo_bytes"] and digest(data) == user["sha256"]
        assert user["sha256"] not in hashes, user["username"]
        hashes.add(user["sha256"])
        target = safe_path(profiles, entry["photo"])
        if target.exists():
            assert target.read_bytes() == data, target
        else:
            pending.append((target, data))
    metadata = {
        "schema_version": 1,
        "count": len(selected),
        "source_count": len(source_users),
        "preserved_count": len(originals),
        "total_count": len(combined),
        "source_file": source_path.name,
        "source_sha256": digest(source_bytes),
        "sampling": {
            "method": "90% per region; proportional country quotas preserve every source country.",
            "selection_key": SELECTION_KEY,
            "ranking": "SHA-256 of selection_key:lowercase_username; largest country remainders, alphabetic ties.",
        },
        "region_counts": dict(sorted(Counter(user["region"] for user in selected).items())),
        "country_or_territory_counts": dict(sorted(Counter(
            user["country_or_territory"] for user in selected).items())),
        "total_photo_bytes": sum(user["photo_bytes"] for user in selected),
        "users": selected,
    }
    for target, data in pending:
        target.write_bytes(data)
    (PACKAGE / "data/instagram_users_expansion.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    (profiles / "users.json").write_text(json.dumps(combined, separators=(",", ":")) + "\n")
    print(f"Imported {len(selected)} profiles; {len(originals)} retained; "
          f"{len(metadata['country_or_territory_counts'])} source countries.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Source JSON; photo paths are relative to its folder")
    import_profiles(parser.parse_args().source.resolve())
