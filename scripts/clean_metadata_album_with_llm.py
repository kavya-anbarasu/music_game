#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any
from urllib import request
from urllib.parse import urlencode

try:
    from tqdm import tqdm
except ImportError:
    tqdm = None


FROM_TITLE_PATTERNS = [
    re.compile(r"\s*[\(\[]\s*from\b[^)\]]*[\)\]]", re.IGNORECASE),
    re.compile(r"\s*-\s*from\b.*$", re.IGNORECASE),
    re.compile(r"\s+from\b\s+\"?.+\"?$", re.IGNORECASE),
]

ENGLISH_FEAT_PATTERNS = [
    re.compile(r"\s*[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s+[^)\]]*[\)\]]", re.IGNORECASE),
    re.compile(r"\s*-\s*(?:feat\.?|ft\.?|featuring)\s+.*$", re.IGNORECASE),
    re.compile(r"\s+(?:feat\.?|ft\.?|featuring)\s+.*$", re.IGNORECASE),
]

WIKI_REF_PAT = re.compile(r"<ref[^>]*>.*?</ref>", re.IGNORECASE | re.DOTALL)
WIKI_SELF_REF_PAT = re.compile(r"<ref[^/>]*/>", re.IGNORECASE)
WIKI_TEMPLATE_PAT = re.compile(r"\{\{[^{}]*\}\}")


def _normalize_title(title: str, *, language: str) -> str:
    title = (title or "").strip()
    if not title:
        return title
    for pat in FROM_TITLE_PATTERNS:
        title = pat.sub("", title)
    if language == "english":
        for pat in ENGLISH_FEAT_PATTERNS:
            title = pat.sub("", title)
    title = re.sub(r"\s+", " ", title).strip()
    title = title.strip(" -")
    return title


def _normalize_artists(artists: Any) -> list[str]:
    parts: list[str] = []
    if artists is None:
        return parts
    if isinstance(artists, str):
        parts = re.split(r"[;,]+", artists)
    elif isinstance(artists, list):
        for entry in artists:
            if entry is None:
                continue
            if isinstance(entry, str) and re.search(r"[;,]", entry):
                parts.extend(re.split(r"[;,]+", entry))
            else:
                parts.append(str(entry))
    else:
        parts = [str(artists)]
    return [p.strip() for p in parts if p and p.strip()]


