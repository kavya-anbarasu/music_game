# music_game

## YouTube audio preview helper

Downloads up to the first 30 seconds of audio for the top YouTube search result.

Requirements:
- `yt-dlp`
- `ffmpeg`

Install (macOS/Homebrew):
- `brew install yt-dlp ffmpeg`

Example:
- `python3 scripts/youtube_audio_preview.py "Daft Punk" "One More Time" --seconds 30 --out-dir audio_files`

Dry run (just print chosen URL):
- `python3 scripts/youtube_audio_preview.py "Daft Punk" "One More Time" --dry-run`

CSV mode (defaults to `spotify_song_lists/2010's_to_present.csv`):
- `python3 scripts/youtube_audio_preview.py --max-tracks 5 --out-dir audio_files`

Re-runs:
- By default it skips tracks whose output file already exists; use `--overwrite` to force re-download.

## Audio clips + metadata (English)

Cut each 30s preview into multiple clip lengths (writes to `audio_files/english/clips/`):
- `python3 scripts/cut_audio_clips.py --language english`

Build metadata JSON (includes key name mapping from Spotify `Key` + `Mode`):
- `python3 scripts/build_english_metadata.py --out metadata/en.json --public-audio-prefix /audio`
