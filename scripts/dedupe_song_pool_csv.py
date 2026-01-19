#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Iterable


def _read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise SystemExit(f"CSV appears empty: {path}")
        rows = []
        for row in reader:
            rows.append({k: (v or "").strip() for k, v in row.items() if k})
        return rows


def _make_key(row: dict[str, str], columns: Iterable[str]) -> tuple[str, ...]:
    return tuple((row.get(col) or "").strip() for col in columns)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Filter incoming CSV rows to only those not present in a base CSV."
    )
    parser.add_argument("--base", required=True, help="Existing CSV (rows to exclude)")
    parser.add_argument("--incoming", required=True, help="Incoming CSV to filter")
    parser.add_argument("--out", required=True, help="Output CSV for unique incoming rows")
    parser.add_argument(
        "--key-columns",
        default="song_id,language",
        help="Comma-separated key columns (default: song_id,language)",
    )
    args = parser.parse_args(argv)

    base_path = Path(args.base)
    incoming_path = Path(args.incoming)
    out_path = Path(args.out)

    key_columns = [c.strip() for c in args.key_columns.split(",") if c.strip()]
    if not key_columns:
        raise SystemExit("--key-columns must contain at least one column")

    base_rows = _read_rows(base_path)
    incoming_rows = _read_rows(incoming_path)

    base_keys = {_make_key(row, key_columns) for row in base_rows}

    unique_rows = []
    for row in incoming_rows:
        key = _make_key(row, key_columns)
        if key in base_keys:
            continue
        unique_rows.append(row)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=incoming_rows[0].keys())
        writer.writeheader()
        writer.writerows(unique_rows)

    print(f"Base rows: {len(base_rows)}")
    print(f"Incoming rows: {len(incoming_rows)}")
    print(f"Unique rows written: {len(unique_rows)}")
    print(f"Wrote: {out_path}")
    return 0


if __name__ == "__main__":
    import sys

    raise SystemExit(main(sys.argv[1:]))
