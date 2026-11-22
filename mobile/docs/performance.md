# Performance

What we know about the app's speed and what to do next, in order. The `measure-android` skill (`.claude/skills/measure-android`) says how to measure; record lasting results here.

## What the evidence says (researched 2026-11-22)

- **Animation cost on mid-range Android** (Expo blog, "The real cost of React Native animations", 2026-04-28; Moto G8 Plus, release build, flags on, ms per frame):

  | Animated views | Reanimated shared values | Reanimated CSS | RN Animated | react-native-ease |
  | -------------- | ------------------------ | -------------- | ----------- | ----------------- |
  | 10             | 7.25                     | 5.56           | 5.13        | 2.34              |
  | 100            | 11.98                    | 10.26          | 9.93        | 3.92              |
  | 500            | 39.94                    | 23.29          | 21.85       | 6.63              |
  - Debug builds overstate Reanimated's cost about 2.4× (28.6 against 11.9 ms at 50 views).
  - Every Reanimated frame commits through the shadow tree, even for transform and opacity. The `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` flag skips that commit: -11% for shared values and -19% for CSS at 50 views.
  - Discord measured 26% less Android jank with these flags plus the settled-animation fix, which is already the default in Reanimated 4.7.

- **One-shot motion is cheap; loops and lists are not.** Ambient loops (skeletons, loading marks) and anything repeated per row are where the choice of tool matters.
- **Spring durations are perceptual.** A spring with `duration: 300` runs about 450 ms, so callbacks at its end fire later than the number says.
- **Reading a shared value on the JavaScript thread** (in an effect or handler) waits for the UI thread.
- **Gesture Handler 3.3** has hook gestures (`usePanGesture`, …) that React Compiler can compile, and a native `Touchable` whose press scale and highlight run without JavaScript. Builder gestures (`Gesture.Pan()…`) are why the seek bar, the player swipes and pull-to-refresh aren't compiled.
- **Lists:** FlashList v2 is installed but unused. It needs no size estimates on the New Architecture.
- **Bundle:** the release bundle ships every Lucide icon (about 1,600; `LucideBeerOffIcon` is in it), so the barrel import isn't tree-shaken. 21 Inter font files (7.5 MB) ship for the 4 weights used, and `useFonts` holds the first render until they load.

## Backlog, in order

1. **Measure interactions on the F6** for search scroll, opening a title, player seek and sheet drag (gfxinfo, cold start, meminfo). Check the refresh rate the app gets.
2. **Loops:** one driver per skeleton group or a Reanimated CSS keyframe, instead of a `withRepeat` per bone (`Skeleton`, then `Bands`, `pull`, `tv`).
3. **Press:** move `Tap` to Gesture Handler's `Touchable`, then try `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`. React Native's `Pressable` on a transformed view can drop presses with that flag on, which is why `Tap` goes first.
4. **Gestures:** move `SeekBar`, `swipes` and `pull` to hook gestures. Keep the scrub on the UI thread, and don't call back to React every frame.
5. **Latest-value refs:** replace with `useEffectEvent` in `session.tsx`, `recovery.tsx` and `timeline.ts`.
6. **Search results:** FlashList v2 with `getItemType`, measured against today's FlatList.
7. **Release config** through `expo-build-properties`:
   - `enableShrinkResourcesInReleaseBuilds`;
   - `gifEnabled: false` and `webpEnabled: false`, since only expo-image draws images.
8. **Images:** `decodeFormat="rgb"` on opaque posters and backdrops.
9. **Worklets Bundle Mode:** compare memory and cold start.
10. **HyperOS:** keep the engine's service alive on the F6 (battery exemption, re-check on every return to the app).
11. **iOS 27:** test the player's landscape lock and the default Liquid Glass stack header.

## Done

