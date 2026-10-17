import type { CapturedRequest } from "./proxy/types";

export type Screen = "proxy" | "repeater" | "intruder";

// A request handed from the Proxy to Repeater/Intruder. The nonce makes
// each "Send to …" a new value even when the same request is sent
// twice, so the receiving screen reloads it.
export interface RequestSeed {
  request: CapturedRequest;
  nonce: number;
}
