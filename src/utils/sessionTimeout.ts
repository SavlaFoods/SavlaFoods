import {
  getSecureItem,
  setSecureItem,
  removeSecureItem,
} from './secureStorage';

export const SESSION_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours
// export const SESSION_TIMEOUT_MS = 3 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'lastActivityTimestamp';

export const recordActivity = async (): Promise<void> => {
  await setSecureItem(LAST_ACTIVITY_KEY, Date.now().toString());
};

export const getLastActivity = async (): Promise<number | null> => {
  const raw = await getSecureItem(LAST_ACTIVITY_KEY);
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? null : parsed;
};

export const clearActivity = async (): Promise<void> => {
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
  const start = await getLastActivity();
  if (start === null) return true;
  if (Date.now() - start >= SESSION_TIMEOUT_MS) return true;

  // Also respect the server token's own expiry
  const exp = getTokenExpiry(await getSecureItem('userToken'));
  if (exp !== null && Date.now() >= exp - 60_000) return true;

  return false;
};
