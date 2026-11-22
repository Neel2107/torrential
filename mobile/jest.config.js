const preset = require('jest-expo/android/jest-preset');

const SCRIPTS = '\\.[jt]sx?$';
const [babelJest, babelOptions] = preset.transform[SCRIPTS];

/** Tests run the code the Poco F6 runs: the Android build, compiled by React Compiler as Metro compiles it for app.json's `experiments.reactCompiler`. */
module.exports = {
  ...preset,
  transform: {
    ...preset.transform,
    [SCRIPTS]: [babelJest, { ...babelOptions, caller: { ...babelOptions.caller, supportsReactCompiler: true } }],
  },
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  resolver: '<rootDir>/jest.resolver.js',
  setupFiles: [...preset.setupFiles, '<rootDir>/jest.setup.js'],
  cacheDirectory: '<rootDir>/.jest-cache',
};
