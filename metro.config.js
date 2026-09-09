const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// The prebuilt SQLite catalogue ships as a bundle asset (ADR-003). Metro does not treat .db as an
// asset by default, so without this the require() in app/_layout.tsx resolves to nothing.
config.resolver.assetExts.push('db')

// expo-sqlite's web build loads wa-sqlite as a .wasm asset; Metro does not bundle .wasm by default.
config.resolver.assetExts.push('wasm')

module.exports = config
