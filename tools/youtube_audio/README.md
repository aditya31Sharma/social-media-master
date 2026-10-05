# Local YouTube audio companion

Start from the repo root:

```sh
python3 tools/youtube_audio/server.py --port 8091
```

Open http://localhost:8091/ and choose Reel. All three templates have a YouTube
link field next to their music controls. Import audio loads the converted MP3
straight into the existing music editor. Download MP3 is optional. File uploads
and all trim/volume/fade controls remain available.

The converter uses the machine's existing `yt-dlp` and `ffmpeg` executables.
No Python packages are installed or required. Public individual videos only,
maximum15 minutes and32MB MP3, one conversion at a time,150-second timeout.
Source video audio in Album V2 remains muted. Imported music is its only soundtrack.

Validation accepts only canonical YouTube video IDs. The process uses fixed
arguments, ignores user yt-dlp configuration, strips playlists and never imports
browser cookies. Temporary audio is removed after responding or cancelling.
The local server binds127.0.0.1 and rejects foreign Host/Origin headers.

## Deployment boundary

This remains a LOCAL companion and serves `/api/youtube-audio` on the same origin.
The GitHub Pages site remains static. Its hosted importer uses the authenticated
Node service in Tenzen HQ, not this Python server. Do not expose this development
server through a public tunnel.

The hosted integration is prepared but not deployed. It uses existing HQ operator
sign-in, exact origin checks, short-lived in-memory capability tokens for Pages,
and the same single-job/time/size limits. See the main README for release status.
Aditya authorized the HQ integration; the proposed runtime dependency/Dockerfile
patch still needs its separate required approval. No public API key is needed.

Tests:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tools/youtube_audio -p 'test_*.py' -v
node --test docs/qa/youtube-import.test.mjs
```

A real19-second YouTube sample was converted locally to a331101-byte MP3 and
verified with ffprobe. YouTube availability or extraction requirements can change;
failed imports preserve the current song and show an error.
