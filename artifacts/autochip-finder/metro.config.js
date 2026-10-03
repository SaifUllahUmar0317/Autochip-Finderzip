const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

// Support PDF assets
config.resolver.assetExts.push('pdf');

module.exports = config;
