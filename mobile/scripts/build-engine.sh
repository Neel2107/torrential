#!/usr/bin/env bash
# Builds torrential's engine as the library the app's torrential-engine module loads, and copies it
# into the module: android → jniLibs/arm64-v8a/libtorrential_mobile.so, ios → TorrentialMobile.xcframework
# for devices and the Apple-silicon simulator.
#
#   mobile/scripts/build-engine.sh android|ios
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
module=$root/mobile/modules/torrential-engine
deps=$root/target/mobile-deps
export PATH=/opt/homebrew/opt/rustup/bin:$HOME/.cargo/bin:$PATH
export BOOST_ROOT=$(brew --prefix boost) TORRENTIAL_WEB_DIST=$root/web/dist
"$root/mobile/scripts/build-openssl.sh" "$1" >/dev/null

case $1 in
  android)
    export ANDROID_NDK_HOME=${ANDROID_NDK_HOME:-$(ls -d /opt/homebrew/share/android-commandlinetools/ndk/* | sort | tail -1)}
    export OPENSSL_INCLUDE_DIR=$deps/openssl/android-arm64/include OPENSSL_LIB_DIR=$deps/openssl/android-arm64/lib
    (cd "$root" && cargo ndk -t arm64-v8a -P 24 -o "$module/android/src/main/jniLibs" build --release -p torrential-mobile)
    ;;
  ios)
    "$root/mobile/scripts/build-openssl.sh" ios-sim >/dev/null
    export IPHONEOS_DEPLOYMENT_TARGET=15.1
    for target in ios:aarch64-apple-ios ios-sim:aarch64-apple-ios-sim; do
      dir=$deps/openssl/${target%%:*}-arm64
      (cd "$root" && OPENSSL_INCLUDE_DIR=$dir/include OPENSSL_LIB_DIR=$dir/lib \
        cargo build --release --target "${target#*:}" -p torrential-mobile)
    done
    rm -rf "$module/ios/TorrentialMobile.xcframework"
    xcodebuild -create-xcframework \
      -library "$root/target/aarch64-apple-ios/release/libtorrential_mobile.a" \
      -library "$root/target/aarch64-apple-ios-sim/release/libtorrential_mobile.a" \
      -output "$module/ios/TorrentialMobile.xcframework"
    ;;
  *) echo "usage: build-engine.sh android|ios" >&2; exit 1 ;;
esac
