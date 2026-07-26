const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const aliases = {
    '@': path.resolve(__dirname, 'src'),
    '@app': path.resolve(__dirname, 'app'),
    '@ui': path.resolve(__dirname, 'src/ui'),
    '@core': path.resolve(__dirname, 'src/core'),
    '@domain': path.resolve(__dirname, 'src/domain'),
    '@data': path.resolve(__dirname, 'src/data'),
  };

  for (const [alias, aliasDir] of Object.entries(aliases)) {
    if (moduleName === alias || moduleName.startsWith(alias + '/')) {
      const relative = moduleName === alias ? '' : moduleName.slice(alias.length);
      const basePath = aliasDir + relative;

      const extensions = ['.ts', '.tsx', '.js', '.jsx'];

      for (const ext of extensions) {
        try {
          if (fs.statSync(basePath + ext).isFile()) {
            return { type: 'sourceFile', filePath: basePath + ext };
          }
        } catch {}
      }

      for (const ext of extensions) {
        try {
          const idx = basePath + '/index' + ext;
          if (fs.statSync(idx).isFile()) {
            return { type: 'sourceFile', filePath: idx };
          }
        } catch {}
      }
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
