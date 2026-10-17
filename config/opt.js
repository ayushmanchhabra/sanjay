import process from "node:process";

const PLATFORM_KV = {
  darwin: "osx",
  linux: "linux",
  win32: "win",
};

const ARCH_KV = {
  x64: "x64",
  ia32: "ia32",
  arm64: "arm64",
};

// Icon format for each platform
const ICON_KV = {
  osx: "./assets/icon.icns",
  linux: "./assets/icon.png",
  win: "./assets/icon.ico",
};

const options = {
  version: "0.115.0",
  flavor: "sdk",
  platform: PLATFORM_KV[process.platform],
  arch: ARCH_KV[process.arch],
  downloadUrl: "https://dl.nwjs.io",
  manifestUrl: "https://nwjs.io/versions.json",
  cacheDir: "./cache",
  srcDir: "./src/desktop",
  outDir: "./out",
  glob: false,
  argv: [],
  app: {
    icon: ICON_KV[PLATFORM_KV[process.platform]],
    // MacOS
    LSApplicationCategoryType: "public.app-category.developer-tools",
    CFBundleIdentifier: "com.ayushmanchhabra.sanjay",
    NSHumanReadableCopyright: "Copyright © 2026 Ayushman Chhabra",
  },
  managedManifest: "./src/desktop/package.json",
  cache: true,
  ffmpeg: false,
  nativeAddon: false,
  shaSum: true,
};

export default options;
