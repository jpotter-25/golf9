export function isSocialAuthCancelled(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error
    && error.code === 'ERR_REQUEST_CANCELED';
}

// Native Apple errors don't identify whether account setup, device state or
// Apple's service failed. Offer checks, not a diagnosis, and never echo arbitrary
// SDK messages/userInfo (which may contain account or credential information).
export function appleAuthorizationError(error: unknown): Error {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  let message: string;
  switch (code) {
    case 'ERR_REQUEST_CANCELED':
      return Object.assign(new Error('Apple sign-in was cancelled.'), { code });
    case 'ERR_REQUEST_UNKNOWN':
      message = 'Apple could not finish sign-in. Open Settings > your name > iCloud and complete any "Set Up" steps, even if your Apple Account already appears signed in. Also check two-factor authentication under Sign-In & Security. Return to Nine Below and try again.\n\nAlready set up? Restart the device. If it still fails, contact support with code ERR_REQUEST_UNKNOWN.';
      break;
    case 'ERR_REQUEST_NOT_INTERACTIVE':
      message = 'Return to Nine Below and tap Continue with Apple again while the app is open.';
      break;
    case 'ERR_INVALID_RESPONSE':
      message = 'Apple returned an incomplete sign-in response. Please try again. If this continues, contact support.';
      break;
    default:
      message = 'Apple could not complete authorization. Please try again. If this continues, check for pending Apple Account setup in Settings and contact support with your Nine Below build and iOS version.';
  }
  return new Error(message);
}
