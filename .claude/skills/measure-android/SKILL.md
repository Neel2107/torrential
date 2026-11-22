---
name: measure-android
description: Measure the torrential app's speed on the Poco F6 from a release build — frame times and jank for an interaction, cold start, startup timing marks, memory, refresh rate, bundle contents, and a system trace. Use before and after any performance change, when someone says the app feels slow, janky or laggy, or when a claim about speed needs numbers.
---

# Measure the app on Android

Numbers come from the release build ("torrential preview", package `dev.torrential.app.preview`) on the Poco F6. A dev build's JavaScript runs about 2.4× slower and hides or invents the problems you're looking for, so never judge speed there.

## Before you start

1. Build and install the release build: `mobile/scripts/build-preview.sh`, then `adb install -r ~/Desktop/torrential-preview.apk`.
2. Find the phone: `adb devices`. At home it's on wireless debugging. Away from home use Tailscale: `adb connect <f6 tailnet ip>:5555`.
3. Don't use the phone while its owner is on it, and keep media volume at 0 at night.
4. Run each measurement at least 5 times and report the median, plus the spread. One run is not a number.
5. Tap only through `mobile/scripts/f6-tap.sh x y`. It refuses unless torrential is in front and the keyboard is closed. A loop of raw `input tap` calls once left the app on a Back press and went on tapping the launcher's dock, where Phone and Camera sit. Search opens the keyboard, which covers the tab bar; close it with Back before tapping tabs, and never press Back on a screen that has nothing to close.

## Frames for one interaction

```sh
P=dev.torrential.app.preview
adb shell dumpsys gfxinfo $P reset
# do the interaction: scroll search, open a title, drag a sheet, scrub the seek bar
adb shell dumpsys gfxinfo $P | sed -n '/Total frames/,/HISTOGRAM/p'
```

Report janky frames %, p50/p90/p99 frame time, and "slow UI thread". Use `dumpsys gfxinfo $P framestats` for per-frame rows.

Check what refresh rate the app actually gets before you aim at 8.3 ms frames: `adb shell dumpsys SurfaceFlinger | grep -iE "refresh|fps"` with the app in front. HyperOS can hold some apps at 60 Hz.

## Cold start

```sh
P=dev.torrential.app.preview
adb shell cmd package compile -f -m speed-profile $P     # or -m verify for the worst case
for i in 1 2 3 4 5; do adb shell am start-activity -S -W -n $P/dev.torrential.app.MainActivity | grep TotalTime; done
```

That is time to first draw. The app's own `[perf]` marks (from `src/perf.ts`) say when Home is usable: `adb logcat -s ReactNativeJS | grep '\[perf\]'`.

## Memory

`adb shell dumpsys meminfo dev.torrential.app.preview | sed -n '/App Summary/,/TOTAL/p'` before and after scrolling poster grids or playing a video.

## Bundle

`cd mobile && EXPO_ATLAS=1 npx expo export --platform android && npx expo-atlas` shows what ships. `unzip -v ~/Desktop/torrential-preview.apk assets/index.android.bundle` should say `Stored`, so Hermes can map it.

## System trace

```sh
adb shell perfetto -o /data/misc/perfetto-traces/t.pftrace -t 10s sched freq gfx view input am wm dalvik
adb pull /data/misc/perfetto-traces/t.pftrace
```

Open it at ui.perfetto.dev. Read the main thread, `RenderThread`, and the JavaScript thread `mqt_v_js`.

## Watching motion

To see an animation frame by frame, record it and step through the frames:

```sh
adb shell screenrecord --time-limit 4 --bit-rate 8000000 /sdcard/m.mp4 & sleep 0.8; <tap>; wait
adb pull /sdcard/m.mp4 && ffmpeg -i m.mp4 -fps_mode passthrough -vf "crop=…,scale=300:-1,tile=8x4" -frames:v 1 frames.png
```

Keep `-fps_mode passthrough`. Without it ffmpeg pads to a constant rate and renumbers frames, so frame indexes stop matching timestamps. Read timestamps with `ffprobe -show_entries frame=pts_time`.

## Reporting

Give before and after medians for the same interaction on the same build kind, say what you changed between them, and say what limits the number (UI thread, JS thread, GPU, network). Record lasting results in `mobile/docs/performance.md`.
