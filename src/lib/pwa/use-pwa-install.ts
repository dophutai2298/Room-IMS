"use client";

import * as React from "react";

import {
  getInstallPlatform,
  isServiceWorkerOriginAllowed,
  isStandaloneDisplay,
  type InstallPlatform,
} from "./install-state";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

const subscribeToHydration = () => () => undefined;
const subscribeToStandaloneDisplay = (onStoreChange: () => void) => {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", onStoreChange);

  return () => displayMode.removeEventListener("change", onStoreChange);
};
const getStandaloneDisplaySnapshot = () =>
  isStandaloneDisplay({
    displayModeStandalone: window.matchMedia("(display-mode: standalone)")
      .matches,
    navigatorStandalone:
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  });

export function usePwaInstall() {
  const hydrated = React.useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const standaloneDisplay = React.useSyncExternalStore(
    subscribeToStandaloneDisplay,
    getStandaloneDisplaySnapshot,
    () => false,
  );
  const [installPrompt, setInstallPrompt] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [instructionsOpen, setInstructionsOpen] = React.useState(false);
  const [wasInstalled, setWasInstalled] = React.useState(false);
  const [isPrompting, setIsPrompting] = React.useState(false);
  const platform: InstallPlatform = hydrated
    ? getInstallPlatform({
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints,
      })
    : "desktop";
  const isInstallEnvironmentSupported =
    hydrated &&
    "serviceWorker" in navigator &&
    isServiceWorkerOriginAllowed({
      protocol: window.location.protocol,
      hostname: window.location.hostname,
    });

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setInstructionsOpen(false);
      setWasInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const requestInstall = async () => {
    if (!installPrompt) {
      setInstructionsOpen(true);
      return;
    }

    setIsPrompting(true);
    setInstallPrompt(null);

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setWasInstalled(true);
      }
    } catch {
      setInstructionsOpen(true);
    } finally {
      setIsPrompting(false);
    }
  };

  return {
    hydrated,
    instructionsOpen,
    isInstallEnvironmentSupported,
    isInstalled: standaloneDisplay || wasInstalled,
    isPrompting,
    platform,
    requestInstall,
    setInstructionsOpen,
  };
}
