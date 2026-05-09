import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  VAPID_PUBLIC_KEY,
  arrayBufferToBase64,
  isPreviewOrIframe,
  urlBase64ToUint8Array,
} from "@/lib/pushConfig";

export type PushStatus =
  | "unsupported"
  | "preview-blocked"
  | "default"
  | "granted-not-subscribed"
  | "subscribed"
  | "denied";

export function usePushNotifications() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>("default");
  const [busy, setBusy] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const refresh = useCallback(async () => {
    if (!supported) return setStatus("unsupported");
    if (isPreviewOrIframe()) return setStatus("preview-blocked");
    if (Notification.permission === "denied") return setStatus("denied");

    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (Notification.permission !== "granted") return setStatus("default");
      setStatus(sub ? "subscribed" : "granted-not-subscribed");
    } catch {
      setStatus("default");
    }
  }, [supported]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!user) return { ok: false, error: "Nejste přihlášeni." };
    if (!supported) return { ok: false, error: "Tento prohlížeč push notifikace nepodporuje." };
    if (isPreviewOrIframe())
      return {
        ok: false,
        error: "Push notifikace nelze povolit v náhledu editoru. Otevřete publikovanou verzi aplikace.",
      };

    setBusy(true);
    try {
      const reg =
        (await navigator.serviceWorker.getRegistration("/sw.js")) ??
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        await refresh();
        return { ok: false, error: "Notifikace nebyly povoleny." };
      }

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const endpoint = json.endpoint ?? sub.endpoint;
      const p256dh = json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh"));
      const auth = json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth"));

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 500),
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "user_id,endpoint" }
      );
      if (error) throw error;

      await refresh();
      return { ok: true };
    } catch (e) {
      console.error("[push] subscribe failed", e);
      return { ok: false, error: e instanceof Error ? e.message : "Neznámá chyba." };
    } finally {
      setBusy(false);
    }
  }, [user, supported, refresh]);

  const unsubscribe = useCallback(async () => {
    if (!user) return { ok: false };
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", endpoint);
      }
      await refresh();
      return { ok: true };
    } catch (e) {
      console.error("[push] unsubscribe failed", e);
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }, [user, refresh]);

  const sendTest = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("send-push", {
      body: { test: true },
    });
    return { data, error };
  }, []);

  return { status, busy, supported, subscribe, unsubscribe, refresh, sendTest };
}
