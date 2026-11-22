This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building

We build locally, not on EAS. The app runs torrential's engine inside itself, so build the engine library before any native build: `scripts/build-engine.sh android|ios`.

- **Android dev:** `CI=1 npx expo prebuild --platform android`, then in `android/` run `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a`. Install with `adb install -r`, then `npx expo start --dev-client` and `adb reverse tcp:8081 tcp:8081`.
- **Android release ("torrential preview"):** `scripts/build-preview.sh` writes `~/Desktop/torrential-preview.apk`. Judge motion and speed here, never in a dev build.
- **iOS simulator:** `npx expo run:ios --device <udid>`. For Release, use xcodebuild with `-sdk iphonesimulator ARCHS=arm64 ONLY_ACTIVE_ARCH=YES`, because the engine framework is arm64 only. If the Debug link breaks after a `pod install`, run `CI=1 npx expo prebuild --platform ios --clean`.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## This app

- **Check:** `npm run -s check` runs tsc, ESLint (`eslint.config.js`, at most 37 warnings, all known debt), Prettier and `scripts/compiler-check.js`. The compiler check fails when React Compiler skips more components and hooks than it does today (9). Don’t raise that number; fix the cause.
- **Shared values:** read and write them with `.get()` and `.set()`, never `.value`. `.value` makes React Compiler skip the whole component.
- **Worklet to React:** call back from a worklet with `scheduleOnRN` from `react-native-worklets` (`runOnJS` is deprecated). Never call back every frame; use `useAnimatedReaction` at a threshold.
- **Names:** only hooks start with `use`. An action named `useX` makes ESLint and React Compiler treat it as a hook (`runOnPhone`, not `usePhone`). React Compiler can't compile `try/finally` yet, so put the cleanup after the `try/catch`.
- **Refs and hook results:** don't read refs while rendering, and don't change a hook's result in place. Set expo-video's properties through `src/player/control.ts`.
- **Motion tokens:** use the ones in `src/theme.ts` (`motion.out`, `motion.inOut`, `motion.press`, `motion.quick`, `motion.tick`) and the springs `motion.settle`, `motion.snap` and `motion.pop`. Springs take a duration and damping ratio, respect reduced motion, and carry the finger's release velocity.
- **What animates:** follow Emil Kowalski's `animate-expo` skill. Nothing used 100+ times a day animates: tab switches, list rows, typing. Never put `entering` on rows of a FlatList or LegendList. Animate `transform` and `opacity`, not layout, except an absolute element with no children.
- **Staggered entrances:** `rise(i)` from `src/ui/rise.ts`. A Reanimated Keyframe keeps the first delay it's built with, so never call `.delay()` on a shared Keyframe.
- **Design system:** fix a row, sheet, header, haptic or motion in its shared piece and move every caller onto it in the same change; never patch one copy. Rows are `OptionRow`, `NavRow` and `ActionRow` (`src/ui/Row.tsx`); sheets with pages use `Pages` and `PageHeader` (`src/ui/Pages.tsx`).
- **Sheets:** `src/ui/Sheet.tsx`. Give it a function child to get `close(after)`, which slides the sheet away and then runs what was picked, once. Use `onBack` for sheets with pages and `morph` to ease to a new height.
- **Confirmations:** `ask()` from `src/ui/Ask.tsx`. It shows the native alert on iOS and the app's own dialog on Android.
- **Going back:** use `leave()` from `src/ui/leave.ts`, never `router.back()`. A screen opened from a link has nothing behind it, so `leave()` goes home instead.
- **Platforms:** Android follows X's app (icon tab bar, top bar, FAB, sheets). iOS uses Liquid Glass: NativeTabs, `src/ui/Glass.tsx` and native menus.
- **Speed:** measure with the `measure-android` skill on the release build, before and after a change. `[perf]` logs come from `src/perf.ts` (`mark`, `since`, `lap`). `docs/performance.md` holds the numbers we trust and the backlog.
- **Springs:** a spring's `duration` is perceptual; it runs about 1.5× as long, so anything waiting on its end callback waits longer.
- **Shared values on the JavaScript thread:** reading one in an effect or handler waits for the UI thread. Read them in worklets; keep what JavaScript needs in React state.
- **Loops:** an animation that repeats (skeletons, loading marks) costs every frame for as long as it shows. Drive a group from one value or a Reanimated CSS animation, not one `withRepeat` per piece.
- **Gestures:** Gesture Handler 3 hooks (`usePanGesture`, …) compile under React Compiler; builder chains (`Gesture.Pan()`) don't. New gestures use hooks.
- **Presets:** entrances, exits and reflows use `appear`, `appearAfter(ms)`, `vanish`, `vanishDown` and `reflow` from `src/ui/presets.ts`. Never call `.delay()` or `.duration()` on a shared preset or Keyframe: it changes it for every user.
