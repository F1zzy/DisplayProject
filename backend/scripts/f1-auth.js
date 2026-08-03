/**
 * Obtain and refresh the F1 live timing token.
 *
 * F1's sign-in is anti-bot protected, so there is no headless username/password
 * flow. What does work is signing in once in a real browser and keeping that
 * browser profile: F1 keeps the session alive far longer than the ~4 day token
 * inside it, so re-opening the site with the same profile mints a fresh token.
 *
 * Usage (from backend/):
 *   node scripts/f1-auth.js --login     Sign in once in a visible browser
 *   node scripts/f1-auth.js --refresh   Renew the token using the saved profile
 *   node scripts/f1-auth.js --status    Show the stored token's expiry
 *   node scripts/f1-auth.js             Paste a login-session cookie by hand
 *
 * The token is written to backend/data/f1-token.json and picked up by a running
 * server on its next connection attempt — no restart needed.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const f1Token = require('../services/f1Token');

const HOME_URL = 'https://www.formula1.com/';
const LOGIN_URL = 'https://account.formula1.com/#/en/login';
const COOKIE_NAME = 'login-session';

const PROFILE_PATH = process.env.F1_PROFILE_PATH
  ? path.resolve(process.env.F1_PROFILE_PATH)
  : path.join(__dirname, '..', 'data', 'f1-profile');

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const REFRESH_TIMEOUT_MS = 90 * 1000;
const POLL_MS = 2000;

/** Cookie values are URL-encoded, sometimes twice. */
function decodeCookieValue(raw) {
  let value = String(raw || '').trim();

  // Tolerate a pasted "login-session=..." pair or surrounding quotes.
  if (value.startsWith(`${COOKIE_NAME}=`)) {
    value = value.slice(COOKIE_NAME.length + 1);
  }
  value = value.replace(/^["']|["']$/g, '');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (value.startsWith('{')) return value;
    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) break;
      value = decoded;
    } catch {
      break;
    }
  }

  return value;
}

function extractToken(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return null;

  // Allow pasting a bare JWT as well as the cookie.
  if (/^eyJ[\w-]*\.[\w-]+\.[\w-]+$/.test(trimmed)) return trimmed;

  let parsed;
  try {
    parsed = JSON.parse(decodeCookieValue(trimmed));
  } catch {
    return null;
  }

  return parsed?.data?.subscriptionToken || parsed?.subscriptionToken || null;
}

function reportToken(token) {
  const payload = f1Token.decodeJwtPayload(token);
  console.log(f1Token.describeExpiry(token));
  if (payload?.SubscriptionStatus) {
    console.log(`Subscription status: ${payload.SubscriptionStatus}`);
  }
}

function storeToken(token) {
  f1Token.saveToken(token);
  console.log(`\nSaved token to ${f1Token.TOKEN_PATH}`);
  reportToken(token);
}

/**
 * Playwright is a devDependency and is absent from production installs, so it
 * is only required by the browser-driven commands.
 */
function loadChromium() {
  for (const id of ['playwright', 'playwright-core', '@playwright/test']) {
    try {
      return require(id).chromium;
    } catch {
      // Try the next packaging.
    }
  }

  console.error('Playwright is required for --login and --refresh but is not installed.');
  console.error('Install it with:  npm install --no-save playwright');
  console.error('On a Raspberry Pi, use the system browser instead:');
  console.error('  npm install --no-save playwright-core');
  console.error('  F1_BROWSER_PATH=/usr/bin/chromium node scripts/f1-auth.js --refresh');
  process.exit(1);
}

async function launchBrowser({ headless }) {
  const chromium = loadChromium();
  fs.mkdirSync(PROFILE_PATH, { recursive: true });

  return chromium.launchPersistentContext(PROFILE_PATH, {
    headless,
    executablePath: process.env.F1_BROWSER_PATH || undefined,
    viewport: null,
    // F1 fingerprints for automation; this hides the most obvious marker.
    args: ['--disable-blink-features=AutomationControlled'],
  });
}

async function readSessionToken(context) {
  const cookies = await context.cookies();
  const cookie = cookies.find((entry) => entry.name === COOKIE_NAME);
  return cookie ? extractToken(cookie.value) : null;
}

