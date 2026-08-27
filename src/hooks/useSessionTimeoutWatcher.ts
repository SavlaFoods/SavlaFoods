import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { hasSessionExpired, recordActivity } from '../utils/sessionTimeout';

const CHECK_INTERVAL_MS = 60 * 1000;

export const useSessionTimeoutWatcher = (onTimeout: () => void) => {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const checkNow = useCallback(async () => {
    if (await hasSessionExpired()) onTimeoutRef.current();
  }, []);

  useEffect(() => {
    recordActivity();
    intervalRef.current = setInterval(checkNow, CHECK_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', async next => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        await checkNow();
      }
      appState.current = next;
    });

    return () => {
      subscription.remove();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkNow]);

  const pingActivity = useCallback(() => recordActivity(), []);
  return { pingActivity };
};
