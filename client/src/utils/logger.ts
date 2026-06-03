// src/utils/logger.ts
// Purpose: Basic app error logging hook; replace console transport with Sentry/Crashlytics in production.

import { APP_ENV } from '../config';

export function logError(error: unknown, context?: Record<string, unknown>) {
  const payload = { env: APP_ENV, context, error: error instanceof Error ? error.message : String(error) };
  console.error('[Golf9]', payload);
}
