#!/usr/bin/env bash
# Builds static OpenSSL for the phone targets the engine links: Android arm64, iOS devices and the
# Apple-silicon iOS simulator. Each lands in target/mobile-deps/openssl/<target>/{include,lib}.
#
#   mobile/scripts/build-openssl.sh [android|ios|ios-sim ...]
set -euo pipefail
version=3.5.4
root=$(cd "$(dirname "$0")/../.." && pwd)
deps=$root/target/mobile-deps
src=$deps/src/openssl-$version
ndk=${ANDROID_NDK_ROOT:-$(ls -d /opt/homebrew/share/android-commandlinetools/ndk/* | sort | tail -1)}

mkdir -p "$deps/src"
if [ ! -d "$src" ]; then
  curl -fsSL "https://github.com/openssl/openssl/releases/download/openssl-$version/openssl-$version.tar.gz" |
    tar -xz -C "$deps/src"
fi

build() {
  local name=$1 config=$2
  shift 2
  local out=$deps/openssl/$name
  [ -f "$out/lib/libssl.a" ] && { echo "openssl $name: already built"; return; }
  local work=$deps/build/openssl-$name
  rm -rf "$work" && mkdir -p "$work" && cp -R "$src/." "$work"
  (cd "$work" && ./Configure "$config" no-shared no-tests no-docs no-apps --prefix="$out" --libdir=lib "$@" >/dev/null &&
    make -j"$(sysctl -n hw.ncpu)" >/dev/null && make install_sw >/dev/null)
  echo "openssl $name: $out"
}

for target in "${@:-android ios ios-sim}"; do
  for t in $target; do
    case $t in
      android)
        ANDROID_NDK_ROOT=$ndk PATH="$ndk/toolchains/llvm/prebuilt/darwin-x86_64/bin:$PATH" \
          build android-arm64 android-arm64 -D__ANDROID_API__=24 ;;
      ios) build ios-arm64 ios64-xcrun -mios-version-min=15.1 ;;
      ios-sim) build ios-sim-arm64 iossimulator-arm64-xcrun -mios-simulator-version-min=15.1 ;;
      *) echo "unknown target $t" >&2; exit 1 ;;
    esac
  done
done
