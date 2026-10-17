// Entry point bundled to src/desktop/server.js and run as NW.js's
// "node-main" background script. Starts the forward proxy with the
// defaults documented for FoxyProxy (127.0.0.1:8080) and exposes the
// capture API on `module.exports`, reachable from the window's DOM
// context via `process.mainModule.exports`.
import {
  closeBrowser,
  openBrowser as launchBrowser,
  restartBrowser,
} from "./browser.ts";
import {
  exportCACertificate,
  getCACertificateInfo,
  regenerateCA as regenerateCAFiles,
} from "./ca.ts";
import { getExchanges, onExchange } from "./capture.ts";
import {
  dropPendingRequest,
  forwardPendingRequest,
  getPendingRequests,
  isInterceptEnabled,
  onPendingRequest,
  onPendingRequestResolved,
  setInterceptEnabled,
} from "./intercept.ts";
import { createProxyServer } from "./proxy.ts";
import { sendRequest } from "./send.ts";

const HOST = "127.0.0.1";
const PORT = 8080;

const server = createProxyServer();

// Set when the proxy fails to start, eg. because another process
// already listens on PORT.
let listenError: Error | undefined;

server.on("error", (err) => {
  console.error(`[proxy] server error: ${err.message}`);
  if (!server.listening) listenError = err;
});

server.listen(PORT, HOST, () => {
  listenError = undefined;
  console.log(`[proxy] listening on http://${HOST}:${PORT}`);
});

process.on("exit", closeBrowser);

// Without the proxy, the browser would send its traffic to whatever
// else listens on PORT.
function openBrowser(): void {
  if (!server.listening) {
    throw new Error(
      `The proxy isn't running on ${HOST}:${PORT}${listenError ? `: ${listenError.message}` : ""}. Free the port and restart Sanjay.`,
    );
  }
  launchBrowser(HOST, PORT);
}

// An open browser only trusts the CA it was launched with.
function regenerateCA(): void {
  regenerateCAFiles();
  restartBrowser(HOST, PORT);
}

export {
  dropPendingRequest,
  openBrowser,
  regenerateCA,
  exportCACertificate,
  forwardPendingRequest,
  getCACertificateInfo,
  getExchanges,
  getPendingRequests,
  isInterceptEnabled,
  onExchange,
  onPendingRequest,
  onPendingRequestResolved,
  sendRequest,
  setInterceptEnabled,
};
