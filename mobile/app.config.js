const { execFileSync } = require('node:child_process');

/**
 * The build number is the commit count on the branch (`git rev-list --count HEAD`), so a later commit
 * always installs over an earlier one. Build scripts pass it as `APP_BUILD` and the short commit as
 * `APP_COMMIT`; without them both come from git, and outside a git checkout the build is 1.
 */
function git(...args) {
  try {
    return execFileSync('git', args, { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

function buildNumber() {
  const build = Number.parseInt(process.env.APP_BUILD || git('rev-list', '--count', 'HEAD'), 10);
  return Number.isInteger(build) && build > 0 ? build : 1;
}

/**
 * `APP_VARIANT=preview` builds "torrential preview", a separate app beside the development one, for
 * testing from a fresh install and for sharing.
 */
module.exports = ({ config }) => {
  const build = buildNumber();
  const commit = process.env.APP_COMMIT || git('rev-parse', '--short', 'HEAD') || 'unknown';
  const preview = process.env.APP_VARIANT === 'preview';

  return {
    ...config,
    ...(preview && { name: 'torrential preview', scheme: 'torrential-preview' }),
    android: {
      ...config.android,
      versionCode: build,
      ...(preview && { package: 'dev.torrential.app.preview' }),
    },
    ios: {
      ...config.ios,
      buildNumber: String(build),
      ...(preview && { bundleIdentifier: 'dev.torrential.app.preview' }),
    },
    extra: { ...config.extra, commit },
  };
};
