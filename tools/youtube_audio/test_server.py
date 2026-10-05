import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch, Mock

spec = importlib.util.spec_from_file_location('audio_server', Path(__file__).with_name('server.py'))
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

class AudioServiceTests(unittest.TestCase):
    def test_video_only(self):
        expected = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
        for value in ['https://youtu.be/jNQXAC9IVRw?t=1', expected + '&list=123', 'https://music.youtube.com/watch?v=jNQXAC9IVRw', 'https://youtube.com/shorts/jNQXAC9IVRw']:
            self.assertEqual(server.video_url(value), expected)

    def test_rejects_nonvideo_and_network_targets(self):
        for value in [None, {}, 'file:///etc/passwd', 'http://127.0.0.1', 'https://youtube.com.evil.test/watch?v=jNQXAC9IVRw', 'https://youtube.com@127.0.0.1/watch?v=jNQXAC9IVRw', 'https://youtube.com:8091/watch?v=jNQXAC9IVRw', 'https://youtube.com/playlist?list=123', 'https://youtube.com/watch?v=x', 'x' * 3000]:
            with self.assertRaises(ValueError):
                server.video_url(value)

    def test_missing_tools_is_explicit(self):
        with patch.object(server.shutil, 'which', return_value=None):
            with self.assertRaisesRegex(RuntimeError, 'yt-dlp and ffmpeg'):
                server.convert('https://www.youtube.com/watch?v=jNQXAC9IVRw')

    def test_cancel_terminates_conversion(self):
        process = Mock(pid=123)
        process.poll.return_value = None
        with patch.object(server.shutil, 'which', return_value='/usr/bin/tool'), patch.object(server.subprocess, 'Popen', return_value=process), patch.object(server.os, 'killpg') as kill:
            with self.assertRaises(ConnectionAbortedError):
                server.convert('https://www.youtube.com/watch?v=jNQXAC9IVRw', lambda: True)
            kill.assert_called_once_with(123, server.signal.SIGTERM)
            process.wait.assert_called_once_with(timeout=3)

    def test_listener_is_loopback_only(self):
        instance = server.make_server(0)
        try:
            self.assertEqual(instance.server_address[0], '127.0.0.1')
            self.assertEqual(instance.origins, {'http://' + host for host in instance.hosts})
        finally:
            instance.server_close()

if __name__ == '__main__':
    unittest.main()
