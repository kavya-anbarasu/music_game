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


def _split_people(value: str) -> list[str]:
    value = (value or "").strip()
    if not value:
        return []
    return [p.strip() for p in re.split(r"[;,|/]+", value) if p.strip()]


def _parse_artists_field(artists: str) -> list[str]:
    artists = (artists or "").strip()
    if not artists:
        return []
    parts = [p.strip() for p in artists.split(";") if p.strip()]
    return parts if parts else [artists]


_QUOTE_CHARS = "\"'“”"
_FROM_PATTERNS = [
    re.compile(rf"\(From\s+([{_QUOTE_CHARS}])(?P<movie>.+?)\1\)", re.IGNORECASE),
    re.compile(rf"\(From\s+(?P<movie>[^)]+)\)", re.IGNORECASE),
]

_SOUNDTRACK_STRIP_PATTERNS = [
    re.compile(r"\s*\(Original Motion Picture Soundtrack\)\s*", re.IGNORECASE),
    re.compile(r"\s*\(Original Motion Picture Soundtrack\)\s*-\s*Tamil\s*$", re.IGNORECASE),
    re.compile(r"\s*-\s*Original Motion Picture Soundtrack\s*$", re.IGNORECASE),
]

_COMPILATION_HINTS = [
    "hits",
    "best of",
    "mix",
    "playback",
    "love",
    "melodies",
    "vol.",
    "volume",
    "level",
    "chill",
    "mass",
    "singer special",
    "trending",
    "radio",
    "top",
    "dance",
]


def _normalize_title(value: str) -> str:
    value = (value or "").strip()
    value = re.sub(r"\s+", " ", value)
    return value


def _extract_movie_from_text(text: str) -> str | None:
    text = (text or "").strip()
    if not text:
        return None
    for pat in _FROM_PATTERNS:
        m = pat.search(text)
        if m:
            movie = _normalize_title(m.group("movie"))
            return movie if movie else None
    return None


def _is_compilation_album(album: str) -> bool:
    album_l = (album or "").lower()
    return any(hint in album_l for hint in _COMPILATION_HINTS)


def _clean_album_to_movie(album: str) -> str | None:
    album = _normalize_title(album)
    if not album:
        return None
    if _is_compilation_album(album):
        return None
    for pat in _SOUNDTRACK_STRIP_PATTERNS:
        album = pat.sub(" ", album)
    album = _normalize_title(album)
    return album or None


def _format_key(key_raw: str, mode_raw: str) -> str | None:
    try:
        key_num = int(float((key_raw or "").strip()))
    except ValueError:
        return None
    if key_num == -1 or key_num < 0 or key_num >= len(KEY_NAMES):
        return None

    name = KEY_NAMES[key_num]
    mode = None
    try:
        mode_num = int(float((mode_raw or "").strip()))
        mode = "major" if mode_num == 1 else "minor" if mode_num == 0 else None
    except ValueError:
        mode = None

    return f"{name} {mode}" if mode else name


_KNOWN_MUSIC_DIRECTORS = {
    "a r rahman": "A. R. Rahman",
    "ar rahman": "A. R. Rahman",
    "a.r. rahman": "A. R. Rahman",
    "ilaiyaraaja": "Ilaiyaraaja",
    "ilayaraja": "Ilaiyaraaja",
    "harris jayaraj": "Harris Jayaraj",
    "yuvan shankar raja": "Yuvan Shankar Raja",
    "anirudh ravichander": "Anirudh Ravichander",
    "anirudh": "Anirudh Ravichander",
    "g v prakash": "G. V. Prakash",
    "g. v. prakash": "G. V. Prakash",
    "g v prakash kumar": "G. V. Prakash",
    "d imman": "D. Imman",
    "d. imman": "D. Imman",
    "santhosh narayanan": "Santhosh Narayanan",
    "vijay antony": "Vijay Antony",
    "ghibran": "Ghibran",
    "hiphop tamizha": "Hiphop Tamizha",
    "sam c s": "Sam C.S.",
    "sam c.s.": "Sam C.S.",
    "govind vasantha": "Govind Vasantha",
    "justin prabhakaran": "Justin Prabhakaran",
    "darbuka siva": "Darbuka Siva",
}

_KNOWN_LYRICISTS = {
    "vairamuthu",
    "thamarai",
    "na. muthukumar",
    "na.muthukumar",
    "madhan karky",
    "madhan karki",
    "vivek",
    "gangai amaran",
    "uma devi",
    "vaali",
    "pa. vijay",
    "karky",
}


