#!/usr/bin/env bash
# Publishes the app's JavaScript and assets as an over-the-air update for "torrential preview": runs
# `expo export` for the preview variant and puts it where scripts/ota/server.ts serves it from, under
# the build's runtime version (the native fingerprint, see fingerprint.config.js). A phone only takes
# it when its build has the same runtime version, so an update that needs native changes never reaches
# a build without them; that needs scripts/build-preview.sh instead.
#
#   mobile/scripts/ota-publish.sh [android|ios|all] [--apply]
#
# --apply then opens torrential-preview://update on the phone adb reaches (ANDROID_SERIAL picks one),
# which fetches the update and restarts into it. OTA_DIR is where updates go (the server's OTA_DIR,
# default ~/.local/share/torrential-ota). The last 5 updates per runtime version are kept.
set -euo pipefail
mobile=$(cd "$(dirname "$0")/.." && pwd)
ota=${OTA_DIR:-$HOME/.local/share/torrential-ota}
keep=5

target=android
apply=false
for arg in "$@"; do
  case $arg in
    android | ios) target=$arg ;;
    all) target="android ios" ;;
    --apply) apply=true ;;
    *) echo "usage: ota-publish.sh [android|ios|all] [--apply]" >&2; exit 1 ;;
  esac
done

cd "$mobile"
commit=$(git rev-parse --short HEAD)
[ -z "$(git status --porcelain)" ] || commit=$commit-dirty
export APP_VARIANT=preview APP_COMMIT=$commit APP_BUILD=${APP_BUILD:-$(git rev-list --count HEAD)}

mkdir -p "$ota"
work=$(mktemp -d "$ota/.publish-XXXXXX")
trap 'rm -rf "$work"' EXIT

platforms=()
for platform in $target; do platforms+=(--platform "$platform"); done
pnpm exec expo export "${platforms[@]}" --output-dir "$work/export" >"$work/export.log" 2>&1 ||
  { cat "$work/export.log" >&2; exit 1; }
pnpm exec expo config --type public --json >"$work/export/expoConfig.json"

published_at=$(node -p 'Date.now()')
for platform in $target; do
  runtime=$(pnpm exec expo-updates runtimeversion:resolve --platform "$platform" |
    node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0, "utf8")).runtimeVersion)')
  mkdir -p "$ota/$runtime"
  cp -R "$work/export" "$ota/$runtime/.$published_at"
  mv "$ota/$runtime/.$published_at" "$ota/$runtime/$published_at"
  ls -1 "$ota/$runtime" | grep -E '^[0-9]+$' | sort -rn | tail -n +$((keep + 1)) |
    while read -r old; do rm -rf "${ota:?}/$runtime/$old"; done
  echo "$platform: published $commit as update $published_at for runtime $runtime (Settings → About shows ${runtime:0:12})"
done

if [ "$apply" = true ]; then
  adb shell am start -a android.intent.action.VIEW -d torrential-preview://update dev.torrential.app.preview >/dev/null
  echo "asked the phone to fetch it"
fi
