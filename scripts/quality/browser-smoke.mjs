import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const unsafeLogPattern = /password|access[_-]?token|refresh[_-]?token|authorization:\s*bearer|token=|signature=/i;
const viewports = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];
const legalAndOperationsPaths = [
  "/contact",
  "/version",
  "/privacy",
  "/terms",
  "/cookies",
  "/accessibility",
  "/acceptable-use",
  "/copyright-trademark",
];

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function availablePort() {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePromise(port));
    });
  });
}

function chromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) throw new Error("Local Chrome or Edge was not found. Set CHROME_PATH to run this optional smoke.");
  return executable;
}

async function waitForServer(url, processHandle) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (processHandle.exitCode !== null) throw new Error("Vite preview exited before browser smoke started.");
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error("Vite preview did not become ready.");
}

async function pageEndpoint(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = pages.find((candidate) => candidate.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("Chrome DevTools endpoint did not become available.");
}

async function run() {
  if (typeof WebSocket === "undefined") {
    throw new Error("The local browser smoke requires a Node runtime with WebSocket support.");
  }

  const previewPort = await availablePort();
  const debuggingPort = await availablePort();
  const origin = `http://127.0.0.1:${previewPort}`;
  const profile = mkdtempSync(join(tmpdir(), "prefab-quality-browser-"));
  const vite = spawn(process.execPath, [
    resolve("node_modules/vite/bin/vite.js"),
    "preview",
    "--configLoader", "runner",
    "--host", "127.0.0.1",
    "--port", String(previewPort),
    "--strictPort",
  ], { stdio: "ignore", windowsHide: true });
  let chrome;
  let socket;

  try {
    await waitForServer(origin, vite);
    chrome = spawn(chromeExecutable(), [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--remote-allow-origins=*",
      `--remote-debugging-port=${debuggingPort}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ], { stdio: "ignore", windowsHide: true });

    const endpoint = await pageEndpoint(debuggingPort);
    socket = new WebSocket(endpoint);
    await new Promise((resolvePromise, reject) => {
      socket.addEventListener("open", resolvePromise, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    socket.addEventListener("close", (event) => {
      if (pending.size > 0) {
        console.error(`Chrome DevTools socket closed unexpectedly (${event.code || "no code"}).`);
      }
    });

    let nextId = 1;
    const pending = new Map();
    const consoleErrors = [];
    const unsafeLogs = [];
    socket.addEventListener("message", async (event) => {
      let rawMessage = event.data;
      if (typeof rawMessage !== "string" && typeof rawMessage?.text === "function") {
        rawMessage = await rawMessage.text();
      } else if (rawMessage instanceof ArrayBuffer) {
        rawMessage = new TextDecoder().decode(rawMessage);
      } else if (ArrayBuffer.isView(rawMessage)) {
        rawMessage = new TextDecoder().decode(rawMessage);
      }
      const message = JSON.parse(String(rawMessage));
      if (message.id && pending.has(message.id)) {
        const request = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result ?? {});
        return;
      }
      if (message.method === "Runtime.exceptionThrown") consoleErrors.push("runtime-exception");
      if (message.method === "Log.entryAdded" && message.params.entry.level === "error") consoleErrors.push("log-error");
      if (message.method === "Runtime.consoleAPICalled") {
        const value = message.params.args.map((argument) => String(argument.value ?? argument.description ?? "")).join(" ");
        if (message.params.type === "error") consoleErrors.push("console-error");
        if (unsafeLogPattern.test(value)) unsafeLogs.push("unsafe-log");
      }
    });

    function send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolvePromise, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Chrome DevTools command timed out: ${method} (socket state ${socket.readyState}).`));
        }, 10_000);
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timeout);
            resolvePromise(value);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
        });
        socket.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expression) {
      const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (response.exceptionDetails) {
        const details = response.exceptionDetails;
        const location = Number.isInteger(details.lineNumber)
          ? ` at ${details.lineNumber + 1}:${(details.columnNumber ?? 0) + 1}`
          : "";
        const description = details.exception?.description?.split("\n", 1)[0] ?? details.text ?? "unknown error";
        throw new Error(`Browser evaluation failed${location}: ${description}`);
      }
      return response.result.value;
    }

    async function waitFor(expression, label) {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        if (await evaluate(`Boolean(${expression})`)) return;
        await sleep(100);
      }
      throw new Error(`Browser smoke timed out waiting for ${label}.`);
    }

    async function setViewport(width, height) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 600,
      });
    }

    async function navigate(path, viewport = viewports.at(-1)) {
      await setViewport(viewport.width, viewport.height);
      await send("Page.navigate", { url: `${origin}${path}` });
      await waitFor("document.readyState === 'complete'", path);
      await waitFor("document.querySelector('main')", `${path} main content`);
      await sleep(150);
    }

    await send("Page.enable");
    await send("Runtime.enable");
    await send("Log.enable");

    const viewportResults = [];
    const legalPageResults = [];
    for (const viewport of viewports) {
      await navigate("/", viewport);
      await waitFor(
        "document.querySelector('.skip-link') && document.querySelector('nav[aria-label=\"Public website\"]')",
        `${viewport.width}x${viewport.height} public shell`,
      );
      viewportResults.push(await evaluate(`(() => ({
        width: ${viewport.width},
        height: ${viewport.height},
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        h1Count: document.querySelectorAll('h1').length,
        mainCount: document.querySelectorAll('main').length,
        navigation: Boolean(document.querySelector('nav[aria-label="Public website"]')),
      }))()`));
      for (const path of legalAndOperationsPaths) {
        await evaluate(`(() => {
          history.pushState({}, "", ${JSON.stringify(path)});
          dispatchEvent(new PopStateEvent("popstate"));
        })()`);
        await waitFor(`location.pathname === ${JSON.stringify(path)}`, `${path} client navigation`);
        await waitFor("document.querySelector('main#public-content h1')", `${path} heading`);
        await sleep(50);
        legalPageResults.push(await evaluate(`(() => ({
          path: location.pathname,
          width: ${viewport.width},
          height: ${viewport.height},
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          h1Count: document.querySelectorAll('h1').length,
          mainCount: document.querySelectorAll('main').length,
          footer: Boolean(document.querySelector('footer nav[aria-label="Public information and legal documents"]')),
          draftWarning: location.pathname === '/contact' || location.pathname === '/version'
            ? true
            : Boolean(document.querySelector('.legal-draft-banner')),
        }))()`));
      }
    }

    await navigate("/", viewports[2]);
    await waitFor("document.querySelector('.skip-link')", "public skip link");
    await evaluate("document.body.focus()");
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await waitFor("document.activeElement?.classList.contains('skip-link')", "keyboard focus on skip link");
    const skipLinkFocus = await evaluate(`(async () => {
      const link = document.querySelector('.skip-link');
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const rect = link.getBoundingClientRect();
      return {
        focused: document.activeElement === link,
        top: rect.top,
        bottom: rect.bottom,
        viewportHeight: innerHeight,
        transform: getComputedStyle(link).transform,
      };
    })()`);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await waitFor("document.activeElement?.id === 'public-content'", "skip-link target focus");
    const skipLink = {
      visibleOnFocus: skipLinkFocus.focused && skipLinkFocus.top >= 0 && skipLinkFocus.bottom <= skipLinkFocus.viewportHeight,
      targetFocused: true,
    };

    await evaluate(`document.querySelector('a[href="/about"]').click()`);
    await waitFor("location.pathname === '/about'", "About navigation");
    await sleep(50);
    const publicNavigation = await evaluate(`({
      aboutPath: location.pathname,
      mainFocused: document.activeElement?.id === 'public-content',
      h1Count: document.querySelectorAll('h1').length,
    })`);
    await evaluate("history.back()");
    await waitFor("location.pathname === '/'", "browser Back");
    await evaluate("history.forward()");
    await waitFor("location.pathname === '/about'", "browser Forward");
    await evaluate(`document.querySelector('footer a[href="/privacy"]').click()`);
    await waitFor("location.pathname === '/privacy'", "Privacy navigation");
    await evaluate("history.back()");
    await waitFor("location.pathname === '/about'", "legal route browser Back");
    await evaluate("history.forward()");
    await waitFor("location.pathname === '/privacy'", "legal route browser Forward");

    await navigate("/not-a-public-page", viewports[3]);
    await waitFor("document.querySelector('h1')?.textContent === 'Public page not found'", "Not Found content");
    const notFound = await evaluate(`({
      heading: document.querySelector('h1')?.textContent,
      homeLink: Boolean(document.querySelector('a[href="/"]')),
      overflow: document.documentElement.scrollWidth > innerWidth,
    })`);

    await navigate("/marketplace?view=dashboard", viewports[1]);
    await waitFor("document.querySelector('.auth-form')", "marketplace login form");
    await evaluate("document.body.focus()");
    await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await waitFor("document.activeElement?.classList.contains('skip-link')", "keyboard focus on portal skip link");
    await evaluate("new Promise((resolve) => requestAnimationFrame(resolve))");
    const login = await evaluate(`(() => {
      const email = document.querySelector('#auth-email');
      const password = document.querySelector('#auth-password');
      const skip = document.querySelector('.skip-link');
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        mainCount: document.querySelectorAll('main').length,
        skipTarget: skip.getAttribute('href'),
        skipVisible: skip.getBoundingClientRect().top >= 0,
        emailLabelled: email?.labels?.length === 1,
        passwordLabelled: password?.labels?.length === 1,
        passwordAutocomplete: password?.autocomplete,
        submitEnabled: !document.querySelector('.auth-form button[type="submit"]')?.disabled,
      };
    })()`);

    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    const reducedMotion = await evaluate(`({
      matches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      duration: getComputedStyle(document.querySelector('.skip-link')).transitionDuration,
    })`);
    await send("Emulation.setEmulatedMedia", {
      features: [{ name: "forced-colors", value: "active" }],
    });
    const forcedColors = await evaluate("matchMedia('(forced-colors: active)').matches");

    const zoomResults = [];
    for (const width of [640, 320]) {
      await navigate("/", { width, height: 800 });
      const homeOverflow = await evaluate("document.documentElement.scrollWidth > innerWidth");
      await navigate("/marketplace?view=dashboard", { width, height: 800 });
      await waitFor("document.querySelector('.auth-form')", `${width}px login reflow`);
      const loginOverflow = await evaluate("document.documentElement.scrollWidth > innerWidth");
      zoomResults.push({ proxy: width === 640 ? "200%" : "400%", homeOverflow, loginOverflow });
    }

    const failedViewports = viewportResults.filter((item) => item.overflow || item.h1Count !== 1 || item.mainCount !== 1 || !item.navigation);
    if (failedViewports.length > 0) throw new Error("One or more viewport checks failed.");
    const failedLegalPages = legalPageResults.filter((item) => item.overflow || item.h1Count !== 1 || item.mainCount !== 1 || !item.footer || !item.draftWarning);
    if (failedLegalPages.length > 0) throw new Error(`One or more legal/operations page checks failed: ${JSON.stringify(failedLegalPages)}.`);
    if (!skipLink.visibleOnFocus || !skipLink.targetFocused) {
      throw new Error(`Skip-link focus behavior failed: ${JSON.stringify(skipLinkFocus)}.`);
    }
    if (publicNavigation.aboutPath !== "/about" || !publicNavigation.mainFocused || publicNavigation.h1Count !== 1) {
      throw new Error("Public navigation or focus restoration failed.");
    }
    if (notFound.heading !== "Public page not found" || !notFound.homeLink || notFound.overflow) throw new Error("Not Found behavior failed.");
    if (login.overflow || login.mainCount !== 1 || login.skipTarget !== "#portal-content" || !login.skipVisible || !login.emailLabelled || !login.passwordLabelled || login.passwordAutocomplete !== "current-password") {
      throw new Error(`Marketplace login accessibility check failed: ${JSON.stringify(login)}.`);
    }
    const reducedDurationSeconds = Number.parseFloat(reducedMotion.duration);
    if (!reducedMotion.matches || !Number.isFinite(reducedDurationSeconds) || reducedDurationSeconds > 0.001) {
      throw new Error(`Reduced-motion behavior failed: ${JSON.stringify(reducedMotion)}.`);
    }
    if (!forcedColors) throw new Error("Forced-colors emulation did not activate.");
    if (zoomResults.some((item) => item.homeOverflow || item.loginOverflow)) throw new Error("Zoom/reflow proxy failed.");
    if (consoleErrors.length > 0 || unsafeLogs.length > 0) throw new Error("Browser console safety check failed.");

    console.log(JSON.stringify({
      passed: true,
      viewports: viewportResults.map(({ width, height }) => `${width}x${height}`),
      legalAndOperationsPages: legalAndOperationsPaths.length,
      publicNavigation: true,
      notFound: true,
      marketplaceLogin: true,
      skipLink: true,
      reducedMotion: true,
      forcedColors: true,
      zoomReflow: zoomResults,
      consoleErrors: consoleErrors.length,
      unsafeLogs: unsafeLogs.length,
    }));
  } finally {
    try { socket?.close(); } catch {}
    chrome?.kill();
    vite.kill();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(`Local browser quality smoke failed: ${error.message}`);
  process.exitCode = 1;
});
