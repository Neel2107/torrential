#!/usr/bin/env bash
# Builds torrential's engine as the library the app's torrential-engine module loads, and copies it
# into the module: android → jniLibs/arm64-v8a/libtorrential_mobile.so, ios → an xcframework.
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
  *) echo "usage: build-engine.sh android" >&2; exit 1 ;;
esac
