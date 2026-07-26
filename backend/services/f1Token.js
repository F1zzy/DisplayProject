const fs = require('fs');
const path = require('path');

/**
 * Storage for the F1 live timing token.
 *
 * The token is a short-lived JWT (roughly four days), so it has to be replaced
 * regularly. Keeping it in a file rather than only in .env means a refresh —
 * manual or from scripts/f1-auth.js --refresh on a timer — is picked up by the
 * running server the next time it negotiates, with no restart.
 */

const DATA_DIR = path.join(__dirname, '..', 'data');
/** Override with F1_TOKEN_PATH for isolated test runs. */
const TOKEN_PATH = process.env.F1_TOKEN_PATH
  ? path.resolve(process.env.F1_TOKEN_PATH)
  : path.join(DATA_DIR, 'f1-token.json');

/** Treat a token as spent slightly early so we never negotiate with a dead one. */
const EXPIRY_SKEW_MS = 60 * 1000;

function decodeJwtPayload(token) {
  const segments = String(token || '').split('.');
  if (segments.length < 2) return null;

  try {
    const json = Buffer.from(
      segments[1].replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Expiry as epoch milliseconds, or null when the token carries no usable exp. */
function getExpiry(token) {
  const exp = Number(decodeJwtPayload(token)?.exp);
  return Number.isFinite(exp) ? exp * 1000 : null;
}

/** Tokens without a readable exp are treated as usable and left to the server to reject. */
function isExpired(token, now = Date.now()) {
  const expiresAt = getExpiry(token);
  if (expiresAt == null) return false;
  return expiresAt - EXPIRY_SKEW_MS <= now;
}

function readTokenFile() {
  try {
    const raw = fs.readFileSync(TOKEN_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const token = String(parsed?.token || '').trim();
    return token ? { token, updatedAt: parsed.updatedAt || null } : null;
  } catch {
    // Missing or unreadable file simply means "no stored token".
    return null;
  }
}

function saveToken(token) {
  const value = String(token || '').trim();
  if (!value) throw new Error('Refusing to store an empty token');

  fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });

  const expiresAt = getExpiry(value);
  const record = {
    token: value,
    updatedAt: new Date().toISOString(),
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
  };

  const tmpPath = `${TOKEN_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, TOKEN_PATH);

  return record;
}

/**
 * The stored token wins, since it is the one a refresh updates. F1_LIVE_TOKEN
 * is the fallback, and also takes over when the stored token has expired but
 * the environment holds a newer one.
 */
function getToken() {
  const envToken = String(process.env.F1_LIVE_TOKEN || '').trim();
  const stored = readTokenFile();

  if (!stored) return envToken;
  if (isExpired(stored.token) && envToken && !isExpired(envToken)) return envToken;
  return stored.token;
}

/** Human-readable expiry line shared by the CLI and startup logging. */
function describeExpiry(token) {
  const expiresAt = getExpiry(token);
  if (expiresAt == null) return 'Expiry: unknown';

  const iso = new Date(expiresAt).toISOString();
  const hoursLeft = Math.round((expiresAt - Date.now()) / 3600000);

  if (hoursLeft <= 0) return `Expiry: ${iso} (ALREADY EXPIRED)`;

  const days = Math.floor(hoursLeft / 24);
  const hours = hoursLeft % 24;
  const remaining = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  return `Expiry: ${iso} (about ${remaining} from now)`;
}

module.exports = {
  TOKEN_PATH,
  getToken,
  saveToken,
  readTokenFile,
  decodeJwtPayload,
  getExpiry,
  isExpired,
  describeExpiry,
};
