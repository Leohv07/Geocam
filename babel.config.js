module.exports = function (api) {
  api.cache(true);
  return {
    // Se conservan los presets de NativeWind; solo se agrega inline-import para las migraciones .sql
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};