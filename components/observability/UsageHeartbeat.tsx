"use client";

import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 60_000;

export function UsageHeartbeat() {
  useEffect(() => {
    let stopped = false;

    function sendHeartbeat() {
      if (stopped || document.visibilityState !== "visible") return;
      void fetch("/api/analytics/heartbeat", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        keepalive: true,
      }).catch(() => undefined);
    }

    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    const onVisibilityChange = () => sendHeartbeat();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
