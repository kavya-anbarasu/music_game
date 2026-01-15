#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import re
import shutil
import subprocess
import sys
from pathlib import Path


def _require_cmd(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SystemExit(f"Missing `{name}` on PATH. Install (macOS): `brew install {name}`")
    return path


def _run(cmd: list[str]) -> None:
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        raise SystemExit(f"Command failed ({e.returncode}): {' '.join(cmd)}") from e


def _cut_clip(*, src: Path, dst: Path, seconds: int, overwrite: bool) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() and not overwrite:
        return

    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        "0",
        "-t",
        str(int(seconds)),
        "-i",
        str(src),
        "-vn",
        "-acodec",
        "libmp3lame",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-b:a",
        "192k",
        "-y" if overwrite else "-n",
        str(dst),
    ]
    _run(cmd)


def _safe_filename(value: str, *, max_len: int = 160) -> str:
    value = value.strip()
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"[^A-Za-z0-9 _.-]+", "_", value)
    value = value.strip(" ._-")
    if not value:
        return "audio_preview"
    return value[:max_len]


def _slugify(value: str, *, max_len: int = 80) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    if not value:
        value = "song"
    return value[:max_len].strip("-")


def _parse_track_id(track_uri: str) -> str | None:
    track_uri = (track_uri or "").strip()
    if track_uri.startswith("spotify:track:"):
        return track_uri.split(":")[-1] or None
    return None


def _build_id_map(csv_path: Path, *, id_style: str) -> dict[str, str]:
    id_map: dict[str, str] = {}
    used_ids: set[str] = set()
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise SystemExit(f"CSV appears empty: {csv_path}")
        required = {"Track Name"}
        if id_style == "english":
            required.add("Artist Name(s)")
        missing = sorted(required - set(reader.fieldnames))
        if missing:
            raise SystemExit(
                "CSV header did not match expected columns.\n"
                f"Missing: {missing!r}\n"
                f"Got: {reader.fieldnames!r}"
            )

        for row in reader:
            title = (row.get("Track Name") or "").strip()
            if not title:
                continue
            artist = (row.get("Artist Name(s)") or "").strip()
            track_id = _parse_track_id(row.get("Track URI") or "")

            if id_style == "tamil":
                base_id = _slugify(title)
            else:
                if not artist:
                    continue
                base_id = _slugify(f"{artist}-{title}")

            unique_id = base_id
            if unique_id in used_ids:
                suffix = track_id[:8] if track_id else "dup"
                unique_id = _slugify(f"{base_id}-{suffix}")
            counter = 2
            while unique_id in used_ids:
                unique_id = _slugify(f"{base_id}-{counter}")
                counter += 1
            used_ids.add(unique_id)

            id_map[unique_id] = unique_id
            if artist:
                legacy_name = _safe_filename(f"{artist} - {title}")
                id_map[legacy_name] = unique_id
            if track_id:
                id_map[track_id] = unique_id

    return id_map


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Cut 30s preview MP3s into multiple duration clips (1/3/5/10/20/30 seconds)."
    )
    parser.add_argument(
        "--language",
        default="english",
        help="Language subfolder under audio_files (default: english)",
    )
    parser.add_argument(
        "--audio-root",
        default="audio_files",
        help="Root folder containing language subfolders (default: audio_files)",
    )
    parser.add_argument(
        "--durations",
        default="1,3,5,10,20,30",
        help="Comma-separated clip durations in seconds (default: 1,3,5,10,20,30)",
    )
    parser.add_argument(
        "--csv",
        default=None,
        help="Optional Spotify-export CSV used to map filenames to slug ids for clip folders",
    )
    parser.add_argument(
        "--id-style",
        default="auto",
        choices=("auto", "english", "tamil"),
        help="Slug id style to use with --csv (default: auto)",
    )
    parser.add_argument(
        "--src",
        default=None,
        help="Process only this source MP3 (path or filename under the language folder)",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing clips",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=None,
        help="Max number of source files to process (default: all)",
    )
    args = parser.parse_args(argv)

    _require_cmd("ffmpeg")

    try:
        durations = [int(x.strip()) for x in args.durations.split(",") if x.strip()]
    except ValueError:
        raise SystemExit(f"Invalid --durations: {args.durations!r}")
    if not durations or any(d <= 0 for d in durations):
        raise SystemExit("--durations must be positive integers")

    audio_root = Path(args.audio_root)
    lang_dir = audio_root / args.language
    if not lang_dir.exists():
        raise SystemExit(f"Language folder not found: {lang_dir}")

    clip_root = lang_dir / "clips"
    id_style = args.id_style
    if id_style == "auto":
        id_style = "tamil" if args.language.lower() == "tamil" else "english"
    id_map = None
    if args.csv:
        csv_path = Path(args.csv)
        if not csv_path.exists():
            raise SystemExit(f"CSV not found: {csv_path}")
        id_map = _build_id_map(csv_path, id_style=id_style)

    def resolve_src(src_arg: str) -> Path:
        raw = Path(src_arg)
        if raw.exists():
            return raw

        candidate = lang_dir / raw
        if candidate.exists():
            return candidate

        src_text = src_arg.strip()
        if not src_text:
            raise SystemExit("--src must be non-empty")

        if src_text.lower().endswith(".mp3"):
            candidate2 = lang_dir / src_text
            if candidate2.exists():
                return candidate2
            stem = src_text[: -len(".mp3")].rstrip()
        else:
            candidate2 = lang_dir / f"{src_text}.mp3"
            if candidate2.exists():
                return candidate2
            stem = src_text

        matches = [p for p in lang_dir.glob("*.mp3") if p.is_file() and p.stem == stem]
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            raise SystemExit(f"Ambiguous --src {src_arg!r}; matches: {[m.name for m in matches]}")
        raise SystemExit(f"Source MP3 not found for --src {src_arg!r} under {lang_dir}")

    if args.src:
        sources = [resolve_src(args.src)]
    else:
        sources = sorted(p for p in lang_dir.glob("*.mp3") if p.is_file())
        if args.max_files is not None:
            sources = sources[: args.max_files]

    if not sources:
        print(f"No .mp3 files found in {lang_dir}")
        return 0

    for idx, src in enumerate(sources, start=1):
        base = src.stem
        out_base = id_map.get(base, base) if id_map else base
        out_dir = clip_root / out_base
        print(f"[{idx}/{len(sources)}] {src.name}")
        for d in durations:
            dst = out_dir / f"clip_{d}s.mp3"
            _cut_clip(src=src, dst=dst, seconds=d, overwrite=args.overwrite)

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
