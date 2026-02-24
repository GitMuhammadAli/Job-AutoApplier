"use client";

import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function ActivityTracker() {
  const sent = useRef(false);

  useEffect(() => {
    const ping = () => {
      fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
    };

    if (!sent.current) {
      ping();
      sent.current = true;
    }

    const id = setInterval(ping, HEARTBEAT_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return null;
}
