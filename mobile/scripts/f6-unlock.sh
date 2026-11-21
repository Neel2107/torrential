#!/usr/bin/env bash
# Unlocks the test phone only when its lock screen is showing, so the PIN never lands in an open
# app. Prints what it found.
#
#   scripts/f6-unlock.sh <adb serial> <pin>
set -euo pipefail
serial=$1 pin=$2
locked=$(adb -s "$serial" shell dumpsys trust | grep -m1 -o 'deviceLocked=[01]' || true)
if [ "$locked" != "deviceLocked=1" ]; then
  echo "unlocked already ($locked)"
  exit 0
fi
adb -s "$serial" shell "input keyevent KEYCODE_WAKEUP; sleep 0.4; input keyevent KEYCODE_MENU; sleep 0.8"
if ! adb -s "$serial" shell 'uiautomator dump /sdcard/lock.xml >/dev/null 2>&1; cat /sdcard/lock.xml' | grep -q 'PIN area'; then
  echo "no PIN pad on screen; not typing"
  exit 1
fi
adb -s "$serial" shell "input text $pin; input keyevent KEYCODE_ENTER"
sleep 1
adb -s "$serial" shell dumpsys trust | grep -m1 -o 'deviceLocked=[01]'
