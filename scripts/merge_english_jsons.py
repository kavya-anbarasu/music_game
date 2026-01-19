#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Callable


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


def _merge_key(
    item: dict[str, Any],
    *,
    id_field: str,
    title_field: str,
    singers_field: str,
) -> tuple[str, str] | None:
    song_id = (item.get(id_field) or "").strip()
    if song_id:
        return ("id", song_id)
    key = _title_singers_key(item, title_field=title_field, singers_field=singers_field)
    return ("title_singers", key) if key != "::" else None


def _find_duplicates(
    items: list[dict[str, Any]],
    key_fn: Callable[[dict[str, Any]], str],
) -> dict[str, list[int]]:
    seen: dict[str, list[int]] = {}
    for idx, item in enumerate(items):
        key = key_fn(item)
        seen.setdefault(key, []).append(idx)
    return {k: v for k, v in seen.items() if len(v) > 1}


def _summarize_dupes(label: str, dupes: dict[str, list[int]], limit: int) -> None:
    print(f"{label}: {len(dupes)}")
    for i, (key, idxs) in enumerate(sorted(dupes.items())[:limit], start=1):
        print(f"  {i}. {key} -> {idxs}")


def _merge(
    base: list[dict[str, Any]],
    incoming: list[dict[str, Any]],
    *,
    prefer_second: bool,
    id_field: str,
    title_field: str,
    singers_field: str,
) -> tuple[list[dict[str, Any]], int, int]:
    merged: list[dict[str, Any]] = []
    index: dict[tuple[str, str], int] = {}
    replaced = 0
    added = 0

    for item in base:
        key = _merge_key(
            item,
            id_field=id_field,
            title_field=title_field,
            singers_field=singers_field,
        )
        if key is None or key not in index:
            index[key] = len(merged) if key is not None else -1
            merged.append(item)
        else:
            if prefer_second:
                merged[index[key]] = item
                replaced += 1

    for item in incoming:
        key = _merge_key(
            item,
            id_field=id_field,
            title_field=title_field,
            singers_field=singers_field,
        )
        if key is None:
            merged.append(item)
            added += 1
            continue
        if key in index:
            if prefer_second:
                merged[index[key]] = item
                replaced += 1
            continue
        index[key] = len(merged)
        merged.append(item)
        added += 1

    return merged, added, replaced


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Report duplicates when merging two song JSON files."
    )
    parser.add_argument("base", help="Base JSON file path")
    parser.add_argument("incoming", help="Incoming JSON file path")
    parser.add_argument(
        "--out",
        default=None,
        help="Optional output path to write merged JSON",
    )
    parser.add_argument(
        "--prefer-second",
        action="store_true",
        help="When merging, prefer incoming items on duplicate keys",
    )
    parser.add_argument(
        "--show",
        type=int,
        default=10,
        help="Max number of duplicate keys to list (default: 10)",
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
    args = parser.parse_args(argv)

    base_path = Path(args.base)
    incoming_path = Path(args.incoming)
    base_items = _load_json_list(base_path)
    incoming_items = _load_json_list(incoming_path)

    print(f"Base items: {len(base_items)} ({base_path})")
    print(f"Incoming items: {len(incoming_items)} ({incoming_path})")

    base_id_dupes = _find_duplicates(base_items, lambda i: (i.get(args.id_field) or "").strip())
    incoming_id_dupes = _find_duplicates(incoming_items, lambda i: (i.get(args.id_field) or "").strip())
    _summarize_dupes("Duplicates within base by id", base_id_dupes, args.show)
    _summarize_dupes("Duplicates within incoming by id", incoming_id_dupes, args.show)

    base_title_dupes = _find_duplicates(
        base_items,
        lambda i: _title_singers_key(i, title_field=args.title_field, singers_field=args.singers_field),
    )
    incoming_title_dupes = _find_duplicates(
        incoming_items,
        lambda i: _title_singers_key(i, title_field=args.title_field, singers_field=args.singers_field),
    )
    _summarize_dupes("Duplicates within base by title+singers", base_title_dupes, args.show)
    _summarize_dupes("Duplicates within incoming by title+singers", incoming_title_dupes, args.show)

    combined = base_items + incoming_items
    combined_id_dupes = _find_duplicates(combined, lambda i: (i.get(args.id_field) or "").strip())
    combined_title_dupes = _find_duplicates(
        combined,
        lambda i: _title_singers_key(i, title_field=args.title_field, singers_field=args.singers_field),
    )
    _summarize_dupes("Duplicates across both by id", combined_id_dupes, args.show)
    _summarize_dupes("Duplicates across both by title+singers", combined_title_dupes, args.show)

    if args.out:
        merged, added, replaced = _merge(
            base_items,
            incoming_items,
            prefer_second=args.prefer_second,
            id_field=args.id_field,
            title_field=args.title_field,
            singers_field=args.singers_field,
        )
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote merged file: {out_path} (added {added}, replaced {replaced})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
