import assert from 'node:assert/strict';
import { test } from 'node:test';
import { youtubeVideoURL } from '../../lib/youtube-import.js';
const id='jNQXAC9IVRw',canonical=`https://www.youtube.com/watch?v=${id}`;
test('YouTube links normalize to one video without playlist or tracking',()=>{
 for(const url of [`https://youtu.be/${id}?t=3`,`https://youtube.com/watch?v=${id}&list=test`,`https://music.youtube.com/watch?v=${id}`,`https://m.youtube.com/shorts/${id}`,`https://www.youtube.com/embed/${id}`,`https://youtube.com/live/${id}`])assert.equal(youtubeVideoURL(url),canonical);
});
test('Non-YouTube, credentials, playlists and invalid IDs are rejected',()=>{
 for(const url of ['https://evil.example/watch?v='+id,'https://youtube.com.evil.example/watch?v='+id,'https://youtube.com@127.0.0.1/watch?v='+id,'http://127.0.0.1','file:///etc/passwd','https://youtube.com/playlist?list=123','https://youtube.com/watch?v=short','https://youtube.com:8080/watch?v='+id,'not a link'])assert.throws(()=>youtubeVideoURL(url));
});
