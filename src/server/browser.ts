// Opens a Chromium-based browser whose traffic goes through the proxy,
// like Burp Suite's "Open browser". It runs on its own profile, so the
// proxy and the trust in the local CA below never touch the user's
// everyday browser profile.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

import { getCASpkiHash } from "./ca.ts";

// Executables looked up on the PATH (Linux).
const PATH_CANDIDATES = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "microsoft-edge",
  "microsoft-edge-stable",
  "brave-browser",
];

// Absolute install locations (MacOS, Windows).
function installCandidates(): string[] {
  if (process.platform === "darwin") {
    const apps = [
      "Google Chrome.app/Contents/MacOS/Google Chrome",
      "Chromium.app/Contents/MacOS/Chromium",
      "Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "Brave Browser.app/Contents/MacOS/Brave Browser",
    ];
    return ["/Applications", join(homedir(), "Applications")].flatMap((dir) =>
      apps.map((app) => join(dir, app)),
    );
  }
  if (process.platform === "win32") {
    const roots = [
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ].filter((root): root is string => Boolean(root));
    const apps = [
      "Google\\Chrome\\Application\\chrome.exe",
      "Chromium\\Application\\chrome.exe",
      "Microsoft\\Edge\\Application\\msedge.exe",
      "BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    ];
    return roots.flatMap((root) => apps.map((app) => join(root, app)));
  }
  return [];
}

function findOnPath(name: string): string | undefined {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

// SANJAY_BROWSER, when set, points at the browser executable to use.
export function findBrowser(): string | undefined {
  const override = process.env.SANJAY_BROWSER;
  if (override) return existsSync(override) ? override : undefined;
  for (const name of PATH_CANDIDATES) {
    const found = findOnPath(name);
    if (found) return found;
  }
  return installCandidates().find((candidate) => existsSync(candidate));
}

function getProfileDir(): string {
  return join(homedir(), ".sanjay", "browser");
}

let browser: ChildProcess | undefined;

// Launches the browser pointed at the proxy on `host`:`port`. Throws
// if no Chromium-based browser is installed.
export function openBrowser(host: string, port: number): void {
  const executable = findBrowser();
  if (!executable) {
    throw new Error(
      "No Chromium-based browser found. Install Google Chrome, Chromium, Microsoft Edge or Brave, or set SANJAY_BROWSER to its executable.",
    );
  }

  const child = spawn(
    executable,
    [
      `--user-data-dir=${getProfileDir()}`,
      `--proxy-server=http://${host}:${port}`,
      // Chromium bypasses the proxy for localhost by default; capture
      // local targets too.
      "--proxy-bypass-list=<-loopback>",
      // Trust certificates the proxy mints, without importing the CA
      // into the OS or browser trust store. Only honoured together
      // with --user-data-dir.
      `--ignore-certificate-errors-spki-list=${getCASpkiHash()}`,
      // Hides the "unsupported command-line flag" warning the flag
      // above otherwise shows.
      "--test-type",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    { stdio: "ignore" },
  );
  // While the browser is already open, a second launch just opens a
  // new window in it and exits, so keep tracking the first process.
  browser ??= child;

  child.on("error", (err) => {
    console.error(`[browser] failed to launch ${executable}: ${err.message}`);
  });
  child.on("exit", () => {
    if (browser === child) browser = undefined;
  });

  console.log(`[browser] launched ${executable}`);
}

// Relaunches an open browser, eg. so it picks up a regenerated CA.
export function restartBrowser(host: string, port: number): void {
  if (!browser) return;
  // Wait for the old process to exit, or the new launch would just
  // open a window in it.
  browser.once("exit", () => openBrowser(host, port));
  browser.kill();
}

// The browser is useless once the proxy behind it is gone.
export function closeBrowser(): void {
  browser?.kill();
  browser = undefined;
}
