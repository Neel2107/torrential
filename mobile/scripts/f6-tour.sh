#!/usr/bin/env bash
# Walks the app on the test phone and saves a numbered screenshot of every screen and main interaction, plus a
# contact sheet of them all, for design reviews. Taps go through f6.sh, so each step finds its button by label.
#
#   scripts/f6-tour.sh <out dir> [film id] [series id]
#
# Defaults: Charade (tt0056923, public domain) and House of Cards (tt1856010). The tour plays the film for a
# few seconds with media volume at 0, and leaves the phone on Home.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
out=${1:?out dir}
film=${2:-tt0056923}
series=${3:-tt1856010}
f6="$here/f6.sh"
S=$("$f6" serial)
A="adb -s $S"
mkdir -p "$out"
export F6_SHOTS=$out

step() { sleep "${2:-2}"; "$f6" shot "$1" >/dev/null && echo "$1"; }
tap() { "$f6" tap "$1" >/dev/null 2>&1 || { echo "  (no '$1' on screen)"; return 1; }; }
up() { $A shell input swipe 600 2000 600 800 300; }
back() { $A shell input keyevent KEYCODE_BACK; }
hide_keyboard() { $A shell dumpsys input_method | grep -q "mInputShown=true" && back; sleep 0.5; }

$A shell media volume --stream 3 --set 0 >/dev/null 2>&1
"$f6" wake >/dev/null
$A shell am force-stop dev.torrential.app.preview
$A shell am start -n dev.torrential.app.preview/.MainActivity >/dev/null
step 01-home 5
up; step 02-home-scrolled

"$f6" open "search"; step 03-search-idle 2.5
$A shell input text "charade"; step 04-search-results 3
hide_keyboard; tap '^Torrents$'; step 05-search-torrents 3
"$f6" open "title/$film"; step 06-film 3
tap 'Romance and intrigue'; step 07-film-synopsis-open 1
tap 'Choose a source' && { step 08-sources-sheet 4; back; }
if [ -n "$series" ]; then
  "$f6" open "title/$series"
else
  "$f6" open downloads; sleep 2; tap '^Home$'; sleep 2; tap '· Series'
fi
step 09-series 4
up; step 10-series-episodes
up; step 11-series-more-episodes

"$f6" open downloads; step 12-downloads-active 3
tap 'More options' && { step 13-downloads-menu 1.5; back; }
tap '^Finished'; step 14-downloads-finished
tap '^On this phone'; step 15-downloads-on-phone
"$f6" open settings; step 16-settings 2.5
up; step 17-settings-scrolled
"$f6" open engine; step 18-engine 2.5
"$f6" open tv; step 19-tv 3
back
"$f6" open add; step 20-add 2
back
"$f6" open pair; step 21-pair 2
back

"$f6" open "title/$film"; sleep 3
tap '^(Resume|Play)$|^(Resume|Play),'; step 22-player-starting 2
sleep 6
case $($A shell dumpsys input | grep -m1 -o 'SurfaceOrientation: [0-9]' | grep -o '[0-9]$') in
  1 | 3) F6=$S "$here/f6-tap.sh" 1356 610 ;;
  *) F6=$S "$here/f6-tap.sh" 610 1356 ;;
esac
step 23-player-controls 0.6
back; sleep 1
$A shell am start -n dev.torrential.app.preview/.MainActivity >/dev/null

shots=$(ls "$out"/[0-9]*.png | grep -v crop)
"$f6" sheet "$out/sheet.png" $shots >/dev/null && echo "$out/sheet.png"
