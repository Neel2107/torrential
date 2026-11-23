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
- **Where:** the native builds and `build-engine.sh` run on the owner's Mac only (Homebrew, Xcode). On Linux, `pnpm -s check` and `pnpm exec expo export` work, which is what CI runs.
- **iOS simulator:** `pnpm exec expo run:ios --device <udid>`. For Release, use xcodebuild with `-sdk iphonesimulator ARCHS=arm64 ONLY_ACTIVE_ARCH=YES`, because the engine framework is arm64 only. If the Debug link breaks after a `pod install`, run `CI=1 pnpm exec expo prebuild --platform ios --clean`.

## OTA updates

"torrential preview" takes over-the-air updates of its JavaScript and assets from `scripts/ota/server.ts` on the owner's Linux machine, over Tailscale only (`http://100.87.229.89:8790/manifest`). No Expo account or EAS. The development app never does (`updates.enabled: false`).

- **When OTA is allowed:** changes to JavaScript (`src/`, `@web/*` imports) and assets only. Anything native needs `scripts/build-preview.sh`: a new or upgraded package with native code, a config plugin or `app.json`/`app.config.js` change, `modules/`, or the engine (`crates/`, `vendor/libtorrent`, `web/`, which the engine embeds). The runtime version is the native fingerprint (`fingerprint.config.js`), so an update made after a native change gets a new runtime version and no installed build takes it.
- **Publish:** `scripts/ota-publish.sh` (Android; `ios` or `all` for the others) exports the preview variant into `~/.local/share/torrential-ota/<runtime version>/<time>/` and prints the runtime version. It works on an uncommitted tree; Settings shows the commit as `<sha>-dirty`. About 35 seconds for Android on this machine.
- **Apply on the phone:** Settings → About → Check for update fetches it and restarts. Or `torrential-preview://update`: `adb shell am start -a android.intent.action.VIEW -d torrential-preview://update dev.torrential.app.preview`, which `scripts/ota-publish.sh --apply` runs for you. The app never checks on its own (`checkAutomatically: 'NEVER'`), so launch makes no update request.
- **Check it reached the phone:** the small line under Version in About reads `Build <n> · <commit> · <bundle> · <runtime>`: the commit is the update's, not the build's; the bundle is `Built in` or `Update, <time>`; the runtime is the first 12 characters, which must match what `ota-publish.sh` and `build-preview.sh` print. If the runtime doesn't match, the phone needs a new build; `pnpm exec expo-updates fingerprint:generate --platform android` on both machines shows which source differs.
- **Measurements:** a perf number says whether the bundle came by OTA (the line under Version in About) or is the one built in. Judge a change's speed on a build too before calling it done; an OTA bundle is the same Hermes bytecode, but its first launch copies the update in.
- **The server:** `scripts/ota/install-service.sh` installs it as the systemd user service `torrential-ota` (logs: `journalctl --user -u torrential-ota -f`); run it again after changing the server. By hand: `node scripts/ota/server.ts`. `pnpm test:tools` runs its tests. Updates aren't signed: the server listens only on the tailnet, and the key would sit on the same machine as the server, so signing would only stop someone who could already publish.

## Commits

Commit straight to `mobile`, one change per commit. CI (`.github/workflows/mobile.yml`) runs `scripts/guard.sh`, `pnpm -s check`, the tests (network budgets included) and an Android and iOS bundle with its size budget on every push.

