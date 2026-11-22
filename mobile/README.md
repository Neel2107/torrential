# torrential for Android and iOS

A native client for the torrential engine, built with Expo. It talks to the same HTTP API as the web app (see [docs/engine-api.md](docs/engine-api.md)) and shares its wire types from `../web/src`.

## Run it

You need the engine running on a computer, Node 22, pnpm, JDK 17 and the Android SDK.

```sh
pnpm install
pnpm exec expo prebuild --platform android
cd android && ./gradlew assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk
pnpm exec expo start --dev-client
adb reverse tcp:8081 tcp:8081
```

To pair, run `torrential devices add` on the computer and scan the code, or type the address and code. During development, `adb reverse tcp:47919 tcp:47919` and "Use the USB connection" reach the engine over loopback with no pairing.

The plan and definition of done are in [docs/plan.md](docs/plan.md).
