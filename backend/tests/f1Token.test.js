const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-token-'));
process.env.F1_TOKEN_PATH = path.join(TMP_DIR, 'f1-token.json');

const f1Token = require('../services/f1Token');

/** Build a JWT-shaped token whose payload expires the given number of hours from now. */
function makeToken(hoursFromNow, extra = {}) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + hoursFromNow * 3600, ...extra })
  ).toString('base64url');
  return `${header}.${payload}.signature`;
}

afterEach(() => {
  fs.rmSync(f1Token.TOKEN_PATH, { force: true });
  delete process.env.F1_LIVE_TOKEN;
});

afterAll(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('f1Token expiry', () => {
  test('reads exp out of the JWT payload', () => {
    const expiresAt = f1Token.getExpiry(makeToken(48));
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(Math.round((expiresAt - Date.now()) / 3600000)).toBe(48);
  });

  test('treats a lapsed token as expired', () => {
    expect(f1Token.isExpired(makeToken(-1))).toBe(true);
    expect(f1Token.isExpired(makeToken(1))).toBe(false);
  });

  test('treats an unreadable token as usable and lets the server reject it', () => {
    expect(f1Token.getExpiry('not-a-jwt')).toBeNull();
    expect(f1Token.isExpired('not-a-jwt')).toBe(false);
  });

  test('describeExpiry flags an already-expired token', () => {
    expect(f1Token.describeExpiry(makeToken(-5))).toContain('ALREADY EXPIRED');
    expect(f1Token.describeExpiry(makeToken(50))).toContain('2d 2h');
  });
});

describe('f1Token storage', () => {
  test('saves and reads back a token', () => {
    const token = makeToken(72);
    const record = f1Token.saveToken(token);

    expect(record.expiresAt).not.toBeNull();
    expect(f1Token.readTokenFile()).toMatchObject({ token });
  });

  test('returns null when nothing is stored', () => {
    expect(f1Token.readTokenFile()).toBeNull();
  });

  test('refuses to store an empty token', () => {
    expect(() => f1Token.saveToken('  ')).toThrow(/empty token/);
  });
});

describe('f1Token.getToken', () => {
  test('falls back to the environment when no token is stored', () => {
    process.env.F1_LIVE_TOKEN = makeToken(10);
    expect(f1Token.getToken()).toBe(process.env.F1_LIVE_TOKEN);
  });

  test('returns an empty string when nothing is configured', () => {
    expect(f1Token.getToken()).toBe('');
  });

  test('prefers the stored token, since that is what a refresh updates', () => {
    const stored = makeToken(72);
    process.env.F1_LIVE_TOKEN = makeToken(10);
    f1Token.saveToken(stored);

    expect(f1Token.getToken()).toBe(stored);
  });

  test('falls back to the environment when the stored token has expired', () => {
    const envToken = makeToken(10);
    process.env.F1_LIVE_TOKEN = envToken;
    f1Token.saveToken(makeToken(-1));

    expect(f1Token.getToken()).toBe(envToken);
  });

  test('keeps an expired stored token when the environment has nothing better', () => {
    const expired = makeToken(-1);
    f1Token.saveToken(expired);

    expect(f1Token.getToken()).toBe(expired);
  });
});
