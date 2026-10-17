#!/usr/bin/env node
import run from "@nwutils/runner";

import options from "./opt.js";

// Run the repository root, whose package.json loads the esbuild dev
// server instead of the built ./src/desktop/index.html.
await run({ ...options, srcDir: "." });
