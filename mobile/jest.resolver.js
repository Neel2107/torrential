const reactNativeResolver = require('@react-native/jest-preset/jest/resolver');

const REANIMATED_WEB_ONLY = new Set([
  'initializers',
  'mutables',
  'mappers',
  'ConfigHelper',
  'UpdateLayoutAnimations',
  'useAnimatedRef',
  'useAnimatedStyle',
  'WorkletEventHandler',
  'JSPropsUpdater',
  'updateProps',
  'util',
]);

const packageOf = (basedir) => basedir.split('/node_modules/').pop().split('/')[0];

const withoutNative = (options) => ({
  ...options,
  extensions: options.extensions?.filter((extension) => !extension.includes('native')),
});

/**
 * React Native's resolver plus what `react-native-reanimated/jest/resolver.js` (4.7.1) does: Worklets and
 * Reanimated's web-only files resolve without `.native`, so Jest gets the builds that run without a phone.
 * Upstream matches the package name anywhere in the folder path, and pnpm's store folder for Reanimated
 * (`react-native-reanimated@4.7.1_react-native-worklets@0.13.0…`) names Worklets too, which sends every
 * Reanimated file to its web build. This matches the package the file sits in. Recheck the list on a
 * Reanimated upgrade.
 */
module.exports = (request, options) => {
  const from = packageOf(options.basedir);
  const basename = request.split('/').pop();

  const reanimatedWebOnly =
    from === 'react-native-reanimated' &&
    request.startsWith('.') &&
    (REANIMATED_WEB_ONLY.has(basename) || request.endsWith('css/component/AnimatedComponent'));

  const worklets = from === 'react-native-worklets' || request.startsWith('react-native-worklets');

  return reactNativeResolver(request, reanimatedWebOnly || worklets ? withoutNative(options) : options);
};
