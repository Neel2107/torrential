#!/usr/bin/env bash
# Builds "torrential preview" (APP_VARIANT=preview) as a release APK with the engine inside, copies it
# to ~/Desktop/torrential-preview.apk, and puts the development Android project back.
#
#   mobile/scripts/build-preview.sh
set -euo pipefail
mobile=$(cd "$(dirname "$0")/.." && pwd)
export JAVA_HOME=${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}
export ANDROID_HOME=${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}
export PATH=/opt/homebrew/opt/node@22/bin:$PATH CI=1

"$mobile/scripts/build-engine.sh" android
cd "$mobile"
APP_VARIANT=preview pnpm exec expo prebuild --platform android --clean >/dev/null
(cd android && APP_VARIANT=preview ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a -q)
cp android/app/build/outputs/apk/release/app-release.apk ~/Desktop/torrential-preview.apk
pnpm exec expo prebuild --platform android --clean >/dev/null
echo "~/Desktop/torrential-preview.apk ($(du -h ~/Desktop/torrential-preview.apk | cut -f1))"