/** Poll rather than wait on a response, since the cookie is set by client-side JS. */
async function waitForSessionToken(context, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const token = await readSessionToken(context);
    if (token) return token;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

async function login() {
  console.log('Opening a browser window. Sign in to your F1 account there.');
  console.log('A free account is enough — F1 TV is only needed for telemetry streams.\n');

  const context = await launchBrowser({ headless: false });

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(LOGIN_URL);

    console.log(`Waiting up to ${LOGIN_TIMEOUT_MS / 60000} minutes for sign-in...`);
    const token = await waitForSessionToken(context, LOGIN_TIMEOUT_MS);

    if (!token) {
      console.error('\nNo login-session cookie appeared. Was the sign-in completed?');
      return 1;
    }

    storeToken(token);
    console.log(`\nBrowser profile saved to ${PROFILE_PATH}`);
    console.log('Renew the token from now on with:  node scripts/f1-auth.js --refresh');
    return 0;
  } finally {
    await context.close();
  }
}

async function refresh({ headed }) {
  if (!fs.existsSync(PROFILE_PATH)) {
    console.error(`No saved browser profile at ${PROFILE_PATH}.`);
    console.error('Run "node scripts/f1-auth.js --login" once first.');
    return 1;
  }

  const context = await launchBrowser({ headless: !headed });

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });

    const token = await waitForSessionToken(context, REFRESH_TIMEOUT_MS);

    if (!token) {
      console.error('No login-session cookie found. The saved session has probably lapsed.');
      console.error('Run "node scripts/f1-auth.js --login" to sign in again.');
      return 1;
    }

    if (f1Token.isExpired(token)) {
      console.error('The session returned an already-expired token.');
      console.error('Run "node scripts/f1-auth.js --login" to sign in again.');
      return 1;
    }

    storeToken(token);
    return 0;
  } finally {
    await context.close();
  }
}

function status() {
  const stored = f1Token.readTokenFile();

  if (!stored) {
    console.log(`No token stored at ${f1Token.TOKEN_PATH}.`);
    const envToken = String(process.env.F1_LIVE_TOKEN || '').trim();
    if (envToken) {
      console.log('Falling back to F1_LIVE_TOKEN from the environment.');
      reportToken(envToken);
    }
    return 0;
  }

  console.log(`Token stored at ${f1Token.TOKEN_PATH}`);
  console.log(`Last updated: ${stored.updatedAt || 'unknown'}`);
  reportToken(stored.token);
  return f1Token.isExpired(stored.token) ? 1 : 0;
}

function paste() {
  console.log('Sign in at https://www.formula1.com, then open:');
  console.log('  DevTools > Application > Cookies > https://www.formula1.com');
  console.log(`and copy the value of the "${COOKIE_NAME}" cookie.\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question(`Paste the ${COOKIE_NAME} cookie value here:\n`, (answer) => {
      rl.close();

      const token = extractToken(answer);
      if (!token) {
        console.error('\nCould not find a token in that value.');
        console.error('Expected the URL-encoded JSON cookie containing data.subscriptionToken,');
        console.error('or a bare JWT starting with "eyJ".');
        resolve(1);
        return;
      }

      storeToken(token);
      console.log('\nTip: "--login" then "--refresh" automates this from a saved browser profile.');
      resolve(0);
    });
  });
}

function usage() {
  console.log('Usage (from backend/):');
  console.log('  node scripts/f1-auth.js --login     Sign in once in a visible browser');
  console.log('  node scripts/f1-auth.js --refresh   Renew the token from the saved profile');
  console.log('  node scripts/f1-auth.js --status    Show the stored token expiry');
  console.log('  node scripts/f1-auth.js             Paste a login-session cookie by hand');
  console.log('');
  console.log('Options:');
  console.log('  --headed   Show the browser during --refresh (for debugging)');
  return 0;
}

async function main() {
  const args = process.argv.slice(2);
  const headed = args.includes('--headed');

  if (args.includes('--help') || args.includes('-h')) return usage();
  if (args.includes('--login')) return login();
  if (args.includes('--refresh')) return refresh({ headed });
  if (args.includes('--status')) return status();
  return paste();
}

main()
  .then((code) => process.exit(code || 0))
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
