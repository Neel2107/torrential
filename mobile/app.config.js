// `APP_VARIANT=preview` builds "torrential preview", a separate app beside the development one, for
// testing from a fresh install and for sharing.
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'preview') return config;
  return {
    ...config,
    name: 'torrential preview',
    scheme: 'torrential-preview',
    android: { ...config.android, package: 'dev.torrential.app.preview' },
    ios: { ...config.ios, bundleIdentifier: 'dev.torrential.app.preview' },
  };
};
