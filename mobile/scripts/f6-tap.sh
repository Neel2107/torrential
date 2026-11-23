#!/bin/sh
# Taps the F6 only while torrential is in front and no keyboard covers the screen, so a loop of taps can't land in another app.
# Usage: scripts/f6-tap.sh <x> <y> [--keyboard-ok]
set -eu
T=${F6:-$("$(dirname "$0")/f6.sh" serial)}
PACKAGE=${PACKAGE:-dev.torrential.app.preview}

focus=$(adb -s "$T" shell dumpsys window | grep -m1 mCurrentFocus || true)
case "$focus" in
  *"$PACKAGE/"*) ;;
  *) echo "f6-tap: refusing, $PACKAGE is not in front: $focus" >&2; exit 1 ;;
esac

if [ "${3:-}" != "--keyboard-ok" ] && adb -s "$T" shell dumpsys input_method | grep -q "mInputShown=true"; then
  echo "f6-tap: refusing, the keyboard is open" >&2
  exit 1
fi

adb -s "$T" shell input tap "$1" "$2"
