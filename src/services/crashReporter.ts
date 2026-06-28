import { Config } from '../config';
import { getAuthToken } from './authToken';

export function initCrashReporter() {
  const originalHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    try {
      const token = getAuthToken();
      const body = JSON.stringify({
        message:    error?.message ?? String(error),
        stack:      error?.stack ?? '',
        is_fatal:   isFatal ?? false,
        version:    `${Config.APP_VERSION_NAME} (${Config.APP_VERSION_CODE})`,
        platform:   'android',
        ts:         new Date().toISOString(),
      });
      fetch(`${Config.BASE_URL}/api/crash-report`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
      }).catch(() => {});
    } catch {}

    // Always invoke the original handler so RN's red screen / crash still fires
    originalHandler(error, isFatal);
  });
}
