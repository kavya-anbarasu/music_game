#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import re
import shutil
import subprocess
import sys
from pathlib import Path


def _format_hhmmss(total_seconds: int) -> str:
    total_seconds = max(0, int(total_seconds))
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def _safe_filename(value: str, *, max_len: int = 160) -> str:
    value = value.strip()
    value = re.sub(r"\s+", " ", value)
    value = re.sub(r"[^A-Za-z0-9 _.-]+", "_", value)
    value = value.strip(" ._-")
    if not value:
        return "audio_preview"
    return value[:max_len]


def _require_cmd(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SystemExit(
            f"Missing `{name}` on PATH.\n"
            f"Install with Homebrew: `brew install {name}`\n"
            f"Or via pip (yt-dlp only): `python -m pip install -U yt-dlp`"
        )
    return path


def _run(cmd: list[str], *, capture_stdout: bool = False) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            cmd,
            check=True,
            text=True,
            stdout=subprocess.PIPE if capture_stdout else None,
        )
    except FileNotFoundError as e:
        raise SystemExit(f"Failed to run `{cmd[0]}`: {e}") from e
    except subprocess.CalledProcessError as e:
        raise SystemExit(f"Command failed ({e.returncode}): {' '.join(cmd)}") from e


def _find_first_youtube_result(query: str) -> tuple[str, str]:
    _require_cmd("yt-dlp")
    res = _run(
        [
            "yt-dlp",
            "--no-playlist",
            "--flat-playlist",
            "--print",
            "%(webpage_url)s\t%(title)s",
            f"ytsearch1:{query}",
        ],
        capture_stdout=True,
    )
    line = (res.stdout or "").strip()
    if not line:
        raise SystemExit(f"No YouTube results for query: {query!r}")
    url, _, title = line.partition("\t")
    url = url.strip()
    title = title.strip() or "Unknown title"
    if not url:
        raise SystemExit(f"Unexpected yt-dlp output: {line!r}")
    return url, title


def _download_audio_preview(
    *,
    url: str,
    out_base: Path,
    seconds: int,
    audio_format: str,
) -> Path:
    _require_cmd("yt-dlp")
    _require_cmd("ffmpeg")

    out_base.parent.mkdir(parents=True, exist_ok=True)
    section = f"*{_format_hhmmss(0)}-{_format_hhmmss(seconds)}"

    _run(
        [
            "yt-dlp",
            "--no-playlist",
            "-f",
            "bestaudio/best",
            "--extract-audio",
            "--audio-format",
            audio_format,
            "--download-sections",
            section,
            "--force-keyframes-at-cuts",
            "-o",
            str(out_base) + ".%(ext)s",
            url,
        ]
    )

    expected = out_base.with_suffix(f".{audio_format}")
    return expected


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Download up to the first N seconds of audio from YouTube.\n"
            "If artist/title are omitted, reads tracks from a Spotify-export CSV."
        )
    )
    parser.add_argument("artist", nargs="?", help="Artist name (e.g. 'Daft Punk')")
    parser.add_argument("title", nargs="?", help="Song title (e.g. 'One More Time')")
    parser.add_argument(
        "--seconds",
        type=int,
        default=30,
        help="Max duration to download (default: 30)",
    )
    parser.add_argument(
        "--csv",
        default="spotify_song_lists/2010's_to_present.csv",
        help="CSV file to read when artist/title are omitted",
    )
    parser.add_argument(
        "--max-tracks",
        type=int,
        default=None,
        help="Max tracks to process from CSV (default: all)",
    )
    parser.add_argument(
        "--start-at",
        type=int,
        default=0,
        help="Start index in CSV (0-based, default: 0)",
    )
    parser.add_argument(
        "--format",
        default="mp3",
        help="Audio format for output (default: mp3)",
    )
    parser.add_argument(
        "--out-dir",
        default="audio_files",
        help="Output directory (default: audio_files)",
    )
    parser.add_argument(
        "--query",
        default=None,
        help="Override the YouTube search query (default: '<artist> <title> official audio')",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only print the chosen YouTube URL and exit",
    )
    args = parser.parse_args(argv)

    if args.seconds <= 0:
        raise SystemExit("--seconds must be > 0")

    out_dir = Path(args.out_dir)

    def process_one(*, artist: str, title: str) -> None:
        query = args.query or f"{artist} {title} official audio"
        url, yt_title = _find_first_youtube_result(query)
        print(f"Chosen YouTube result: {yt_title}")
        print(f"URL: {url}")
        if args.dry_run:
            return

        base_name = _safe_filename(f"{artist} - {title}")
        out_base = out_dir / base_name
        out_path = _download_audio_preview(
            url=url,
            out_base=out_base,
            seconds=args.seconds,
            audio_format=args.format,
        )
        if out_path.exists():
            print(f"Wrote: {out_path}")
        else:
            print(
                "Download finished, but the expected output file was not found.\n"
                f"Look in: {out_dir.resolve()}"
            )

    if args.artist and args.title:
        process_one(artist=args.artist, title=args.title)
        return 0

    if args.artist or args.title:
        raise SystemExit("Provide both artist and title, or neither (to read from --csv).")

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if not header:
            raise SystemExit(f"CSV appears empty: {csv_path}")

        try:
            title_idx = header.index("Track Name")
            artist_idx = header.index("Artist Name(s)")
        except ValueError:
            raise SystemExit(
                "CSV header did not match expected columns.\n"
                f"Got: {header!r}"
            )

        processed = 0
        for row_idx, row in enumerate(reader):
            if row_idx < args.start_at:
                continue
            if args.max_tracks is not None and processed >= args.max_tracks:
                break

            if len(row) <= max(title_idx, artist_idx):
                continue

            title = (row[title_idx] or "").strip()
            artist = (row[artist_idx] or "").strip()
            if not title or not artist:
                continue

            print(f"\n[{processed + 1}] {artist} - {title}")
            process_one(artist=artist, title=title)
            processed += 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
