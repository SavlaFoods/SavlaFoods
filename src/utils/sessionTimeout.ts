import {
  getSecureItem,
  setSecureItem,
  removeSecureItem,
} from './secureStorage';

export const SESSION_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours
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

export const hasSessionExpired = async (): Promise<boolean> => {
  const lastActivity = await getLastActivity();
  if (lastActivity === null) {
    await recordActivity();
    return false;
  }
  return Date.now() - lastActivity >= SESSION_TIMEOUT_MS;
};
