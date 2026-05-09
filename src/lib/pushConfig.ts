// Public VAPID key — safe to ship in client bundle.
// Private key lives in Supabase Edge Function secrets (VAPID_PRIVATE_KEY).
export const VAPID_PUBLIC_KEY =
  "BKv-g73e0ou_IoTM9xe2Jlld00MntQD88gmahEQV2H3a_45rXrnWIpa3h2YGB77hnxQniytP9baipmoFH1HRWQs";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function isPreviewOrIframe(): boolean {
  try {
    const inIframe = window.self !== window.top;
    const host = window.location.hostname;
    const isPreview =
      host.includes("id-preview--") ||
      host.includes("lovableproject.com") ||
      host.includes("lovable.dev");
    return inIframe || isPreview;
  } catch {
    return true;
  }
}
