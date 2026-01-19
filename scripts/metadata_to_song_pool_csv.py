#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any
import sys


def _load_json_list(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit(f"Expected a list in {path}")
    return data


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Convert a metadata JSON file to a song_pool CSV."
    )
    parser.add_argument("metadata", help="Path to metadata JSON")
    parser.add_argument(
        "--language",
        default="english",
        help="Language value for song_pool (default: english)",
    )
    parser.add_argument(
        "--id-field",
        default="id",
        help="Field name for song_id in metadata (default: id)",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Output CSV path (default: <metadata>.song_pool.csv)",
    )
    args = parser.parse_args(argv)

    metadata_path = Path(args.metadata)
    items = _load_json_list(metadata_path)

    song_ids: list[str] = []
    seen: set[str] = set()
    for item in items:
        song_id = (item.get(args.id_field) or "").strip()
        if not song_id or song_id in seen:
            continue
        seen.add(song_id)
        song_ids.append(song_id)

    out_path = Path(args.out) if args.out else metadata_path.with_suffix(".song_pool.csv")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["song_id", "language"])
        for song_id in song_ids:
            writer.writerow([song_id, args.language])

    print(f"Wrote {len(song_ids)} rows to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
