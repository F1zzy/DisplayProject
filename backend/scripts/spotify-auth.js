/**
 * One-time OAuth consent for Spotify (Now Playing / recently played / top tracks).
 *
 * Prerequisites:
 * 1. Create an app at https://developer.spotify.com/dashboard
 * 2. Add redirect URI: http://localhost:3006/callback
 * 3. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in backend/.env
 *
 * Usage (from backend/):
 *   node scripts/spotify-auth.js
 *
 * Paste the printed SPOTIFY_REFRESH_TOKEN into backend/.env
 */

require('dotenv').config();
const http = require('http');
const { URL } = require('url');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_PORT = Number(process.env.SPOTIFY_OAUTH_REDIRECT_PORT) || 3006;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
  'user-top-read',
].join(' ');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in backend/.env first.');
  process.exit(1);
}

const authUrl =
  `https://accounts.spotify.com/authorize?` +
  new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    show_dialog: 'true',
  }).toString();

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
    if (requestUrl.pathname !== '/callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const error = requestUrl.searchParams.get('error');
    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`OAuth error: ${error}`);
      console.error(`OAuth error: ${error}`);
      server.close();
      process.exit(1);
    }

    const code = requestUrl.searchParams.get('code');
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing authorization code');
      return;
    }

    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokens.error_description || tokens.error || 'Token exchange failed');
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Spotify connected</h1><p>You can close this tab and return to the terminal.</p>');

    console.log('\nAdd this to backend/.env:\n');
    if (tokens.refresh_token) {
      console.log(`SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}`);
    } else {
      console.log(
        'No refresh_token returned. Remove the app from https://www.spotify.com/account/apps/ and run again.'
      );
    }
    console.log('');

    server.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Failed to exchange authorization code');
    server.close();
    process.exit(1);
  }
});

server.listen(REDIRECT_PORT, () => {
  console.log(`Listening for OAuth callback on ${REDIRECT_URI}`);
  console.log('\nAdd this Redirect URI in the Spotify Dashboard, then open:\n');
  console.log(authUrl);
  console.log('');
});
