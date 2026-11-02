import {
  getSecureItem,
  setSecureItem,
  removeSecureItem,
} from './secureStorage';

export const SESSION_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours
const LAST_ACTIVITY_KEY = 'lastActivityTimestamp';
const PERSIST_THROTTLE_MS = 15 * 1000;

// In-memory source of truth; the keychain is only a backup for cold starts
let lastActivityMemory: number | null = null;
let lastPersistedAt = 0;

export const recordActivity = async (): Promise<void> => {
  const now = Date.now();
  lastActivityMemory = now; // always update memory

  // don't hit the keychain on every touch
  if (now - lastPersistedAt < PERSIST_THROTTLE_MS) return;
  lastPersistedAt = now;
  await setSecureItem(LAST_ACTIVITY_KEY, now.toString()); // best-effort, never throws
};

export const getLastActivity = async (): Promise<number | null> => {
  if (lastActivityMemory !== null) return lastActivityMemory;
  const raw = await getSecureItem(LAST_ACTIVITY_KEY);
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? null : parsed;
};

export const clearActivity = async (): Promise<void> => {
  lastActivityMemory = null;
  lastPersistedAt = 0;
  await removeSecureItem(LAST_ACTIVITY_KEY);
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const decodeBase64 = (str: string) => {
  let out = '';
  let bits = 0;
  let buf = 0;
  for (const ch of str.replace(/=+$/, '')) {
    const v = B64.indexOf(ch);
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buf >> bits) & 0xff);
    }
  }
  return out;
};

// Returns the token's expiry in ms, or null if the token is not a JWT
export const getTokenExpiry = (token: string | null): number | null => {
  try {
    const part = token?.split('.')[1];
    if (!part) return null;
    const payload = JSON.parse(
      decodeBase64(part.replace(/-/g, '+').replace(/_/g, '/')),
    );
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};
export const hasSessionExpired = async (): Promise<boolean> => {
  let start = await getLastActivity();

  if (start === null) {
    // Nothing stored (or keychain unavailable): treat as active, not expired.
    // Seed memory so the 3-hour window starts now.
    start = Date.now();
    lastActivityMemory = start;
  }

  if (Date.now() - start >= SESSION_TIMEOUT_MS) return true;

  // Also respect the server token's own expiry
  const exp = getTokenExpiry(await getSecureItem('userToken'));
  if (exp !== null && Date.now() >= exp - 60_000) return true;

  return false;
};
