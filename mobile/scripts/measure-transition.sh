#!/usr/bin/env bash
# Measures how a tap that opens a screen feels on the iOS simulator: how long from the first frame
# the tap changes to the frame the transition starts moving, how long the motion lasts, and the
# longest run of identical frames inside it (a stall). Records the screen with agent-device.
#
#   scripts/measure-transition.sh <agent-device> <x> <y> [runs]
#
# x and y are the tap in points. The app is relaunched before each run.
set -euo pipefail
device=$1 x=$2 y=$3 runs=${4:-3}
out=$(mktemp -d)

for run in $(seq 1 "$runs"); do
  "$device" open dev.torrential.app --relaunch --metro-port 8081 >/dev/null 2>&1
  sleep 7
  "$device" record start --scope device "$out/$run.mp4" >/dev/null 2>&1
  sleep 0.5
  "$device" press "$x" "$y" >/dev/null 2>&1
  sleep 1.6
  "$device" record stop >/dev/null 2>&1
  sleep 1
  ffmpeg -v error -i "$out/$run.mp4" -vf "scale=200:-1,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=$out/$run.txt" -f null -
  python3 - "$out/$run.txt" "$run" <<'EOF'
import re, sys
times, diffs = [], []
for line in open(sys.argv[1]):
    if m := re.search(r'pts_time:([\d.]+)', line): times.append(float(m.group(1)))
    if m := re.search(r'YAVG=([\d.]+)', line): diffs.append(float(m.group(1)))
changed = [i for i, d in enumerate(diffs) if d > 0.05]
moving = [i for i, d in enumerate(diffs) if d > 2.0]
if not changed or not moving:
    print(f"run {sys.argv[2]}: no transition seen"); sys.exit()
first, start, end = changed[0], moving[0], max(i for i in changed if i >= moving[0])
stall = run = 0
for d in diffs[start:end + 1]:
    run = run + 1 if d <= 0.05 else 0
    stall = max(stall, run)
frame = (times[-1] - times[0]) / max(len(times) - 1, 1)
ms = lambda n: round(n * frame * 1000)
print(f"run {sys.argv[2]}: tap→motion {ms(start - first)} ms, motion {ms(end - start)} ms, longest stall {ms(stall)} ms")
EOF
done
