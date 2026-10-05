"""Local audio companion. Uses the already-installed yt-dlp and ffmpeg."""
import argparse
import json
import os
from pathlib import Path
import re
import select
import shutil
import signal
import socket
import subprocess
import tempfile
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
LIMIT = 32 * 1024 * 1024
CONVERSION = threading.Lock()


def video_url(value):
    if not isinstance(value, str) or len(value) > 2048:
        raise ValueError('Paste a valid YouTube video link.')
    url = urlsplit(value.strip())
    if url.scheme not in ('https', 'http') or url.username or url.password or url.port:
        raise ValueError('Paste a valid YouTube video link.')
    host = (url.hostname or '').lower()
    parts = url.path.strip('/').split('/')
    if host in ('youtu.be', 'www.youtu.be') and len(parts) == 1:
        identifier = parts[0]
    elif host in ('youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'):
        identifier = parse_qs(url.query).get('v', [''])[0] if url.path == '/watch' else parts[1] if len(parts) == 2 and parts[0] in ('shorts', 'live', 'embed') else ''
    else:
        identifier = ''
    if not re.fullmatch(r'[A-Za-z0-9_-]{11}', identifier):
        raise ValueError('Paste a YouTube video link, not a channel or playlist.')
    return 'https://www.youtube.com/watch?v=' + identifier


def convert(url, disconnected=lambda: False):
    if not shutil.which('yt-dlp') or not shutil.which('ffmpeg'):
        raise RuntimeError('The audio service needs yt-dlp and ffmpeg installed.')
    with tempfile.TemporaryDirectory(prefix='smm-audio-') as folder:
        path = Path(folder)
        command = ['yt-dlp', '--ignore-config', '--no-playlist', '--no-cache-dir', '--no-progress',
                   '--socket-timeout', '10', '--retries', '1', '--max-filesize', '32M',
                   '--match-filters', '!is_live & duration<=900', '-f', 'bestaudio/best',
                   '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0',
                   '--write-info-json', '-o', str(path / 'audio.%(ext)s'), '--', url]
        with (path / 'conversion.log').open('w+') as log:
            process = subprocess.Popen(command, stdout=log, stderr=log, start_new_session=True)
            try:
                deadline = time.monotonic() + 150
                while process.poll() is None:
                    if disconnected():
                        raise ConnectionAbortedError('Import cancelled.')
                    if time.monotonic() > deadline:
                        raise TimeoutError('Conversion timed out. Try a shorter video.')
                    if sum(p.stat().st_size for p in path.iterdir() if p.is_file()) > LIMIT * 3:
                        raise ValueError('This video is too large. Choose a shorter video.')
                    time.sleep(.2)
                output = path / 'audio.mp3'
                if process.returncode or not output.exists():
                    raise ValueError('YouTube could not provide this audio. Use a public video under 15 minutes, or try another link.')
                if output.stat().st_size > LIMIT:
                    raise ValueError('The MP3 exceeds 32 MB. Choose a shorter video.')
                metadata = json.loads((path / 'audio.info.json').read_text())
                title = re.sub(r'[\x00-\x1f/\\:*?"<>|]', '', metadata.get('title', 'YouTube audio'))[:120].strip() or 'YouTube audio'
                return output.read_bytes(), title + '.mp3'
            finally:
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def allowed_host(self):
        return self.headers.get('Host') in self.server.hosts

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def do_GET(self):
        if not self.allowed_host():
            self.send_error(403)
            return
        parts = Path(unquote(urlsplit(self.path).path)).parts
        if any(part.startswith('.') for part in parts):
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        if not self.allowed_host() or any(part.startswith('.') for part in Path(unquote(urlsplit(self.path).path)).parts):
            self.send_error(403)
            return
        super().do_HEAD()

    def error_json(self, status, message):
        data = json.dumps({'error': message}).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def disconnected(self):
        if select.select([self.connection], [], [], 0)[0]:
            return self.connection.recv(1, socket.MSG_PEEK) == b''
        return False

    def do_POST(self):
        if not self.allowed_host() or self.headers.get('Origin') not in self.server.origins:
            self.error_json(403, 'Open the editor on this audio service to import.')
            return
        if urlsplit(self.path).path != '/api/youtube-audio':
            self.error_json(404, 'Unknown endpoint.')
            return
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            self.error_json(415, 'Send a YouTube video link as JSON.')
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 4096:
                raise ValueError('The request is too large or empty.')
            payload = json.loads(self.rfile.read(length))
            url = video_url(payload.get('url') if isinstance(payload, dict) else None)
        except (ValueError, TypeError):
            self.error_json(400, 'Paste a valid YouTube video link.')
            return
        if not CONVERSION.acquire(blocking=False):
            self.error_json(429, 'Another audio import is running. Try again shortly.')
            return
        try:
            audio, name = convert(url, self.disconnected)
            from urllib.parse import quote
            self.send_response(200)
            self.send_header('Content-Type', 'audio/mpeg')
            self.send_header('Content-Disposition', "attachment; filename*=UTF-8''" + quote(name))
            self.send_header('Content-Length', str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
        except (ConnectionAbortedError, BrokenPipeError, ConnectionResetError):
            pass
        except (ValueError, TimeoutError, RuntimeError) as error:
            self.error_json(422, str(error))
        except Exception:
            self.error_json(500, 'Audio conversion failed. Try another link.')
        finally:
            CONVERSION.release()


def make_server(port=8091):
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.hosts = {f'localhost:{server.server_port}', f'127.0.0.1:{server.server_port}'}
    server.origins = {'http://' + host for host in server.hosts}
    return server


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8091)
    args = parser.parse_args()
    server = make_server(args.port)
    print(f'Editor with YouTube import: http://localhost:{server.server_port}/', flush=True)
    server.serve_forever()
