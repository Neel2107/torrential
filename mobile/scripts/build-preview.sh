#!/usr/bin/env bash
# Builds "torrential preview" (APP_VARIANT=preview) as a release APK with the engine inside, copies it
# to ~/Desktop/torrential-preview.apk and ~/Desktop/torrential-preview-<version>-<build>-<commit>.apk,
# and puts the development Android project back. It refuses a tree with uncommitted or untracked
# changes, so every APK is exactly one commit, and its build number (Settings → About) is that commit's
# count on the branch.
#
#   mobile/scripts/build-preview.sh
set -euo pipefail
mobile=$(cd "$(dirname "$0")/.." && pwd)

if [ -n "$(git -C "$mobile" status --porcelain)" ]; then
  echo "build-preview.sh: commit or stash these first, so the APK matches a commit:" >&2
  git -C "$mobile" status --short >&2
  exit 1
fi

export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export ANDROID_HOME=${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}
export PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=1
APP_BUILD=$(git -C "$mobile" rev-list --count HEAD)
APP_COMMIT=$(git -C "$mobile" rev-parse --short HEAD)
export APP_BUILD APP_COMMIT
version=$(node -p "require('$mobile/app.json').expo.version")
numbered=~/Desktop/torrential-preview-$version-$APP_BUILD-$APP_COMMIT.apk

"$mobile/scripts/build-engine.sh" android
cd "$mobile"
APP_VARIANT=preview pnpm exec expo prebuild --platform android --clean >/dev/null
(cd android && APP_VARIANT=preview ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a -q)
cp android/app/build/outputs/apk/release/app-release.apk ~/Desktop/torrential-preview.apk
cp ~/Desktop/torrential-preview.apk "$numbered"
pnpm exec expo prebuild --platform android --clean >/dev/null
echo "$numbered ($(du -h "$numbered" | cut -f1)), also at ~/Desktop/torrential-preview.apk"