- **Launch, bytes and lag, 2026-11-23** (Poco F6, release build, `scripts/perf-f6.sh`; medians, runs measured back to back):
  - Launch to Home with data: 769 → 525 ms (−32%). The phone's engine starts with the app process (−71 ms); Home and Popular draw their last answer kept on disk (`src/engine/kept.ts`, −117 ms); Metro inline requires run modules on first use (JavaScript runs 55 ms sooner).
  - Requests after launch: 4 requests and 41 KB → 2 and 54 characters. Title pages are kept on disk through one `titleQuery`, and New episodes treats a show's page as fresh for six hours.
  - Glancing at a title: 140 KB → 19 KB over five looks. Its sources are searched only after 1.5 s on the page (`useLingered`); a stay still warms Play.
  - Opening a show: the frame it lands on fell from about 100 ms (82 ms mounting every episode row) to p99 32 ms; rows mount a few per frame (`useGrowing`) and only the first four rise in.
  - Not worth a change: press-in prefetch during scrolls (one 1.6 KB request in 12 swipes); a synchronous session read (the keystore can't read while the phone is locked, which must never look unpaired).
  - Player, Night of the Living Dead on the phone's engine: first play 34.4 s to the first frame (sources searched at 0.7 s, playing at 8.8 s, then 25.6 s for the first pieces from the swarm); played again, 0.7 s (playing at 67 ms). The cold start is the swarm, not the app; the player UI stays at p99 19 ms throughout.
  - First switch to Downloads after a launch: one frame of about 90-110 ms, 59 ms of it creating the first native glass menu view (the rows' ···). A baseline profile for the app's modules took 10 ms off; loading the module's classes in the background made it worse and was dropped. Next: one shared native menu opened on press instead of one native view per row.
  - Search: a search Search has answered before shows on the first keystroke (3–5 ms, from memory or kept on disk). A fresh one goes out 300 ms after the last keystroke (was 347: the request waited for the render that swaps in the loading rows; the pause's timer now starts it), the engine answers in 0.46–1.2 s (Cinemeta and IMDb), and the rows draw 30–45 ms later. A 100 ms pause was tried and dropped: the engine finishes a search the app has given up on (its connection loop has no watch for a hang-up), so a short pause sends a full lookup per keystroke.
  - Cold first play of Charade on the phone's engine: playing at 4.2 s, first frame at 10.1 s. Night of the Living Dead's 34 s was its swarm. Two requests left the start path: online subtitles (two lookups, 15.7 KB, now only when a wanted language isn't in the file or the subtitle sheet opens) and Home plus the title page (3.3 KB, refetched mid-start because the leave-the-player cleanup also ran when the duration arrived; now an effect event). Resuming: first frame 1.1 s. `/api/media` stays open about 24 s on a cold start while the engine reads 2 MB from each end of the file; left alone, since it is how Android spots DTS and TrueHD audio and the engine fetches the tail first anyway.
  - Method: the phone drifts within an hour (battery, heat, downloads), so compare builds measured back to back, never against an old number. A launch behind the lock screen waits for SecureStore; the script wakes the phone first.

- **Interactions, 2026-11-22** (Poco F6 at 120 Hz, release build, 5 runs each, medians):
  - Home scroll: p50 7 ms, p99 15 ms, 0.4% janky. Title page scroll: p99 9 ms. Fine.
  - Opening a title: worst frame 31 → 21 ms after icons stopped going through react-native-svg. On Android, react-native-svg draws every SVG into a bitmap on the main thread (`SvgView.drawOutput`), about 0.5 ms per icon, and 19 ms of one frame went to icons. `Icon` now hands Lucide's paths to `modules/glyph-android`, which records them on the hardware canvas. What's left is the screen mount (about 13 ms) and GPU fill while the page fades in over Home.
  - Opening the source sheet: worst frame 65 → 57 ms after the list became a FlatList without per-row `entering`/`layout` animations; 44 ms when the app is fully compiled (`cmd package compile -m speed`), so about a quarter is code the phone hasn't compiled yet after a sideload. The rest is mounting and drawing text (84 text draws, 29 measures). It lands before the sheet moves, as tap delay, not as stutter mid-slide.
  - Switching between Home and Downloads: p50 7 ms, p99 23 ms, about one late frame per switch (the switch frame itself, 15–21 ms); the rest of the 200 ms burst is the tab icon's press feedback.
  - Search focuses its field when you switch to it, and the blinking caret redraws the whole window twice a second (6–13 ms each) while it's open. That's a battery cost, not stutter.
  - After every `adb install`, measure twice: as installed (`speed-profile` from the baseline profile) and after `cmd package compile -f -m speed`, and say which.

- **Cold start, 2026-11-22** (Poco F6, release build compiled with `speed-profile`, 6 cold starts each, medians):
  - Process start → JavaScript running: 970 → 300 ms.
  - First frame (`am start -W` WaitTime): 3,060 → 555 ms.
  - Bundle: 6.3 → 4.4 MB. APK: 77.5 → 73.3 MB.
  - Changes: Lucide icons are imported one by one, so the barrel no longer ships 1,600 icons (ESLint now rejects the barrel). Android has the 4 Inter weights built in through the expo-font plugin and renders without waiting on `useFonts`. iOS loads only those 4 weights.

- React Compiler compiled everything but 63 places at the start of 2026-11-22; it skips 9 now. `pnpm check` fails if that number rises.
- Shared values use `.get()`/`.set()`, worklets call back with `scheduleOnRN`, springs are tokens, and entrances, exits and reflows come from `src/ui/presets.ts`.
