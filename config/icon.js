import buffer from "node:buffer";
import child_process from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Render ./assets/icon.svg into the icon format each platform needs.
// Requires ImageMagick (`magick`) on the PATH.

const SOURCE = "./assets/icon.svg";
const ASSETS = "./assets";

// ICNS entry types which hold a PNG of the given size
const ICNS_KV = {
  ic11: 32,
  ic12: 64,
  ic07: 128,
  ic08: 256,
  ic13: 256,
  ic09: 512,
  ic14: 512,
  ic10: 1024,
};

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "icon-"));

function render(size) {
  const output = path.join(tmpDir, `icon-${size}.png`);
  if (!fs.existsSync(output)) {
    child_process.execFileSync("magick", [
      "-background",
      "none",
      SOURCE,
      "-resize",
      `${size}x${size}`,
      "-depth",
      "8",
      output,
    ]);
  }
  return output;
}

// Linux
fs.copyFileSync(render(512), path.join(ASSETS, "icon.png"));

// Windows
child_process.execFileSync("magick", [
  render(1024),
  "-define",
  "icon:auto-resize=256,128,64,48,32,16",
  path.join(ASSETS, "icon.ico"),
]);

// MacOS
const entries = Object.entries(ICNS_KV).map(([type, size]) => {
  const png = fs.readFileSync(render(size));
  const header = buffer.Buffer.alloc(8);
  header.write(type, 0, "ascii");
  header.writeUInt32BE(png.length + 8, 4);
  return buffer.Buffer.concat([header, png]);
});
const icnsHeader = buffer.Buffer.alloc(8);
icnsHeader.write("icns", 0, "ascii");
icnsHeader.writeUInt32BE(
  entries.reduce((total, entry) => total + entry.length, 8),
  4,
);
fs.writeFileSync(
  path.join(ASSETS, "icon.icns"),
  buffer.Buffer.concat([icnsHeader, ...entries]),
);

fs.rmSync(tmpDir, { recursive: true, force: true });
