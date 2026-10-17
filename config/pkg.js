import fs from "node:fs/promises";
import path from "node:path";

import nwbuild from "nw-builder";

import options from "./opt.js";

// Package format for each platform
const FORMAT_KV = {
  linux: "AppImage",
  win: "nsis",
  osx: "dmg",
};

const packagePath = await nwbuild({
  ...options,
  mode: "package",
  format: FORMAT_KV[options.platform],
  nsis: {
    appId: "sanjay",
  },
  dmg: {
    // Ad-hoc sign the app, since building it invalidates the NW.js signature
    signIdentity: "-",
  },
});

// Move the package to the release directory
// TODO: fix in nw-builder
const releaseDir = "./release";
await fs.mkdir(releaseDir, { recursive: true });
const destination = path.join(releaseDir, path.basename(packagePath));
await fs.rename(packagePath, destination);