def _normalize_album(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    lowered = text.lower()
    if lowered in {"single", "standalone single", "single release", "n/a", "none"}:
        return None
    return text


def _input_hash(payload: dict[str, Any]) -> str:
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha1(blob.encode("utf-8")).hexdigest()


def _load_cache(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def _save_cache(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _wiki_api_get(base_url: str, params: dict[str, Any]) -> dict[str, Any]:
    url = f"{base_url.rstrip('/')}/w/api.php?{urlencode(params)}"
    req = request.Request(url, headers={"User-Agent": "music_game_album_cleaner/1.0"})
    with request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _wiki_search_title(title: str, artists: list[str], base_url: str) -> str | None:
    artist = artists[0] if artists else ""
    queries = [
        f"{title} {artist} song",
        f"{title} song",
        f"{title} {artist}",
        title,
    ]
    for query in queries:
        if not query.strip():
            continue
        data = _wiki_api_get(
            base_url,
            {
                "action": "query",
                "list": "search",
                "srsearch": query,
                "format": "json",
            },
        )
        results = data.get("query", {}).get("search", [])
        if results:
            return results[0].get("title")
    return None


def _clean_wiki_text(value: str) -> str:
    text = value or ""
    text = WIKI_REF_PAT.sub("", text)
    text = WIKI_SELF_REF_PAT.sub("", text)
    while True:
        new = WIKI_TEMPLATE_PAT.sub("", text)
        if new == text:
            break
        text = new
    text = re.sub(r"\[\[([^|\]]+)\|([^\]]+)\]\]", r"\2", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = text.replace("'''", "").replace("''", "")
    text = re.sub(r"\s+", " ", text)
    return text.strip(" ,")


def _extract_infobox_field(wikitext: str, field_names: list[str]) -> str | None:
    for field in field_names:
        match = re.search(rf"\|\s*{re.escape(field)}\s*=\s*(.+)", wikitext, re.IGNORECASE)
        if match:
            value = match.group(1).split("\n")[0]
            return _clean_wiki_text(value)
    return None


def _fetch_wikipedia_album(
    title: str,
    artists: list[str],
    base_url: str,
    cache: dict[str, Any],
) -> dict[str, Any] | None:
    key = f"{title.lower().strip()}::{','.join(a.lower() for a in artists)}"
    wiki_cache = cache.setdefault("_wiki_album", {})
    if key in wiki_cache:
        return wiki_cache[key]

    page_title = _wiki_search_title(title, artists, base_url)
    if not page_title:
        wiki_cache[key] = None
        return None

    page_data = _wiki_api_get(
        base_url,
        {
            "action": "query",
            "prop": "revisions",
            "rvprop": "content",
            "rvslots": "main",
            "format": "json",
            "titles": page_title,
        },
    )
    pages = page_data.get("query", {}).get("pages", {})
    page = next(iter(pages.values()), {})
    revisions = page.get("revisions") or []
    wikitext = None
    if revisions:
        wikitext = revisions[0].get("slots", {}).get("main", {}).get("*")

    album = None
    if wikitext:
        album = _extract_infobox_field(
            wikitext,
            ["album", "from album", "album1", "album 1", "album2", "album 2"],
        )

    result = {
        "page_title": page_title,
        "album": album,
    }
    wiki_cache[key] = result
    return result


def _call_openai(
    *,
    api_key: str,
    model: str,
    input_payload: dict[str, Any],
    base_url: str,
) -> dict[str, Any]:
    system = (
        "You update album metadata for songs. Return ONLY a JSON object with a single key: 'album'. "
        "If a Wikipedia album field is provided, use that value. If the song is a single "
        "(not part of a studio album/EP/compilation), return null. If you cannot confirm the album "
        "confidently, return null. Use the official album title when known."
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(input_payload, ensure_ascii=False)},
    ]
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        f"{base_url.rstrip('/')}/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    content = data["choices"][0]["message"]["content"]
    try:
        return json.loads(content)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"LLM response was not valid JSON: {exc}\nRaw: {content}") from exc


def _determine_language(path: Path) -> str:
    lower = path.name.lower()
    if "tamil" in lower:
        return "tamil"
    if "english" in lower:
        return "english"
    return "unknown"


def _build_payload(item: dict[str, Any], *, language: str) -> dict[str, Any]:
    return {
        "language": language,
        "title": item.get("title"),
        "artists": item.get("singers") or item.get("artists"),
        "current_album": item.get("album"),
    }


def _write_output(path: Path, items: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Fix album metadata using an LLM based on song title and artists."
    )
    parser.add_argument("inputs", nargs="+", help="JSON metadata files to process")
    parser.add_argument(
        "--in-place",
        action="store_true",
        help="Overwrite input files instead of writing .album.cleaned.json",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Output directory for cleaned files (ignored with --in-place)",
    )
    parser.add_argument(
        "--model",
        default="gpt-4o-mini",
        help="OpenAI model to use (default: gpt-4o-mini)",
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("OPENAI_BASE_URL", "https://api.openai.com"),
        help="OpenAI base URL (default: https://api.openai.com)",
    )
    parser.add_argument(
        "--api-key-env",
        default="OPENAI_API_KEY",
        help="Env var name containing the OpenAI API key (default: OPENAI_API_KEY)",
    )
    parser.add_argument(
        "--cache",
        default=".llm_cache/clean_metadata_album_cache.json",
        help="Cache file path (default: .llm_cache/clean_metadata_album_cache.json)",
    )
    parser.add_argument(
        "--wiki",
        action="store_true",
        help="Use Wikipedia lookups for album extraction",
    )
    parser.add_argument(
        "--wiki-base-url",
        default="https://en.wikipedia.org",
        help="Wikipedia base URL (default: https://en.wikipedia.org)",
    )
    parser.add_argument(
        "--llm-fallback",
        action="store_true",
        help="Use the LLM if Wikipedia does not provide an album",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Max number of items to process per file",
    )
    parser.add_argument(
        "--start-at",
        type=int,
        default=0,
        help="Start index within each file (0-based)",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.0,
        help="Seconds to sleep between LLM calls (default: 0)",
    )
    args = parser.parse_args(argv)

    cache_path = Path(args.cache)
    cache = _load_cache(cache_path)

    for input_str in args.inputs:
        input_path = Path(input_str)
        items = json.loads(input_path.read_text(encoding="utf-8"))
        if not isinstance(items, list):
            raise SystemExit(f"Expected list in {input_path}")

        language = _determine_language(input_path)
        updated: list[dict[str, Any]] = []
        changed = 0
        processed = 0

        iterator = enumerate(items)
        if tqdm is not None:
            iterator = tqdm(iterator, total=len(items), desc=input_path.name)
        for idx, item in iterator:
            if idx < args.start_at:
                updated.append(item)
                continue
            if args.limit is not None and processed >= args.limit:
                updated.extend(items[idx:])
                break

            cleaned = dict(item)
            cleaned["title"] = _normalize_title(cleaned.get("title") or "", language=language)
            cleaned["singers"] = _normalize_artists(cleaned.get("singers"))

            title = cleaned.get("title")
            artists = cleaned.get("singers")
            if not title or not artists:
                updated.append(cleaned)
                processed += 1
                continue

            wiki_album = None
            wiki_data = None
            if args.wiki:
                try:
                    wiki_data = _fetch_wikipedia_album(title, artists, args.wiki_base_url, cache)
                    if wiki_data:
                        wiki_album = _normalize_album(wiki_data.get("album"))
                except Exception as exc:
                    print(f"Wiki lookup failed for {title!r}: {exc}")

            if wiki_album is not None:
                result_album = wiki_album
            elif args.llm_fallback:
                api_key = os.environ.get(args.api_key_env)
                if not api_key:
                    raise SystemExit(f"Missing API key in env var: {args.api_key_env}")

                payload = _build_payload(cleaned, language=language)
                if wiki_data:
                    payload["wikipedia"] = wiki_data
                key = f"{input_path.name}:{item.get('id', idx)}"
                payload_hash = _input_hash(payload)
                cached = cache.get(key)
                if cached and cached.get("input_hash") == payload_hash:
                    result = cached["result"]
                else:
                    result = _call_openai(
                        api_key=api_key,
                        model=args.model,
                        input_payload=payload,
                        base_url=args.base_url,
                    )
                    cache[key] = {"input_hash": payload_hash, "result": result}
                    if args.sleep:
                        time.sleep(args.sleep)
                result_album = _normalize_album(result.get("album"))
            else:
                result_album = None

            if result_album != cleaned.get("album"):
                cleaned["album"] = result_album
                changed += 1

            updated.append(cleaned)
            processed += 1

        if args.in_place:
            out_path = input_path
        elif args.output_dir:
            out_path = Path(args.output_dir) / input_path.name
        else:
            out_path = input_path.with_suffix(".album.cleaned.json")

        _write_output(out_path, updated)
        print(f"{input_path} -> {out_path} (updated {changed} albums)")

    _save_cache(cache_path, cache)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
