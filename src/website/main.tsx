import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// The esbuild dev server (npm run dev) serves over http and notifies
// /esbuild on every rebuild. The packaged app loads from disk instead.
if (location.protocol === "http:") {
  new EventSource("/esbuild").addEventListener("change", () =>
    location.reload(),
  );
}

const el = document.getElementById("root");
if (!el) throw new Error("#root not found");

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
