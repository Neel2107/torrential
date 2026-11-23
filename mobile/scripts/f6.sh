#!/usr/bin/env bash
# The test phone's everyday chores in one place, so each is one short command.
#
#   scripts/f6.sh serial               the adb serial to use: USB when plugged in, else the first wireless one
#   scripts/f6.sh wake                 wakes the phone and unlocks it with f6-unlock.sh (PIN from $F6_PIN or ~/.config/torrential/f6.env)
#   scripts/f6.sh open <path>          opens torrential-preview://<path>, e.g. title/tt0056923, downloads, settings
#   scripts/f6.sh shot <name> [top bottom]
#                                      saves a screenshot as $F6_SHOTS/<name>.png; with top and bottom (fractions of the
#                                      height, e.g. 0.55 0.75) also saves <name>-crop.png of that band. Prints the paths.
#   scripts/f6.sh find <regex>         prints "x y" at the centre of the first element whose text or description matches
#   scripts/f6.sh tap <regex>          finds that element and taps it through f6-tap.sh; fails when nothing matches
#   scripts/f6.sh logs [regex]         the [perf] lines logged so far (filtered by regex), without logcat's prefix
#   scripts/f6.sh clear                clears logcat, so logs shows only what happens next
#   scripts/f6.sh frames <command...>  resets frame stats, runs the command, prints frames, p50, p90, p99 and the worst frame
#   scripts/f6.sh sheet <out.png> <png...>
#                                      lays screenshots side by side, six to a row, into one image to look at once
#
# Screenshots go to $F6_SHOTS, or a folder in $TMPDIR. Taps go through f6-tap.sh, which refuses when torrential is not
# in front, so nothing lands in another app. Never use this while the phone's owner is using it.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
app=dev.torrential.app.preview
shots=${F6_SHOTS:-${TMPDIR:-/tmp}/f6-shots}

serial() {
  local usb wireless
  usb=$(adb devices | awk 'NR > 1 && $2 == "device" && $1 !~ /:/ {print $1; exit}')
  wireless=$(adb devices | awk 'NR > 1 && $2 == "device" && $1 ~ /:/ {print $1; exit}')
  local found=${usb:-$wireless}
  [ -n "$found" ] || { echo "no phone on adb" >&2; exit 1; }
  echo "$found"
}

S=${F6:-$(serial)}
A="adb -s $S"

dump() {
  for _ in 1 2 3 4 5; do
    if $A shell uiautomator dump /sdcard/f6.xml 2>&1 | grep -q "dumped to"; then
      $A shell cat /sdcard/f6.xml
      return
    fi
    sleep 0.4
  done
  echo "uiautomator could not dump the screen (it waits for the screen to be idle)" >&2
}

find_center() {
  dump | python3 -c '
import re, sys
want = re.compile(sys.argv[1])
for node in re.findall(r"<node [^>]*>", sys.stdin.read()):
    label = " ".join(re.findall(r"(?:text|content-desc)=\"([^\"]*)\"", node))
    if want.search(label):
        x1, y1, x2, y2 = map(int, re.search(r"bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"", node).groups())
        print((x1 + x2) // 2, (y1 + y2) // 2)
        break
' "$1"
}

case ${1:-} in
  serial) echo "$S" ;;
  wake)
    pin=${F6_PIN:-}
    if [ -z "$pin" ] && [ -f ~/.config/torrential/f6.env ]; then
      pin=$(sed -n 's/^F6_PIN=//p' ~/.config/torrential/f6.env)
    fi
    [ -n "$pin" ] || { echo "set F6_PIN or put F6_PIN=... in ~/.config/torrential/f6.env" >&2; exit 1; }
    $A shell input keyevent KEYCODE_WAKEUP
    "$here/f6-unlock.sh" "$S" "$pin"
    ;;
  open)
    $A shell am start -a android.intent.action.VIEW -d "torrential-preview://${2:?path}" "$app" >/dev/null 2>&1
    ;;
  shot)
    name=${2:?name}
    mkdir -p "$shots"
    $A exec-out screencap -p >"$shots/$name.png"
    echo "$shots/$name.png"
    if [ -n "${3:-}" ]; then
      ffmpeg -loglevel error -y -i "$shots/$name.png" \
        -vf "crop=iw:ih*(${4:?bottom}-$3):0:ih*$3" "$shots/$name-crop.png"
      echo "$shots/$name-crop.png"
    fi
    ;;
  find)
    at=$(find_center "${2:?regex}")
    [ -n "$at" ] || { echo "nothing matches ${2}" >&2; exit 1; }
    echo "$at"
    ;;
  tap)
    at=$(find_center "${2:?regex}")
    [ -n "$at" ] || { echo "nothing matches ${2}" >&2; exit 1; }
    F6=$S "$here/f6-tap.sh" $at
    ;;
  logs)
    $A logcat -d -s ReactNativeJS | sed -n 's/.*ReactNativeJS: \(\[perf\].*\)/\1/p' | grep -E "${2:-.}" || true
    ;;
  clear) $A logcat -c ;;
  frames)
    shift
    $A shell dumpsys gfxinfo "$app" reset >/dev/null
    "$@"
    $A shell dumpsys gfxinfo "$app" | python3 -c '
import re, sys
text = sys.stdin.read()
grab = lambda name: (re.search(name + r": (\d+)", text) or [0, "?"])[1]
buckets = text.split("HISTOGRAM:")[1].split("\n")[0] if "HISTOGRAM:" in text else ""
worst = max((int(b) for b, n in re.findall(r"(\d+)ms=(\d+)", buckets) if int(n) > 0), default=0)
print("frames", grab("Total frames rendered"), "p50", grab("50th percentile"), "p90", grab("90th percentile"),
      "p99", grab("99th percentile"), "worst", worst)'
    ;;
  sheet)
    out=${2:?out.png}
    shift 2
    [ $# -gt 0 ] || { echo "no screenshots given" >&2; exit 1; }
    inputs=() scale="" stack="" layout=""
    for i in $(seq 0 $(($# - 1))); do
      inputs+=(-i "${@:$((i + 1)):1}")
      scale+="[$i:v]scale=305:678[s$i];"
      stack+="[s$i]"
      col=$((i % 6)) row=$((i / 6))
      layout+="${layout:+|}$((col * 305))_$((row * 678))"
    done
    if [ $# -eq 1 ]; then
      ffmpeg -loglevel error -y "${inputs[@]}" -vf "scale=305:678" "$out"
    else
      ffmpeg -loglevel error -y "${inputs[@]}" -filter_complex "${scale}${stack}xstack=inputs=$#:layout=$layout:fill=white" "$out"
    fi
    echo "$out"
    ;;
  *)
    sed -n '2,24p' "$0" >&2
    exit 1
    ;;
esac
