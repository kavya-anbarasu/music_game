#!/usr/bin/env python3
from __future__ import annotations

import argparse
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
        out_dir = clip_root / base
        print(f"[{idx}/{len(sources)}] {src.name}")
        for d in durations:
            dst = out_dir / f"clip_{d}s.mp3"
            _cut_clip(src=src, dst=dst, seconds=d, overwrite=args.overwrite)

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
