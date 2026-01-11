#!/usr/bin/env python3

import argparse
import csv
import os
from typing import Dict, Iterable, List, Optional, Set, Tuple


def norm(s: str) -> str:
    return "".join(ch.lower() for ch in s.strip() if ch.isalnum())


def find_column(fieldnames: List[str], candidates: List[str]) -> Optional[str]:
    by_norm = {norm(name): name for name in fieldnames}
    for c in candidates:
        hit = by_norm.get(norm(c))
        if hit:
            return hit
    return None


def iter_csv_rows(path: str) -> Tuple[List[str], Iterable[Dict[str, str]]]:
    # utf-8-sig handles Spotify CSVs that include a BOM in the first header.
    f = open(path, newline="", encoding="utf-8-sig")
    reader = csv.DictReader(f)
    if not reader.fieldnames:
        f.close()
        raise ValueError(f"No header found in CSV: {path}")

    def gen():
        try:
            for row in reader:
                yield row
        finally:
            f.close()

    return list(reader.fieldnames), gen()


def load_existing_set(path: str, key_col: str) -> Tuple[List[str], Dict[str, Dict[str, str]]]:
    if not os.path.exists(path):
        return [], {}

    fieldnames, rows = iter_csv_rows(path)
    existing: Dict[str, Dict[str, str]] = {}
    for r in rows:
        key = (r.get(key_col) or "").strip()
        if not key:
            continue
        existing[key] = r
    return fieldnames, existing


def is_tamil(genres_value: str) -> bool:
    return "tamil" in (genres_value or "").lower()


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Filter Spotify-exported CSV rows where Genres includes 'tamil' (case-insensitive) and merge into a set CSV."
    )
    ap.add_argument("inputs", nargs="+", help="Input CSV file(s)")
    ap.add_argument(
        "--out",
        default="spotify_song_lists/tamil_set.csv",
        help="Output set CSV path (default: spotify_song_lists/tamil_set.csv)",
    )
    args = ap.parse_args()

    out_path = args.out

    total_in = 0
    total_matched = 0
    total_added = 0

    existing_fieldnames: List[str]
    existing_by_key: Dict[str, Dict[str, str]]

    # We'll finalize the header based on either the existing set file or the first input.
    existing_fieldnames, existing_by_key = load_existing_set(out_path, key_col="Track URI")

    header: Optional[List[str]] = existing_fieldnames if existing_fieldnames else None
    key_col = "Track URI"

    seen_in_run: Set[str] = set()

    for in_path in args.inputs:
        fieldnames, rows = iter_csv_rows(in_path)
        if header is None:
            header = fieldnames

        resolved_key_col = find_column(fieldnames, ["Track URI", "TrackUri", "uri"])
        resolved_genres_col = find_column(fieldnames, ["generes", "Genres", "genres"])

        if not resolved_key_col:
            raise ValueError(f"Could not find Track URI column in: {in_path}")
        if not resolved_genres_col:
            raise ValueError(f"Could not find Genres/generes column in: {in_path}")

        for row in rows:
            total_in += 1
            genres_value = (row.get(resolved_genres_col) or "").strip()
            if not is_tamil(genres_value):
                continue
            total_matched += 1

            key = (row.get(resolved_key_col) or "").strip()
            if not key:
                continue
            if key in seen_in_run:
                continue
            seen_in_run.add(key)

            if key in existing_by_key:
                continue

            # Normalize row keys to match the output header, when possible.
            out_row: Dict[str, str] = {}
            if header:
                for col in header:
                    # Try exact column name first, otherwise try matching by normalized name.
                    if col in row:
                        out_row[col] = row.get(col, "")
                    else:
                        alt = find_column(list(row.keys()), [col])
                        out_row[col] = row.get(alt, "") if alt else ""
            else:
                out_row = dict(row)

            existing_by_key[key] = out_row
            total_added += 1

    if header is None:
        raise ValueError("No inputs provided with a usable header.")

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    # Write a deterministic file: keep existing order by sorting on Track URI.
    keys_sorted = sorted(existing_by_key.keys())
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        for k in keys_sorted:
            w.writerow(existing_by_key[k])

    print(f"Read rows: {total_in}")
    print(f"Matched tamil: {total_matched}")
    print(f"Newly added to set: {total_added}")
    print(f"Set size (unique Track URI): {len(existing_by_key)}")
    print(f"Wrote: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

