const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// The web app's wire types and pure helpers are shared, not copied, so both clients follow the engine.
config.watchFolders = [path.resolve(__dirname, '../web/src')];

module.exports = config;
