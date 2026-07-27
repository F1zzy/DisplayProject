/**
 * One-time OAuth consent for Spotify (Now Playing / recently played / top tracks).
 *
 * Prerequisites:
 * 1. Create an app at https://developer.spotify.com/dashboard
 * 2. Add redirect URI: http://127.0.0.1:3006/callback
 *    (Spotify no longer allows "localhost"; loopback HTTP is required for local auth)
 * 3. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in backend/.env
 *
 * Usage (from backend/):
 *   node scripts/spotify-auth.js
 *
 * Paste the printed SPOTIFY_REFRESH_TOKEN into backend/.env
 */

require('dotenv').config();
const crypto = require('crypto');
const http = require('http');
const { URL } = require('url');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_PORT = Number(process.env.SPOTIFY_OAUTH_REDIRECT_PORT) || 3006;
const REDIRECT_HOST = '127.0.0.1';
const REDIRECT_URI = `http://${REDIRECT_HOST}:${REDIRECT_PORT}/callback`;
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

function base64Url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

const state = base64Url(crypto.randomBytes(16));
const codeVerifier = base64Url(crypto.randomBytes(32));
const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest());

const authUrl =
  `https://accounts.spotify.com/authorize?` +
  new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    show_dialog: 'true',
  }).toString();

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${REDIRECT_HOST}:${REDIRECT_PORT}`);
    if (requestUrl.pathname !== '/callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const error = requestUrl.searchParams.get('error');
    if (error) {
      const description = requestUrl.searchParams.get('error_description') || '';
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`OAuth error: ${error}${description ? ` — ${description}` : ''}`);
      console.error(`OAuth error: ${error}${description ? ` — ${description}` : ''}`);
      console.error(
        '\nChecklist:\n' +
          `  1. Redirect URI in Dashboard is exactly: ${REDIRECT_URI}\n` +
          '  2. Dashboard → User Management: add your Spotify account (Development mode)\n' +
          '  3. Client ID/secret in backend/.env match this app\n' +
          '  4. Try again in an Incognito window after re-running this script\n'
      );
      server.close();
      process.exit(1);
    }

    const code = requestUrl.searchParams.get('code');
    const returnedState = requestUrl.searchParams.get('state');
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing authorization code');
      return;
    }
    if (returnedState !== state) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid OAuth state');
      console.error('OAuth state mismatch — restart the script and use the new URL.');
      server.close();
      process.exit(1);
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
        code_verifier: codeVerifier,
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

server.listen(REDIRECT_PORT, REDIRECT_HOST, () => {
  console.log(`Listening for OAuth callback on ${REDIRECT_URI}`);
  console.log('\nIn the Spotify Dashboard → Settings → Redirect URIs, add exactly:');
  console.log(`  ${REDIRECT_URI}`);
  console.log('\nThen open this URL:\n');
  console.log(authUrl);
  console.log('');
});
