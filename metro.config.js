// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle the Excel report template (assets/templates/*.xlsx) as a binary asset.
config.resolver.assetExts.push('xlsx');

module.exports = config;
