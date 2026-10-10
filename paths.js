// Where Proof of Life keeps things. Shared by server.js, install.mjs and cli.mjs.
//
// A git clone (or any copy that already holds creatures in ./data) keeps its
// data next to the code, as it always has. A managed copy (npm, npx, a Claude
// Code plugin) is replaced on every update, so its data lives in the home
// folder instead and survives updates: ~/.proof-of-life/data.
//   POL_DATA_DIR  overrides the data folder
//   POL_HOME      overrides ~/.proof-of-life (tests use a temp folder)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;

function homeDir() {
  return path.resolve(process.env.POL_HOME || path.join(os.homedir(), '.proof-of-life'));
}

// a copy npm, npx or Claude Code manages (and may replace on update)
function isManaged(root = ROOT) {
  const p = path.resolve(root) + path.sep;
  const plugin = process.env.CLAUDE_PLUGIN_ROOT;
  return /[\\/](node_modules|_npx)[\\/]/.test(p)
    || /[\\/]\.claude[\\/]plugins[\\/]/.test(p)
    || (!!plugin && p.startsWith(path.resolve(plugin) + path.sep))
    || p === path.join(homeDir(), 'app') + path.sep;
}

function dataDir(root = ROOT) {
  if (process.env.POL_DATA_DIR) return path.resolve(process.env.POL_DATA_DIR);
  const local = path.join(root, 'data');
  if (!isManaged(root) && (fs.existsSync(path.join(root, '.git')) || fs.existsSync(path.join(local, 'state.json')))) return local;
  return path.join(homeDir(), 'data');
}

module.exports = { ROOT, homeDir, isManaged, dataDir };
