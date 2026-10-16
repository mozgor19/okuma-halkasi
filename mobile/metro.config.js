/* eslint-disable @typescript-eslint/no-require-imports -- Metro loads this config as CommonJS. */
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");
const config = getDefaultConfig(projectRoot);
const toolDirectories = [".agents", ".codex"].map((name) => {
  const directory = path.join(repoRoot, name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${directory}(?:[/\\\\]|$)`);
});

config.watchFolders = [repoRoot];
config.resolver.blockList = [config.resolver.blockList ?? [], toolDirectories].flat();
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(repoRoot, "node_modules")
];

module.exports = config;
