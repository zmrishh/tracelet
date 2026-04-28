/**
 * postbuild: mark dist/cli.js executable (chmod 755).
 *
 * On Windows, fs.chmodSync is a no-op — this script runs safely on all
 * platforms. npm handles Windows bin wrappers (.cmd / PowerShell shims)
 * automatically so no manual step is needed there.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const CLI_PATH = path.join(__dirname, "..", "dist", "cli.js");

try {
  fs.chmodSync(CLI_PATH, 0o755);
} catch (err) {
  // Silently ignore on Windows (EPERM is expected and harmless).
  if (err.code !== "EPERM" && err.code !== "ENOENT") {
    console.warn("[tracelet postbuild] chmod skipped:", err.message);
  }
}
