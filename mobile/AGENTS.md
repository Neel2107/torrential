This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

The app installs with pnpm (`pnpm-lock.yaml`). Where Expo's docs say `npx`, use `pnpm exec`.

```bash
pnpm exec expo install <package>  # ALWAYS use instead of pnpm add — resolves SDK-compatible versions
pnpm exec expo start              # start the dev server
pnpm exec oxlint src              # lint (Node 22)
pnpm exec tsc --noEmit            # typecheck
pnpm dlx expo-doctor              # diagnose dependency and config issues
pnpm exec expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building

We build locally, not on EAS. The app runs torrential's engine inside itself, so build the engine library before any native build: `scripts/build-engine.sh android|ios`.

- **Android dev:** `CI=1 pnpm exec expo prebuild --platform android`, then in `android/` run `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a`. Install with `adb install -r`, then `pnpm exec expo start --dev-client` and `adb reverse tcp:8081 tcp:8081`.
- **Android release ("torrential preview"):** `scripts/build-preview.sh` writes `~/Desktop/torrential-preview.apk` and a copy named `torrential-preview-<version>-<build>-<commit>.apk`. It refuses a tree with uncommitted changes. Judge motion and speed here, never in a dev build.
- **Build numbers:** `app.config.js` sets Android's `versionCode` and iOS's `buildNumber` to the commit count (`git rev-list --count HEAD`, or `APP_BUILD`), and `extra.commit` to the short commit. Settings → About shows version, build and commit. Recording a build that passed on a device: `docs/releases.md`.
- **iOS simulator:** `pnpm exec expo run:ios --device <udid>`. For Release, use xcodebuild with `-sdk iphonesimulator ARCHS=arm64 ONLY_ACTIVE_ARCH=YES`, because the engine framework is arm64 only. If the Debug link breaks after a `pod install`, run `CI=1 pnpm exec expo prebuild --platform ios --clean`.

## Commits

Commit straight to `mobile`, one change per commit. CI (`.github/workflows/mobile.yml`) runs `scripts/guard.sh`, `pnpm -s check`, the tests and an Android and iOS bundle on every push.

- **Subject:** at most 72 characters, saying what changed for the person using the app ("mobile: the player remembers subtitle size"). Details go in the body, never in the subject.
- **Body:** why the change was made and what it does that the subject can't say. End it with a `Checked:` line naming the build, device or commands and any number you measured: `Checked: preview build 1042 on the Poco F6, title opens in 212 ms (was 340)`.
- **One change per commit.** A fix found in review is its own commit about that fix, never "review fixes" covering several.
- **Never commit build output** (`build/`, `node_modules/`, `.apk`, `.so`, `.hbc`, `.xcframework/`, the generated `mobile/android/` or `mobile/ios/`). The guard fails on it, and on a hand edit of `web/src/wire.ts` or a raised `--max-warnings` or `--max` in `package.json`. A ceiling that truly has to rise says why on a `Raises-ceiling:` line in the body.
- **Hooks:** run `git config core.hooksPath mobile/scripts/hooks` once per clone. `commit-msg` rejects a subject over 72 characters; `pre-commit` runs the guard on what is staged and `pnpm -C mobile -s check` when a staged file is in `mobile/`. `git commit --no-verify` skips them; CI still runs.
- **Before pushing:** `mobile/scripts/guard.sh` checks your commits not yet on `origin/mobile`.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `pnpm exec expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## This app

