const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
// Metro debe reconocer los archivos .sql de las migraciones de Drizzle
config.resolver.sourceExts.push('sql');

module.exports = withNativeWind(config, { input: './global.css' });