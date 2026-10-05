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

This is currently a LOCAL companion, not a public converter. It serves the editor
and `/api/youtube-audio` from the same origin. The GitHub Pages site remains static
and cannot execute this endpoint. Do not publish the UI changes until a production
backend is available. Do not expose this development server using a public tunnel.

To enable public/mobile use, a separately approved backend must run conversion,
enforce operator authentication, keep the single-job/time/size limits, and offer
HTTPS access from the editor. The current relative API URL works when a host
routes the API alongside the editor; a separate origin will need explicit CORS
and authentication wiring. No public API key belongs in the static repository.
Tenzen HQ is separately owned and has not been changed. Its existing Pages proxy
does not implement this API. Live deployment needs Aditya's hosting decision.

Tests:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tools/youtube_audio -p 'test_*.py' -v
node --test docs/qa/youtube-import.test.mjs
```

A real19-second YouTube sample was converted locally to a331101-byte MP3 and
verified with ffprobe. YouTube availability or extraction requirements can change;
failed imports preserve the current song and show an error.