- **Check:** `pnpm -s check` runs tsc, oxlint with the anti-slop rules (`.oxlintrc.json`, plugin vendored in `tools/oxlint/anti-slop`, at most 92 warnings, all known debt, no errors), Prettier and `scripts/compiler-check.js`. oxlint's anti-slop plugin is TypeScript, so use Node 22 (`.nvmrc`; on this Mac `/opt/homebrew/opt/node@22/bin`). The compiler check fails when React Compiler skips more components and hooks than it does today (9). Don’t raise that number; fix the cause.
- **Shared values:** read and write them with `.get()` and `.set()`, never `.value`. `.value` makes React Compiler skip the whole component.
- **Inside a worklet** (`useAnimatedStyle`, `useDerivedValue`, gesture callbacks), call only other worklets. A plain helper called there crashes the app on the UI thread in release builds ("Tried to synchronously call a Remote Function"); work the value out in the component and use the result.
- **Worklet to React:** call back from a worklet with `scheduleOnRN` from `react-native-worklets` (`runOnJS` is deprecated). Never call back every frame; use `useAnimatedReaction` at a threshold.
- **Stored and received data:** JSON the app stores is read through its zod schema in `src/engine/stored.ts` (`readStored`), so a file from an older version falls back instead of crashing. Engine replies go through `fromEngine` in `src/engine/client.ts`, the one place that casts them. Any other type assertion needs a `// SAFETY:` line saying why it holds.
- **Names:** only hooks start with `use`. An action named `useX` makes ESLint and React Compiler treat it as a hook (`runOnPhone`, not `usePhone`). React Compiler can't compile `try/finally` yet, so put the cleanup after the `try/catch`.
- **Refs and hook results:** don't read refs while rendering, and don't change a hook's result in place. Set expo-video's properties through `src/player/control.ts`.
- **Motion tokens:** use the ones in `src/theme.ts` (`motion.out`, `motion.inOut`, `motion.press`, `motion.quick`, `motion.tick`) and the springs `motion.settle`, `motion.snap` and `motion.pop`. Springs take a duration and damping ratio, respect reduced motion, and carry the finger's release velocity.
- **What animates:** follow Emil Kowalski's `animate-expo` skill. Nothing used 100+ times a day animates: tab switches, list rows, typing. Never put `entering` on rows of a FlatList or LegendList. Animate `transform` and `opacity`, not layout, except an absolute element with no children.
- **Staggered entrances:** `rise(i)` from `src/ui/rise.ts`. A Reanimated Keyframe keeps the first delay it's built with, so never call `.delay()` on a shared Keyframe.
- **Design:** `docs/design.md` holds the look and the rules (floating surfaces in the glass menu's look, the shared pieces, motion, words). Read it before adding UI.
- **Design system:** fix a row, sheet, header, haptic or motion in its shared piece and move every caller onto it in the same change; never patch one copy. Rows are `OptionRow`, `NavRow` and `ActionRow` (`src/ui/Row.tsx`); sheets with pages use `Pages` and `PageHeader` (`src/ui/Pages.tsx`). Floating surfaces (dialogs, popovers) use `Panel`, `PanelHeading`, `PanelRule` and `PanelRow` from `src/ui/Panel.tsx`, which carry the Android glass menu's look; sheets use the same surface. A row's ··· is `MoreMenu` and its long-press sheet is `ActionSheet` (`src/ui/RowMenu.tsx`), both fed one `RowAction[]`; an action with `ask` confirms before it runs.
- **Sheets:** `src/ui/Sheet.tsx`. Give it a function child to get `close(after)`, which slides the sheet away and then runs what was picked, once. Use `onBack` for sheets with pages and `morph` to ease to a new height.
- **Confirmations:** `ask()` from `src/ui/Ask.tsx`. It shows the native alert on iOS and a `Panel` dialog on Android. Anything destructive asks first.
- **Going back:** use `leave()` from `src/ui/leave.ts`, never `router.back()`. A screen opened from a link has nothing behind it, so `leave()` goes home instead.
- **Platforms:** Android follows X's app (icon tab bar, top bar, FAB, sheets). iOS uses Liquid Glass: NativeTabs, `src/ui/Glass.tsx` and native menus.
- **Speed:** measure with the `measure-android` skill on the release build, before and after a change. `[perf]` logs come from `src/perf.ts` (`mark`, `since`, `lap`). `docs/performance.md` holds the numbers we trust and the backlog.
- **Springs:** a spring's `duration` is perceptual; it runs about 1.5× as long, so anything waiting on its end callback waits longer.
- **Shared values on the JavaScript thread:** reading one in an effect or handler waits for the UI thread. Read them in worklets; keep what JavaScript needs in React state.
- **Loops:** an animation that repeats (skeletons, loading marks) costs every frame for as long as it shows. Drive a group from one value or a Reanimated CSS animation, not one `withRepeat` per piece.
- **Gestures:** Gesture Handler 3 hooks (`usePanGesture`, …) compile under React Compiler; builder chains (`Gesture.Pan()`) don't. New gestures use hooks.
- **Presets:** entrances, exits and reflows use `appear`, `appearAfter(ms)`, `vanish`, `vanishDown` and `reflow` from `src/ui/presets.ts`. Never call `.delay()` or `.duration()` on a shared preset or Keyframe: it changes it for every user.
