#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path


KEY_NAMES = ["C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"]


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


def _select_preview_base(candidates: list[str], *, lang_dir: Path) -> str | None:
    for name in candidates:
        if not name:
            continue
        candidate = lang_dir / f"{name}.mp3"
        if candidate.exists():
            return name
    return None


def _parse_singers(artists: str) -> list[str]:
    artists = (artists or "").strip()
    if not artists:
        return []
    parts = [p.strip() for p in artists.split(",") if p.strip()]
    return parts if parts else [artists]


def _format_key(key_raw: str, mode_raw: str) -> str | None:
    try:
        key_num = int(float((key_raw or "").strip()))
    except ValueError:
        return None
    if key_num == -1:
        return None
    if key_num < 0 or key_num >= len(KEY_NAMES):
        return None

    name = KEY_NAMES[key_num]
    mode = None
    try:
        mode_num = int(float((mode_raw or "").strip()))
        mode = "major" if mode_num == 1 else "minor" if mode_num == 0 else None
    except ValueError:
        mode = None

    return f"{name} {mode}" if mode else name


def _join_url(prefix: str, *parts: str) -> str:
    prefix = prefix.rstrip("/")
    clean = [p.strip("/").replace("\\", "/") for p in parts if p]
    return "/".join([prefix, *clean])


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Build English song metadata JSON mapping songs to available audio clip filepaths."
    )
    parser.add_argument(
        "--csv",
        default="spotify_song_lists/2010's_to_present.csv",
        help="Spotify-export CSV (default: spotify_song_lists/2010's_to_present.csv)",
    )
    parser.add_argument(
        "--audio-root",
        default="audio_files",
        help="Root folder containing language subfolders (default: audio_files)",
    )
    parser.add_argument(
        "--language",
        default="english",
        help="Language subfolder under audio root (default: english)",
    )
    parser.add_argument(
        "--out",
        default="metadata/en.json",
        help="Output JSON path (default: metadata/en.json)",
    )
    parser.add_argument(
        "--public-audio-prefix",
        default="/audio",
        help="Public URL prefix that serves audio-root (default: /audio)",
    )
    parser.add_argument(
        "--durations",
        default="1,3,5,10,20,30",
        help="Comma-separated clip durations expected (default: 1,3,5,10,20,30)",
    )
    parser.add_argument(
        "--only-preview",
        default=None,
        help="Only include this preview filename stem (as in audio_files/english/<stem>.mp3)",
    )
    parser.add_argument(
        "--require-all-durations",
        action="store_true",
        help="Skip songs unless every duration clip exists",
    )
    args = parser.parse_args(argv)

    try:
        durations = [int(x.strip()) for x in args.durations.split(",") if x.strip()]
    except ValueError:
        raise SystemExit(f"Invalid --durations: {args.durations!r}")
    if not durations or any(d <= 0 for d in durations):
        raise SystemExit("--durations must be positive integers")

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    audio_root = Path(args.audio_root)
    lang_dir = audio_root / args.language
    if not lang_dir.exists():
        raise SystemExit(f"Language folder not found: {lang_dir}")

    clip_root = lang_dir / "clips"
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    only_preview = None
    if args.only_preview:
        only_preview = args.only_preview.strip()
        if only_preview.lower().endswith(".mp3"):
            only_preview = only_preview[: -len(".mp3")].rstrip()

    items: list[dict] = []
    used_ids: set[str] = set()

    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            title = (row.get("Track Name") or "").strip()
            album = (row.get("Album Name") or "").strip()
            artists = (row.get("Artist Name(s)") or "").strip()
            track_uri = (row.get("Track URI") or "").strip()
            if not title or not artists:
                continue

            track_id = _parse_track_id(track_uri)
            base = _safe_filename(f"{artists} - {title}")
            base_id = _slugify(f"{artists}-{title}")
            unique_id = base_id
            if unique_id in used_ids:
                suffix = track_id[:8] if track_id else "dup"
                unique_id = _slugify(f"{base_id}-{suffix}")
            counter = 2
            while unique_id in used_ids:
                unique_id = _slugify(f"{base_id}-{counter}")
                counter += 1

            candidates = [unique_id]
            if track_id:
                candidates.append(track_id)
            if unique_id == base_id:
                candidates.append(base)
            preview_base = _select_preview_base(candidates, lang_dir=lang_dir)
            if not preview_base:
                continue
            if only_preview and preview_base != only_preview:
                continue

            clip_dir = clip_root / preview_base
            audio: dict[str, str] = {}
            for d in durations:
                clip_path = clip_dir / f"clip_{d}s.mp3"
                if clip_path.exists():
                    audio[str(d)] = _join_url(
                        args.public_audio_prefix,
                        args.language,
                        "clips",
                        preview_base,
                        f"clip_{d}s.mp3",
                    )

            if args.require_all_durations and len(audio) != len(durations):
                continue
            if not audio:
                continue

            used_ids.add(unique_id)

            items.append(
                {
                    "id": unique_id,
                    "title": title,
                    "album": album,
                    "singers": _parse_singers(artists),
                    "key": _format_key(row.get("Key", ""), row.get("Mode", "")),
                    "audio": audio,
                }
            )

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Wrote {len(items)} songs to {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
