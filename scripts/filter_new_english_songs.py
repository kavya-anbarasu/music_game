#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any, Iterable


def _load_json_list(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise SystemExit(f"Expected a list in {path}")
    return data


def _normalize_singers(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        parts = [value]
    elif isinstance(value, list):
        parts = [str(v) for v in value]
    else:
        parts = [str(value)]
    return [p.strip() for p in parts if p and p.strip()]


def _title_singers_key(item: dict[str, Any], *, title_field: str, singers_field: str) -> str:
    title = (item.get(title_field) or "").strip().lower()
    singers = _normalize_singers(item.get(singers_field))
    singers_key = ",".join(sorted(s.lower() for s in singers if s))
    return f"{title}::{singers_key}"


def _build_base_keys(
    items: Iterable[dict[str, Any]],
    mode: str,
    *,
    id_field: str,
    title_field: str,
    singers_field: str,
) -> set[str]:
    keys: set[str] = set()
    for item in items:
        if mode in {"id", "both"}:
            song_id = (item.get(id_field) or "").strip()
            if song_id:
                keys.add(f"id::{song_id}")
        if mode in {"title_singers", "both"}:
            key = _title_singers_key(item, title_field=title_field, singers_field=singers_field)
            if key != "::":
                keys.add(f"title_singers::{key}")
    return keys


def _is_duplicate(
    item: dict[str, Any],
    base_keys: set[str],
    mode: str,
    *,
    id_field: str,
    title_field: str,
    singers_field: str,
) -> bool:
    if mode in {"id", "both"}:
        song_id = (item.get(id_field) or "").strip()
        if song_id and f"id::{song_id}" in base_keys:
            return True
    if mode in {"title_singers", "both"}:
        key = _title_singers_key(item, title_field=title_field, singers_field=singers_field)
        if key != "::" and f"title_singers::{key}" in base_keys:
            return True
    return False


def _safe_move(src: Path, dst_dir: Path) -> Path:
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / src.name
    if not dst.exists():
        return src.rename(dst)
    counter = 2
    while True:
        candidate = dst_dir / f"{src.name}__dup{counter}"
        if not candidate.exists():
            return src.rename(candidate)
        counter += 1


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Filter incoming songs to only new items and move duplicate clip folders."
    )
    parser.add_argument("--base", required=True, help="Existing JSON pool (e.g., english_songs.json)")
    parser.add_argument("--incoming", required=True, help="Incoming JSON to filter")
    parser.add_argument("--out", required=True, help="Output JSON for non-duplicate items")
    parser.add_argument(
        "--clips-root",
        required=True,
        help="Clips root containing subfolders named by song id",
    )
    parser.add_argument(
        "--duplicates-dir",
        required=True,
        help="Destination folder for duplicate clip subfolders",
    )
    parser.add_argument(
        "--duplicate-mode",
        default="id",
        choices=("id", "title_singers", "both"),
        help="Duplicate detection mode (default: id)",
    )
    parser.add_argument(
        "--id-field",
        default="id",
        help="Field name for song id (default: id)",
    )
    parser.add_argument(
        "--title-field",
        default="title",
        help="Field name for song title (default: title)",
    )
    parser.add_argument(
        "--singers-field",
        default="singers",
        help="Field name for singers/artists list (default: singers)",
    )
    parser.add_argument(
        "--clip-id-field",
        default=None,
        help="Field name to map clip folder names (default: --id-field)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not move clips or write output, just report",
    )
    args = parser.parse_args(argv)

    base_items = _load_json_list(Path(args.base))
    incoming_items = _load_json_list(Path(args.incoming))

    clip_id_field = args.clip_id_field or args.id_field
    base_keys = _build_base_keys(
        base_items,
        args.duplicate_mode,
        id_field=args.id_field,
        title_field=args.title_field,
        singers_field=args.singers_field,
    )

    non_duplicates: list[dict[str, Any]] = []
    duplicates: list[dict[str, Any]] = []
    for item in incoming_items:
        if _is_duplicate(
            item,
            base_keys,
            args.duplicate_mode,
            id_field=args.id_field,
            title_field=args.title_field,
            singers_field=args.singers_field,
        ):
            duplicates.append(item)
        else:
            non_duplicates.append(item)

    print(f"Incoming items: {len(incoming_items)}")
    print(f"Non-duplicates: {len(non_duplicates)}")
    print(f"Duplicates: {len(duplicates)}")

    if not args.dry_run:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(
            json.dumps(non_duplicates, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        clips_root = Path(args.clips_root)
        duplicates_dir = Path(args.duplicates_dir)
        moved = 0
        missing = 0
        already = 0
        for item in duplicates:
            song_id = (item.get(clip_id_field) or "").strip()
            if not song_id:
                continue
            src = clips_root / song_id
            if not src.exists():
                existing = duplicates_dir / song_id
                if existing.exists():
                    already += 1
                else:
                    missing += 1
                continue
            if src.is_dir():
                _safe_move(src, duplicates_dir)
                moved += 1
            else:
                duplicates_dir.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src), str(duplicates_dir / src.name))
                moved += 1

        print(f"Moved duplicate clip folders: {moved}")
        if already:
            print(f"Already in duplicates folder: {already}")
        if missing:
            print(f"Missing clip folders: {missing}")

    return 0


if __name__ == "__main__":
    import sys

    raise SystemExit(main(sys.argv[1:]))
