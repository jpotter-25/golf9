export async function startNativeAppUpdate(_storeUrl: string, _immediate: boolean): Promise<void> {
  globalThis.location.reload();
}
