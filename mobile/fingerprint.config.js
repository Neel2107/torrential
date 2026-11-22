const { execFileSync } = require('node:child_process');

/**
 * The preview build's runtime version is this fingerprint, so an update reaches only a build whose
 * native code it was made for. The engine is native code built outside this folder
 * (`scripts/build-engine.sh` from `crates/`, `vendor/libtorrent` and the web app it embeds), so its
 * committed sources count through their git object ids; the library the script copies into
 * `modules/torrential-engine` doesn't, because only the Mac has it. `extra` carries the commit, which
 * changes with every commit without changing native code.
 */
const ENGINE_SOURCES = [
  'crates',
  'Cargo.toml',
  'Cargo.lock',
  'vendor/libtorrent',
  'web',
  'mobile/scripts/build-engine.sh',
  'mobile/scripts/build-openssl.sh',
];

function engineSources() {
  return execFileSync('git', ['rev-parse', ...ENGINE_SOURCES.map((path) => `HEAD:${path}`)], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'inherit'],
  })
    .toString()
    .trim()
    .split('\n')
    .map((id, index) => `${ENGINE_SOURCES[index]} ${id}`)
    .join('\n');
}

/** @type {import('expo/fingerprint').Config} */
module.exports = {
  sourceSkips: [
    'PackageJsonAndroidAndIosScriptsIfNotContainRun',
    'ExpoConfigVersions',
    'ExpoConfigRuntimeVersionIfString',
    'EasJson',
    'Easignore',
    'AutolinkingConfigPaths',
    'ExpoConfigExtraSection',
  ],
  ignorePaths: [
    'modules/torrential-engine/android/src/main/jniLibs/**/*',
    'modules/torrential-engine/ios/TorrentialMobile.xcframework/**/*',
    'modules/*/android/build/**/*',
  ],
  extraSources: [{ type: 'contents', id: 'torrential-engine-sources', contents: engineSources(), reasons: ['engine'] }],
};
