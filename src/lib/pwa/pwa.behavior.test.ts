import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

import manifest from "@/app/manifest";
import {
  getInstallPlatform,
  isServiceWorkerOriginAllowed,
  isStandaloneDisplay,
} from "./install-state";

test("PWA manifest exposes the installable Vietnamese mobile app shell", () => {
  const manifestMetadata = manifest();

  assert.equal(manifestMetadata.name, "Rental Room 201 - Quản lý phòng trọ");
  assert.equal(manifestMetadata.short_name, "Rental Room");
  assert.equal(manifestMetadata.lang, "vi");
  assert.equal(manifestMetadata.id, "/");
  assert.equal(manifestMetadata.start_url, "/");
  assert.equal(manifestMetadata.scope, "/");
  assert.equal(manifestMetadata.display, "standalone");
  assert.equal(manifestMetadata.background_color, "#237b5c");
  assert.equal(manifestMetadata.theme_color, "#237b5c");
  assert.deepEqual(manifestMetadata.icons, [
    {
      src: "/icons/pwa-192x192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/pwa-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/pwa-maskable-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ]);
});

test("PWA install guidance distinguishes iOS from browsers with a native prompt", () => {
  assert.equal(
    getInstallPlatform({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      maxTouchPoints: 5,
    }),
    "ios",
  );
  assert.equal(
    getInstallPlatform({
      userAgent:
        "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile",
      maxTouchPoints: 5,
    }),
    "android",
  );
  assert.equal(
    getInstallPlatform({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      maxTouchPoints: 0,
    }),
    "desktop",
  );
});

test("PWA install affordance recognizes browser and iOS standalone modes", () => {
  assert.equal(
    isStandaloneDisplay({
      displayModeStandalone: true,
      navigatorStandalone: false,
    }),
    true,
  );
  assert.equal(
    isStandaloneDisplay({
      displayModeStandalone: false,
      navigatorStandalone: true,
    }),
    true,
  );
  assert.equal(
    isStandaloneDisplay({
      displayModeStandalone: false,
      navigatorStandalone: false,
    }),
    false,
  );
});

test("service worker registration is limited to secure origins and localhost", () => {
  assert.equal(
    isServiceWorkerOriginAllowed({
      protocol: "https:",
      hostname: "rental.example.com",
    }),
    true,
  );
  assert.equal(
    isServiceWorkerOriginAllowed({
      protocol: "http:",
      hostname: "localhost",
    }),
    true,
  );
  assert.equal(
    isServiceWorkerOriginAllowed({
      protocol: "http:",
      hostname: "192.168.1.10",
    }),
    false,
  );
});

test("service worker caches only public PWA assets and ignores authenticated requests", async () => {
  type WorkerEventHandler = (event: Record<string, unknown>) => void;

  const handlers = new Map<string, WorkerEventHandler>();
  let cachedPaths: string[] = [];
  let installPromise: Promise<unknown> | undefined;
  let apiResponded = false;
  let iconResponded = false;

  const cache = {
    addAll: async (paths: string[]) => {
      cachedPaths = Array.from(paths);
    },
    match: async () => undefined,
    put: async () => undefined,
  };
  const source = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

  runInNewContext(source, {
    URL,
    Set,
    Promise,
    fetch: async () => new Response(null, { status: 200 }),
    caches: {
      open: async () => cache,
      keys: async () => [],
      delete: async () => true,
      match: async () => undefined,
    },
    self: {
      location: { origin: "http://localhost" },
      clients: { claim: async () => undefined },
      skipWaiting: async () => undefined,
      addEventListener: (name: string, handler: WorkerEventHandler) => {
        handlers.set(name, handler);
      },
    },
  });

  handlers.get("install")?.({
    waitUntil: (promise: Promise<unknown>) => {
      installPromise = promise;
    },
  });
  await installPromise;

  assert.deepEqual(cachedPaths, [
    "/manifest.webmanifest",
    "/icons/pwa-192x192.png",
    "/icons/pwa-512x512.png",
    "/icons/pwa-maskable-512x512.png",
    "/icons/apple-touch-icon.png",
  ]);
  assert.equal(cachedPaths.some((path) => path.startsWith("/api/")), false);

  handlers.get("fetch")?.({
    request: new Request("http://localhost/api/tenants"),
    respondWith: () => {
      apiResponded = true;
    },
  });
  handlers.get("fetch")?.({
    request: new Request("http://localhost/icons/pwa-192x192.png"),
    respondWith: () => {
      iconResponded = true;
    },
  });

  assert.equal(apiResponded, false);
  assert.equal(iconResponded, true);
});

test("PWA icon files expose the exact install and Apple touch dimensions", () => {
  assert.deepEqual(readPngDimensions("pwa-192x192.png"), {
    width: 192,
    height: 192,
  });
  assert.deepEqual(readPngDimensions("pwa-512x512.png"), {
    width: 512,
    height: 512,
  });
  assert.deepEqual(readPngDimensions("pwa-maskable-512x512.png"), {
    width: 512,
    height: 512,
  });
  assert.deepEqual(readPngDimensions("apple-touch-icon.png"), {
    width: 180,
    height: 180,
  });
});

function readPngDimensions(fileName: string) {
  const file = readFileSync(join(process.cwd(), "public", "icons", fileName));
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  assert.equal(file.subarray(0, 8).equals(pngSignature), true);

  return {
    width: file.readUInt32BE(16),
    height: file.readUInt32BE(20),
  };
}
