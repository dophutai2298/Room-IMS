import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const targetUrl = process.argv[2] ?? "http://localhost:3000/sign-in";
const browserPath = resolveBrowserPath();
const debuggingPort = await findAvailablePort();
const profileDirectory = await mkdtemp(join(tmpdir(), "rentalroom201-pwa-"));
const browser = spawn(
  browserPath,
  [
    "--headless=new",
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profileDirectory}`,
    "--no-first-run",
    "--disable-default-apps",
    targetUrl,
  ],
  { stdio: "ignore" },
);

try {
  const target = await waitForPageTarget(debuggingPort, targetUrl);
  const client = await createCdpClient(target.webSocketDebuggerUrl);

  try {
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await delay(1_500);
    let serviceWorker = await readServiceWorkerState(client);
    if (serviceWorker.result.value?.ready && !serviceWorker.result.value?.controller) {
      await client.send("Page.reload", { ignoreCache: true });
      await delay(2_000);
      serviceWorker = await readServiceWorkerState(client);
    }
    const manifest = await client.send("Page.getAppManifest");
    const installability = await client.send("Page.getInstallabilityErrors");
    const page = await client.send("Runtime.evaluate", {
      expression: "location.href",
      returnByValue: true,
    });

    const result = {
      pageUrl: page.result.value,
      manifestUrl: manifest.url,
      manifestErrors: manifest.errors ?? [],
      serviceWorker: serviceWorker.result.value,
      installabilityErrors: installability.installabilityErrors ?? [],
    };

    console.log(JSON.stringify(result, null, 2));

    if (!result.manifestUrl.endsWith("/manifest.webmanifest")) {
      throw new Error("The browser did not discover the PWA manifest.");
    }
    if (result.manifestErrors.length > 0) {
      throw new Error("The browser reported Web App Manifest errors.");
    }
    if (
      !result.serviceWorker?.ready ||
      !result.serviceWorker?.controller ||
      !String(result.serviceWorker.scope).endsWith("/")
    ) {
      throw new Error("The service worker is not controlling the PWA page.");
    }
    if (result.installabilityErrors.length > 0) {
      throw new Error("The browser reported PWA installability errors.");
    }
  } finally {
    client.close();
  }
} finally {
  await stopBrowser(browser);
  await rm(profileDirectory, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  });
}

function resolveBrowserPath() {
  const configuredPath = process.env.PWA_BROWSER_PATH;
  const candidates = [
    configuredPath,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const resolvedPath = candidates.find((candidate) => existsSync(candidate));

  if (!resolvedPath) {
    throw new Error(
      "Chrome or Edge was not found. Set PWA_BROWSER_PATH to the browser executable.",
    );
  }

  return resolvedPath;
}

async function findAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve) => server.close(resolve));

  if (!port) {
    throw new Error("Could not reserve a browser debugging port.");
  }

  return port;
}

async function waitForPageTarget(port, pageUrl) {
  const deadline = Date.now() + 10_000;
  const expectedOrigin = new URL(pageUrl).origin;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find(
        (target) =>
          target.type === "page" && target.url.startsWith(expectedOrigin),
      );
      if (page) {
        return page;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(150);
  }

  throw new Error("Chrome DevTools did not expose a page target.", {
    cause: lastError,
  });
}

async function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let requestId = 0;
  const pendingRequests = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const pending = pendingRequests.get(message.id);
    if (!pending) {
      return;
    }

    pendingRequests.delete(message.id);
    if (message.error) {
      pending.reject(new Error(message.error.message));
      return;
    }

    pending.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    for (const pending of pendingRequests.values()) {
      pending.reject(new Error("Chrome DevTools connection closed."));
    }
    pendingRequests.clear();
  });

  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++requestId;
        pendingRequests.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

function readServiceWorkerState(client) {
  return client.send("Runtime.evaluate", {
    expression: `Promise.race([
      navigator.serviceWorker.ready.then((registration) => ({
        ready: true,
        scope: registration.scope,
        controller: Boolean(navigator.serviceWorker.controller),
      })),
      new Promise((resolve) => setTimeout(() => resolve({ ready: false }), 5000)),
    ])`,
    awaitPromise: true,
    returnByValue: true,
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function stopBrowser(browserProcess) {
  if (browserProcess.exitCode !== null) {
    return;
  }

  const exited = new Promise((resolve) => {
    browserProcess.once("exit", resolve);
  });
  browserProcess.kill();
  await Promise.race([exited, delay(3_000)]);
}
