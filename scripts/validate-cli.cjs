/**
 * prepublishOnly gate: validates that the CLI artifact is correct before
 * npm allows the package to be published.
 *
 * Checks:
 *  1. dist/cli.js exists
 *  2. First line is a valid shebang (#!/usr/bin/env node)
 *  3. The bin path declared in package.json resolves to the same file
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const ROOT     = path.join(__dirname, "..");
const CLI_PATH = path.join(ROOT, "dist", "cli.js");
const PKG_PATH = path.join(ROOT, "package.json");

const SHEBANG  = "#!/usr/bin/env node";

let exitCode = 0;

function pass(msg) { console.log(`  \u2714 ${msg}`); }
function fail(msg) { console.error(`  \u2716 ${msg}`); exitCode = 1; }

console.log("\n[tracelet] Validating CLI artifact...\n");

// ── 1. dist/cli.js must exist ────────────────────────────────────────────────
if (!fs.existsSync(CLI_PATH)) {
  fail(`dist/cli.js not found — run "npm run build" first`);
} else {
  pass("dist/cli.js exists");

  // ── 2. First line must be the shebang ──────────────────────────────────────
  const content   = fs.readFileSync(CLI_PATH, "utf-8");
  const firstLine = content.split("\n")[0].trimEnd();

  if (firstLine !== SHEBANG) {
    fail(`First line of dist/cli.js is not the shebang.\n       Got: "${firstLine}"\n  Expected: "${SHEBANG}"`);
  } else {
    pass(`Shebang present: ${SHEBANG}`);
  }
}

// ── 3. bin path in package.json resolves correctly ───────────────────────────
try {
  const pkg     = JSON.parse(fs.readFileSync(PKG_PATH, "utf-8"));
  const binPath = pkg.bin && pkg.bin.tracelet;

  if (!binPath) {
    fail(`package.json: "bin.tracelet" is not defined`);
  } else {
    const resolved = path.join(ROOT, binPath);
    if (!fs.existsSync(resolved)) {
      fail(`package.json bin path "${binPath}" resolves to a missing file: ${resolved}`);
    } else {
      pass(`bin.tracelet "${binPath}" resolves correctly`);
    }
  }
} catch (err) {
  fail(`Failed to read package.json: ${err.message}`);
}

console.log(exitCode === 0 ? "\n[tracelet] CLI validation passed ✔\n" : "\n[tracelet] CLI validation FAILED ✖\n");
process.exit(exitCode);
