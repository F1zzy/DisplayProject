/**
 * One-time OAuth consent for Google Calendar (readonly).
 *
 * Prerequisites:
 * 1. Enable Google Calendar API in a Google Cloud project
 * 2. Create an OAuth client (Desktop app)
 * 3. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env
 *
 * Usage (from backend/):
 *   node scripts/google-calendar-auth.js
 *
 * Paste the printed GOOGLE_REFRESH_TOKEN into backend/.env
 */

require('dotenv').config();
const http = require('http');
const { URL } = require('url');
const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_PORT = Number(process.env.GOOGLE_OAUTH_REDIRECT_PORT) || 3005;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env first.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
    if (requestUrl.pathname !== '/oauth2callback') {
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

    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Google Calendar connected</h1><p>You can close this tab and return to the terminal.</p>');

    console.log('\nAdd this to backend/.env:\n');
    if (tokens.refresh_token) {
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    } else {
      console.log(
        'No refresh_token returned. Revoke access at https://myaccount.google.com/permissions and run again with prompt=consent.'
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
  console.log('\nOpen this URL in your browser:\n');
  console.log(authUrl);
  console.log('');
});
