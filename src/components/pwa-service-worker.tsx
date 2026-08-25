"use client";

import * as React from "react";

import { isServiceWorkerOriginAllowed } from "@/lib/pwa/install-state";

export function PwaServiceWorker() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (
      !isServiceWorkerOriginAllowed({
        protocol: window.location.protocol,
        hostname: window.location.hostname,
      })
    ) {
      return;
    }

    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })
        .catch((error: unknown) => {
          console.warn("PWA service worker registration failed.", error);
        });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
