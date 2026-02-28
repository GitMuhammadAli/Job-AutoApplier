"use client";

import { useState, useEffect, useCallback } from "react";

type PushState = "unsupported" | "loading" | "denied" | "subscribed" | "unsubscribed" | "error";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    const check = async () => {
      try {
        const permission = Notification.permission;
        if (permission === "denied") {
          setState("denied");
          return;
        }

        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        if (!registration) {
          setState("unsubscribed");
          return;
        }

        const subscription = await registration.pushManager.getSubscription();
        setState(subscription ? "subscribed" : "unsubscribed");
      } catch {
        setState("error");
      }
    };

    check();
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (state === "unsupported" || state === "denied") return false;
    setLoading(true);

    try {
      const keyRes = await fetch("/api/push/vapid-key");
      if (!keyRes.ok) {
        setState("error");
        return false;
      }
      const { publicKey } = await keyRes.json();

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return false;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (res.ok) {
        setState("subscribed");
        return true;
      }
      setState("error");
      return false;
    } catch (err) {
      console.error("[Push] Subscribe failed:", err);
      setState("error");
      return false;
    } finally {
      setLoading(false);
    }
  }, [state]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
          await subscription.unsubscribe();
        }
      }
      setState("unsubscribed");
      return true;
    } catch (err) {
      console.error("[Push] Unsubscribe failed:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    state,
    isSubscribed: state === "subscribed",
    isSupported: state !== "unsupported",
    isDenied: state === "denied",
    loading,
    subscribe,
    unsubscribe,
    toggle: state === "subscribed" ? unsubscribe : subscribe,
  };
}
