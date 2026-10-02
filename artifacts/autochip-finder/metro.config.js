const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Only watch the lib/ workspace packages (not the entire monorepo root)
// This avoids Metro crawling the enormous root node_modules and running out of memory.
config.watchFolders = [
  path.resolve(projectRoot, '../../lib'),
];

config.resolver.assetExts.push('pdf');

module.exports = config;