- **Subject:** at most 72 characters, saying what changed for the person using the app ("mobile: the player remembers subtitle size"). Details go in the body, never in the subject.
- **Body:** why the change was made and what it does that the subject can't say. End it with a `Checked:` line naming the build, device or commands and any number you measured: `Checked: preview build 1042 on the Poco F6, title opens in 212 ms (was 340)`.
- **One change per commit.** A fix found in review is its own commit about that fix, never "review fixes" covering several.
- **Never commit build output** (`build/`, `node_modules/`, `.apk`, `.so`, `.hbc`, `.xcframework/`, the generated `mobile/android/` or `mobile/ios/`). The guard fails on it, and on a hand edit of `web/src/wire.ts`, a raised `--max-warnings` or `--max` in `package.json`, or a raised or dropped budget (see Budgets). A ceiling that truly has to rise says why on a `Raises-ceiling:` line in the body.
- **Hooks:** run `git config core.hooksPath mobile/scripts/hooks` once per clone. `commit-msg` rejects a subject over 72 characters; `pre-commit` runs the guard on what is staged and `pnpm -C mobile -s check` when a staged file is in `mobile/`. `git commit --no-verify` skips them; CI still runs.
- **Before pushing:** `mobile/scripts/guard.sh` checks your commits not yet on `origin/mobile`.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `pnpm exec expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Tests

- **Where:** app tests sit next to the code they test, as `src/**/*.test.ts(x)`. Shared helpers live in `src/test/`. The oxlint rules' tests sit next to each rule in `tools/oxlint/anti-slop/rules/`.
- **Commands:** `pnpm test` runs the app's tests with jest-expo, as Android and through React Compiler, so they run the code the phone runs. `pnpm test:tools` typechecks the lint plugin and runs its rules' tests with vitest. Both, and `pnpm -s check`, pass before a change is done.
- **The engine:** tests never mock modules (`anti-slop/no-module-mocking`). Call `answer()` from `src/test/engine.ts` to answer the requests `src/engine/client.ts` sends through its `transport`, as the engine would: `json()` for a route's reply, `refusal()` for the `{ "error": … }` envelope, `inPieces()` and `inBytes()` for a stream that arrives in chunks. `answer()` returns what was asked, and the real transport comes back after each test.
- **Wire data:** build engine types with the builders in `src/test/wire.ts` (`aJob`, `aRelease`, `aPosition`, `anError`), which start from a valid value and change only what the test names. Add a builder there rather than casting.
- **Components:** RNTL 14's `render` is async; `await` it. Assert what a person sees or hears (text, role, accessibility value), not props or state.
- **Names:** a test's name is a sentence saying the behaviour, such as "a last line with no newline after it still arrives".
- **Fixes:** a fix in pure code (parsing, stored data, wire handling, anything without UI) comes with a test that failed before the fix and passes after it.
- **Lint rules:** a change to a rule in `tools/oxlint/anti-slop` comes with RuleTester cases next to it. The plugin is vendored from dmmulroy/anti-slop; its `UPSTREAM.md` says from which commit and which rules are ours. To update it, follow `UPDATE.md` beside it and record the new commit in `UPSTREAM.md`.
- **Worklets:** `anti-slop/no-js-call-in-worklet` reports a plain function called inside a worklet. Its description lists what it misses, so a clean run is not proof.

## Budgets

Speed the owner has measured on the F6 is kept from slipping by budgets CI checks on every push.

- **Network:** `src/perf/budgets.test.tsx` renders the app's own route files under Expo Router, answers every request as the engine would (the `transport` seam, typed fixtures, a short delay before each answer) and counts requests and characters per route in fixed scenarios: first launch with and without saved shows, the second launch 5 h and 50 min later, a 0.8 s glance at a title, staying 2 s, and opening a show. `src/perf/budgets.ts` holds the most each scenario may ask of each route; a route a scenario doesn't list may not be asked at all. `pnpm test` runs it, in about 5 s, or 40 s with a cold Jest cache. It fails naming the scenario, route and numbers. With `TORRENTIAL_BUDGET_REPORT_PATH` set it writes a markdown table there, which CI adds to the step summary even when the job fails.
- **Bundle:** after `expo export`, `node scripts/bundle-budget.js dist` fails when the Android or iOS Hermes bundle is over its size in `src/perf/bundle.json` (set at the size when written, plus 2%), and adds both to the step summary.
- **Raising one:** lowering a budget is always fine. Raising a number, adding a route to a scenario or dropping a scenario fails the guard unless the commit body says why on a `Raises-ceiling:` line. Never raise one to make a slower change pass; fix the cause.
- **A new win:** add a scenario that fails without it (break the code on purpose to see it fail, then put it back), and set its budget at what it measures.
- **The phone:** CI has no phone, so launch time, frames and transitions are not budgeted. Measure them by hand with `scripts/perf-f6.sh` on the release build before a build ships, before and after a change, and record the numbers in `docs/performance.md`.

## This app

- **Check:** `pnpm -s check` runs tsc, oxlint with the anti-slop rules (`.oxlintrc.json`, plugin vendored in `tools/oxlint/anti-slop`, at most 92 warnings, all known debt, no errors), Prettier and `scripts/compiler-check.js`. oxlint's anti-slop plugin is TypeScript, so use Node 22 (`.nvmrc`; on this Mac `/opt/homebrew/opt/node@22/bin`). The compiler check fails when React Compiler skips more components and hooks than it does today (9). Don’t raise that number; fix the cause.
- **No comments in code:** lint (`anti-slop/no-comments`) rejects `//` and `/* */` comments in `src`. Name things so the code reads on its own; a rule the code can't show goes in a `/** */` doc comment on what it describes. `// SAFETY:` lines and tool directives (`oxlint-disable`, `@ts-expect-error`) stay.
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
