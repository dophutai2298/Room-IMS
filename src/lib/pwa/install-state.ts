export type InstallPlatform = "ios" | "android" | "desktop";

export function getInstallPlatform({
  userAgent,
  maxTouchPoints,
}: {
  userAgent: string;
  maxTouchPoints: number;
}): InstallPlatform {
  const isAppleMobileDevice = /iPad|iPhone|iPod/i.test(userAgent);
  const isIPadDesktopMode =
    /Macintosh/i.test(userAgent) && maxTouchPoints > 1;

  if (isAppleMobileDevice || isIPadDesktopMode) {
    return "ios";
  }

  return /Android/i.test(userAgent) ? "android" : "desktop";
}

export function isStandaloneDisplay({
  displayModeStandalone,
  navigatorStandalone,
}: {
  displayModeStandalone: boolean;
  navigatorStandalone: boolean;
}) {
  return displayModeStandalone || navigatorStandalone;
}

export function isServiceWorkerOriginAllowed({
  protocol,
  hostname,
}: {
  protocol: string;
  hostname: string;
}) {
  return (
    protocol === "https:" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}
