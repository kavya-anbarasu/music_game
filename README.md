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
