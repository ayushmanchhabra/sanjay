import { useRef, useState, type ChangeEvent } from "react";

import { methodColor, rawRequest, rawResponse, statusColor } from "./format";
import { getServerBridge } from "./serverBridge";
import type { CapturedExchange, CapturedRequest } from "./types";
import { useCapturedExchanges } from "./useCapturedExchanges";
import { usePendingRequests } from "./usePendingRequests";

function header(headers: [string, string][], name: string): string | undefined {
  return headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

export default function Proxy({
  onSendToRepeater,
  onSendToIntruder,
}: {
  onSendToRepeater: (request: CapturedRequest) => void;
  onSendToIntruder: (request: CapturedRequest) => void;
}) {
  const capturedExchanges = useCapturedExchanges();
  const pendingRequests = usePendingRequests();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const bridge = getServerBridge();
  const [intercepting, setIntercepting] = useState(
    () => bridge?.isInterceptEnabled() ?? false,
  );
  const caFileInputRef = useRef<HTMLInputElement>(null);

  const selected: CapturedExchange | undefined = capturedExchanges.find(
    (entry) => entry.id === selectedId,
  );
  const activeIntercepted = pendingRequests[0];

  function handleCAFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const destinationPath = event.target.value;
    event.target.value = "";
    if (destinationPath) bridge?.exportCACertificate(destinationPath);
  }

  function handleOpenBrowser() {
    try {
      bridge?.openBrowser();
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  function handleRegenerateCA() {
    const confirmed = window.confirm(
      "Regenerate the CA certificate?\n\nAnything that trusts the current certificate will stop trusting Sanjay until the new one is exported and imported again. An open Sanjay browser is restarted automatically.",
    );
    if (!confirmed) return;
    try {
      bridge?.regenerateCA();
    } catch (err) {
      window.alert((err as Error).message);
    }
  }

  function toggleIntercept() {
    const next = !intercepting;
    bridge?.setInterceptEnabled(next);
    setIntercepting(next);
  }

  return (
    <div className="flex h-full w-full flex-col bg-neutral-950 text-neutral-200">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-900 px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-neutral-100">Proxy</span>
          <span className="flex items-center gap-1.5 text-xs text-neutral-500">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                intercepting ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
            {intercepting
              ? pendingRequests.length > 0
                ? `Intercept on · ${pendingRequests.length} held`
                : "Intercept on"
              : "Listening"}
          </span>
          <span className="text-xs text-neutral-600">
            {capturedExchanges.length} exchanges
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!bridge}
            onClick={handleOpenBrowser}
            title={bridge ? undefined : "Only available in the desktop app"}
            className="rounded border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-xs font-medium text-sky-300 hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-sky-400/10"
          >
            Open Browser
          </button>
          <button
            type="button"
            disabled={!bridge}
            onClick={toggleIntercept}
            title={bridge ? undefined : "Only available in the desktop app"}
            className={`rounded border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              intercepting
                ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            Intercept
          </button>
          <button
            type="button"
            className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-700"
          >
            Clear
          </button>
          <input
            ref={caFileInputRef}
            type="file"
            nwsaveas="sanjay-ca.pem"
            className="hidden"
            onChange={handleCAFileChosen}
          />
          <button
            type="button"
            disabled={!bridge}
            onClick={() => caFileInputRef.current?.click()}
            title={bridge ? undefined : "Only available in the desktop app"}
            className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-neutral-800"
          >
            Export CA Certificate
          </button>
          <button
            type="button"
            disabled={!bridge}
            onClick={handleRegenerateCA}
            title={bridge ? undefined : "Only available in the desktop app"}
            className="rounded border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-neutral-800"
          >
            Regenerate CA
          </button>
        </div>
      </header>

      {activeIntercepted && (
        <div className="flex shrink-0 flex-col border-b border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${methodColor(
                  activeIntercepted.method,
                )}`}
              >
                {activeIntercepted.method}
              </span>
              <span className="truncate font-mono text-neutral-300">
                <span className="text-neutral-500">
                  {activeIntercepted.host}
                </span>
                {activeIntercepted.path}
              </span>
              {pendingRequests.length > 1 && (
                <span className="shrink-0 text-neutral-500">
                  +{pendingRequests.length - 1} more waiting
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  bridge?.forwardPendingRequest(activeIntercepted.id)
                }
                className="rounded border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-400/20"
              >
                Forward
              </button>
              <button
                type="button"
                onClick={() => bridge?.dropPendingRequest(activeIntercepted.id)}
                className="rounded border border-rose-400/40 bg-rose-400/10 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-400/20"
              >
                Drop
              </button>
            </div>
          </div>
          <div className="max-h-40 overflow-auto border-t border-amber-500/20 bg-neutral-950 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-neutral-300">
            {rawRequest(activeIntercepted)}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {/* One list for both sides, so a request and its response always
            scroll together. Both halves of the view reserve the same
            scrollbar gutter, so their column dividers line up. */}
        <div className="flex-1 basis-1/2 overflow-y-auto [scrollbar-gutter:stable]">
          {/* Sticky inside the scroll area, so the columns line up with
              the rows whether or not a scrollbar is shown. */}
          <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-neutral-800 bg-neutral-900 text-xs font-medium uppercase tracking-wide text-neutral-500">
            <span className="flex h-8 items-center border-r border-neutral-800 px-3">
              Requests
            </span>
            <span className="flex h-8 items-center px-3">Responses</span>
          </div>

          {capturedExchanges.map((entry) => {
            const isSelected = entry.id === selectedId;
            const contentType =
              header(entry.response.headers, "content-type") ?? "-";
            const size = entry.response.body
              ? `${entry.response.body.length}B`
              : "0B";
            return (
              <button
                type="button"
                key={entry.id}
                onClick={() => setSelectedId(entry.id)}
                className={`grid w-full grid-cols-2 border-l-2 text-left text-xs ${
                  isSelected
                    ? "border-l-sky-500 bg-sky-500/10"
                    : "border-l-transparent hover:bg-neutral-900"
                }`}
              >
                <span className="grid min-w-0 grid-cols-[3.25rem_1fr_4.5rem] items-center gap-2 border-r border-neutral-800 py-1.5 pr-3 pl-2.5">
                  <span
                    className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${methodColor(
                      entry.request.method,
                    )}`}
                  >
                    {entry.request.method}
                  </span>
                  <span className="truncate font-mono text-neutral-300">
                    <span className="text-neutral-500">
                      {entry.request.host}
                    </span>
                    {entry.request.path}
                  </span>
                  <span className="text-right tabular-nums text-neutral-500">
                    {entry.time}
                  </span>
                </span>
                <span className="grid min-w-0 grid-cols-[3.25rem_1fr] items-center gap-2 px-3 py-1.5">
                  <span
                    className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${statusColor(
                      entry.response.status,
                    )}`}
                  >
                    {entry.response.status}
                  </span>
                  <span className="truncate font-mono text-neutral-300">
                    {contentType}
                    <span className="text-neutral-600"> · {size}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex min-h-0 flex-1 basis-1/2 flex-col border-t border-neutral-800">
          <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-neutral-800 bg-neutral-900/60 px-3 text-xs">
            <span className="truncate font-mono text-neutral-500">
              {selected
                ? `${selected.request.method} ${selected.request.scheme}://${selected.request.host}${selected.request.path}`
                : "No exchange selected"}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={!selected}
                onClick={() => selected && onSendToRepeater(selected.request)}
                className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-neutral-800"
              >
                → Repeater
              </button>
              <button
                type="button"
                disabled={!selected}
                onClick={() => selected && onSendToIntruder(selected.request)}
                className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-neutral-800"
              >
                → Intruder
              </button>
            </div>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden [scrollbar-gutter:stable] bg-neutral-950 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-neutral-300">
            <div className="overflow-auto border-r border-neutral-800 p-3">
              {selected ? rawRequest(selected.request) : "Select an exchange"}
            </div>
            <div className="overflow-auto p-3">
              {selected ? rawResponse(selected) : "Select an exchange"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