def _canon_person(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"\s+", " ", value)
    value = value.replace(".", "").replace("_", " ")
    return value.strip()


def _guess_music_director(artists_list: list[str]) -> str | None:
    for a in artists_list:
        canon = _canon_person(a)
        if canon in _KNOWN_MUSIC_DIRECTORS:
            return _KNOWN_MUSIC_DIRECTORS[canon]
    return None


def _guess_singers(artists_list: list[str], music_director: str | None) -> list[str]:
    lyricists_canon = {_canon_person(x) for x in _KNOWN_LYRICISTS}
    md_canon = _canon_person(music_director) if music_director else None

    keep = []
    for a in artists_list:
        canon = _canon_person(a)
        if canon in lyricists_canon:
            continue
        keep.append(a.strip())

    if not keep:
        return []

    if md_canon:
        others = [a for a in keep if _canon_person(a) != md_canon]
        return others if others else keep

    return keep


def _join_url(prefix: str, *parts: str) -> str:
    prefix = prefix.rstrip("/")
    clean = [p.strip("/").replace("\\", "/") for p in parts if p]
    return "/".join([prefix, *clean])


def _load_overrides(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    overrides: dict[str, dict[str, str]] = {}
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            track_uri = (row.get("track_uri") or row.get("Track URI") or "").strip()
            if not track_uri:
                continue
            overrides[track_uri] = {k: (v or "").strip() for k, v in row.items() if k}
    return overrides


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Build Tamil song metadata JSON using Spotify CSV + heuristics + manual overrides."
    )
    parser.add_argument(
        "--csv",
        default="spotify_song_lists/tamil_set.csv",
        help="Spotify-export CSV (default: spotify_song_lists/tamil_set.csv)",
    )
    parser.add_argument(
        "--audio-root",
        default="audio_files",
        help="Root folder containing language subfolders (default: audio_files)",
    )
    parser.add_argument(
        "--language",
        default="tamil",
        help="Language subfolder under audio root (default: tamil)",
    )
    parser.add_argument(
        "--out",
        default="metadata/ta.json",
        help="Output JSON path (default: metadata/ta.json)",
    )
    parser.add_argument(
        "--overrides",
        default="metadata/tamil_overrides.csv",
        help="Overrides CSV path (default: metadata/tamil_overrides.csv)",
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

    overrides_path = Path(args.overrides)
    overrides = _load_overrides(overrides_path)

    items: list[dict] = []
    used_ids: set[str] = set()

    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            track_uri = (row.get("Track URI") or "").strip()
            title = _normalize_title(row.get("Track Name", ""))
            album = _normalize_title(row.get("Album Name", ""))
            artists_raw = (row.get("Artist Name(s)") or "").strip()
            if not track_uri or not title or not artists_raw:
                continue

            track_id = _parse_track_id(track_uri)
            artists_list = _parse_artists_field(artists_raw)
            base = _safe_filename(f"{artists_raw} - {title}")

            movie = _extract_movie_from_text(title) or _extract_movie_from_text(album) or _clean_album_to_movie(album)
            base_id = _slugify(title)
            unique_id = base_id
            if unique_id in used_ids:
                suffix = track_id[:8] if track_id else _slugify(movie or album) or "dup"
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

            music_director = _guess_music_director(artists_list)
            singers = _guess_singers(artists_list, music_director)

            key_name = _format_key(row.get("Key", ""), row.get("Mode", ""))

            item = {
                "id": unique_id,
                "title": title,
                "movie": movie,
                "album": album if not movie else None,
                "music_director": music_director,
                "singers": singers,
                "hero": None,
                "heroine": None,
                "key": key_name,
                "audio": audio,
                "track_uri": track_uri,
            }

            ov = overrides.get(track_uri)
            if ov:
                if (ov.get("skip") or "").lower() in {"1", "true", "yes", "y"}:
                    continue
                if ov.get("id"):
                    item["id"] = ov["id"]
                if ov.get("title"):
                    item["title"] = ov["title"]
                if ov.get("movie"):
                    item["movie"] = ov["movie"]
                if ov.get("album"):
                    item["album"] = ov["album"]
                if ov.get("music_director"):
                    item["music_director"] = ov["music_director"]
                if ov.get("singers"):
                    item["singers"] = _split_people(ov["singers"])
                if ov.get("hero"):
                    item["hero"] = ov["hero"]
                if ov.get("heroine"):
                    item["heroine"] = ov["heroine"]

            used_ids.add(item["id"])
            items.append(item)

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Wrote {len(items)} songs to {out_path}")
    if overrides_path.exists():
        print(f"Overrides: {overrides_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
