import { GOOGLE_CLIENT_ID } from './drive-config.js';
import { createDriveApi } from './drive-api.js';

export async function connectDrive() {
  if (!GOOGLE_CLIENT_ID) throw new Error('Google Drive setup is incomplete.');
  if (!window.google?.accounts?.oauth2) throw new Error('Google sign-in is still loading. Try again.');
  const token = await new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      login_hint: 'team@tenzen.in',
      callback: response => response.error ? reject(new Error(response.error)) : resolve(response.access_token),
      error_callback: () => reject(new Error('Google sign-in did not complete.')),
    });
    client.requestAccessToken();
  });
  const drive = createDriveApi(token);
  await drive.account();
  return drive;
}
