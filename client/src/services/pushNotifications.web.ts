// Browser push subscriptions are separate from APNs/FCM and are not enabled yet.
export async function registerPushNotifications(_authToken: string) {
  return { status: 'unsupported' as const };
}

export async function unregisterPushNotifications(_authToken: string) {
  return { status: 'unsupported' as const };
}
