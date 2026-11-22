#!/usr/bin/env bash
# Measures the release build ("torrential preview") on the Poco F6 and prints one line per metric:
# the median of N runs, the spread, and how many runs produced a number. Run it before and after a
# change, on the same build kind, and append its output to the decision log.
#
#   mobile/scripts/perf-f6.sh cold [runs]     launch to first frame, and launch to Home with data
#   mobile/scripts/perf-f6.sh title [runs]    poster tap to flight, and to the page with data; frames
#   mobile/scripts/perf-f6.sh scroll [runs]   Home scrolled down and up; frames
#   mobile/scripts/perf-f6.sh tabs [runs]     Home to Downloads and back; frames
#   mobile/scripts/perf-f6.sh net [runs]      engine requests and characters received in the 8 s after launch
#
# Taps go through f6-tap.sh, so nothing lands outside the app. Media volume is set to 0 first.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
T=${F6:-100.107.101.1:5555}
P=${PACKAGE:-dev.torrential.app.preview}
A="adb -s $T"
scenario=${1:?cold, title, scroll or tabs}
runs=${2:-7}

$A shell cmd media_session volume --stream 3 --set 0 >/dev/null 2>&1 || true
$A shell input keyevent KEYCODE_WAKEUP

stats() {
  python3 -c '
import statistics, sys
label, values = sys.argv[1], [float(v) for v in sys.argv[2:] if v]
if not values:
    print(f"{label}\tno runs"); sys.exit()
values.sort()
print(f"{label}\tmedian {statistics.median(values):.0f}\tmin {values[0]:.0f}\tmax {values[-1]:.0f}\truns {len(values)}")
' "$@"
}

frames() {
  $A shell dumpsys gfxinfo "$P" | python3 -c '
import re, sys
text = sys.stdin.read()
def grab(name):
    m = re.search(name + r": (\d+(?:\.\d+)?)", text)
    return m.group(1) if m else "?"
janky = re.search(r"Janky frames: (\d+) \(([\d.]+)%\)", text)
print("frames\ttotal " + grab("Total frames rendered") + "\tjanky " + (janky.group(2) + "%" if janky else "?") +
      "\tp50 " + grab("50th percentile").rstrip("ms") + "\tp90 " + grab("90th percentile") + "\tp99 " + grab("99th percentile"))
'
}

perf_line() {
  local label=$1 limit=${2:-15}
  for _ in $(seq $((limit * 5))); do
    line=$($A logcat -d -v epoch -s ReactNativeJS | grep -m1 "\[perf\] $label" || true)
    [ -n "$line" ] && { echo "$line"; return; }
    sleep 0.2
  done
}

find_node() {
  $A shell uiautomator dump /sdcard/perf.xml >/dev/null 2>&1
  $A shell cat /sdcard/perf.xml | python3 -c '
import re, sys
xml, want = sys.stdin.read(), sys.argv[1]
for node in re.finditer(r"<node [^>]*>", xml):
    n = node.group(0)
    if re.search(want, n):
        x1, y1, x2, y2 = map(int, re.search(r"bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"", n).groups())
        print((x1 + x2) // 2, (y1 + y2) // 2); break
' "$1"
}

launch() {
  $A shell input keyevent KEYCODE_WAKEUP
  $A shell am force-stop "$P"
  $A logcat -c
  $A shell am start-activity -W -n "$P/.MainActivity" | sed -n 's/^WaitTime: //p'
}

home() {
  local first
  first=$(launch)
  perf_line "home ready" 20 >/dev/null
  sleep 1.5
  echo "$first"
}

case $scenario in
  cold)
    first=() ready=() js=() session=()
    at() {
      local line
      line=$($A logcat -d -v epoch -s ReactNativeJS | grep -m1 "\[perf\] $1\$" | awk '{print $1}')
      [ -n "$start" ] && [ -n "$line" ] && python3 -c "print(($line - $start) * 1000)"
    }
    for _ in $(seq "$runs"); do
      first+=("$(launch)")
      start=$($A logcat -d -v epoch -b events,main,system | grep -m1 -E "START u0 .*$P" | awk '{print $1}')
      perf_line "home ready" 20 >/dev/null
      ready+=("$(at "home ready")")
      js+=("$(at "js running")")
      session+=("$(at "session loaded")")
      sleep 2
    done
    stats "first frame ms" "${first[@]}"
    stats "js running ms" "${js[@]:-}"
    stats "session loaded ms" "${session[@]:-}"
    stats "home ready ms" "${ready[@]:-}"
    ;;
  title)
    home >/dev/null
    flight=() ready=()
    $A shell dumpsys gfxinfo "$P" reset >/dev/null
    for _ in $(seq "$runs"); do
      xy=$(find_node 'content-desc="[^"]*, rated [^"]*"')
      [ -n "$xy" ] || { echo "no poster found" >&2; break; }
      $A logcat -c
      "$here/f6-tap.sh" $xy
      line=$(perf_line "tap to title ready" 10)
      ready+=("$(sed -n 's/.*tap to title ready \([0-9]*\) ms.*/\1/p' <<<"$line")")
      sleep 1.2
      flight+=("$($A logcat -d -s ReactNativeJS | sed -n 's/.*\[perf\] tap to flight \([0-9]*\) ms.*/\1/p' | head -1)")
      $A shell input keyevent KEYCODE_BACK
      sleep 1.5
    done
    stats "tap to flight ms" "${flight[@]}"
    stats "tap to title ready ms" "${ready[@]}"
    frames
    ;;
  scroll)
    home >/dev/null
    $A shell dumpsys gfxinfo "$P" reset >/dev/null
    for _ in $(seq "$runs"); do
      $A shell input swipe 610 2100 610 700 250
      sleep 0.9
      $A shell input swipe 610 700 610 2100 250
      sleep 0.9
    done
    frames
    ;;
  tabs)
    home >/dev/null
    $A shell dumpsys gfxinfo "$P" reset >/dev/null
    for _ in $(seq "$runs"); do
      xy=$(find_node 'content-desc="Downloads[^"]*"')
      [ -n "$xy" ] || { echo "no Downloads tab found" >&2; break; }
      "$here/f6-tap.sh" $xy
      sleep 1
      xy=$(find_node 'content-desc="Home[^"]*"')
      "$here/f6-tap.sh" $xy
      sleep 1
    done
    frames
    ;;
  net)
    requests=() chars=()
    for _ in $(seq "$runs"); do
      launch >/dev/null
      sleep 8
      $A logcat -d -s ReactNativeJS | grep "\[perf\] net " > /tmp/perf-net.txt || true
      requests+=("$(wc -l < /tmp/perf-net.txt | tr -d ' ')")
      chars+=("$(awk '{for (i = 1; i <= NF; i++) if ($(i + 1) == "B") s += $i} END {print s + 0}' /tmp/perf-net.txt)")
    done
    stats "requests" "${requests[@]}"
    stats "chars received" "${chars[@]}"
    awk '{for (i = 1; i <= NF; i++) if ($i == "net") {route = $(i + 1); n[route]++; c[route] += $(i + 2)}} END {for (r in n) printf "  %s\t%d requests\t%d chars\n", r, n[r], c[r]}' /tmp/perf-net.txt | sort -t$'\t' -k3 -n -r
    ;;
  *)
    echo "unknown scenario $scenario" >&2
    exit 2
    ;;
esac
