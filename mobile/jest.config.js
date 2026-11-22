const preset = require('jest-expo/android/jest-preset');

const SCRIPTS = '\\.[jt]sx?$';
const [babelJest, babelOptions] = preset.transform[SCRIPTS];
const compiled = [babelJest, { ...babelOptions, caller: { ...babelOptions.caller, supportsReactCompiler: true } }];

/** Tests run the code the Poco F6 runs: the Android build, compiled by React Compiler as Metro compiles it for app.json's `experiments.reactCompiler`. lucide-react-native ships its icons as ES modules (`.mjs`), so those are compiled too. */
module.exports = {
  ...preset,
  transform: {
    ...preset.transform,
    [SCRIPTS]: compiled,
    '\\.mjs$': compiled,
  },
  transformIgnorePatterns: preset.transformIgnorePatterns.map((pattern) =>
    pattern.replace('(?!(.pnpm|', '(?!(.pnpm|lucide-react-native|'),
  ),
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  resolver: '<rootDir>/jest.resolver.js',
  setupFiles: [...preset.setupFiles, '<rootDir>/jest.setup.js'],
  cacheDirectory: '<rootDir>/.jest-cache',
};
