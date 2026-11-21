# The engine on the phone

Goal: the app can run torrential's engine itself, on Android and iOS, and switch between it and an
engine on a computer. The app already speaks HTTP to an engine and trusts `127.0.0.1` without
pairing, so the phone's engine is the same daemon, built as a library and started inside the app,
listening on loopback.

## Shape

- `crates/mobile`: a `staticlib`/`cdylib` around `daemon::run`, with one C entry point
  `torrential_start(data_dir, port)` (and the JNI name for Android). It runs the daemon on its own
  thread and returns.
- Android: an Expo native module (Kotlin) loads `libtorrential_mobile.so` and runs it in a
  foreground service, so downloads continue with the screen off.
- iOS: an Expo native module (Swift) links `TorrentialMobile.xcframework` and starts the engine
  while the app is open.
- The app keeps a list of engines ("This phone", "Neel's Mac") instead of one link, and the engine
  avatar switches between them.

## Differences on a phone

- No ffmpeg: the engine already falls back without ffprobe. The phone plays its own files directly
  (ExoPlayer reads MKV; AVPlayer only MP4/MOV).
- HTTPS on Android checks certificates against bundled Mozilla roots, not the platform verifier,
  which needs the app's Java context.
- Off: self-update, the web app's daemon/launch paths, Mac-only helpers (scutil, hdiutil).
- iOS stops the engine when the app goes to the background.

## Steps (each ends in a check)

1. OpenSSL built for android-arm64, ios-arm64, ios-sim-arm64 (`scripts/mobile-deps.sh`).
2. The engine crate cross-compiles for `aarch64-linux-android`.
3. `crates/mobile` builds a `.so`; it starts on the F6 and `curl 127.0.0.1:47919/api/version`
   answers from `adb shell`.
4. The Expo module and foreground service; the app pairs to "This phone" and a film downloads and
   plays from the phone.
5. The engine switcher in the app.
6. iOS: xcframework, Swift module, same checks on the simulator and the iPhone.

## Building

The engine's binaries are not in git. Build them before a native build of the app, after any change
to the Rust crates:

    mobile/scripts/build-engine.sh android   # → modules/torrential-engine/android/src/main/jniLibs
    mobile/scripts/build-engine.sh ios       # → modules/torrential-engine/ios/TorrentialMobile.xcframework

They need rustup's toolchain with the `aarch64-linux-android`, `aarch64-apple-ios` and
`aarch64-apple-ios-sim` targets, `cargo-ndk`, the Android NDK, Homebrew's Boost, and Xcode. OpenSSL
for the three targets is built once into `target/mobile-deps` by `build-openssl.sh`.

## Log

(dated entries as steps complete)

- 2026-11-22: Steps 1–3 done on Android. OpenSSL builds for all three targets. libtorrent and the
  daemon cross-compile for `aarch64-linux-android` (the engine's build script points CMake at the
  NDK toolchain and Boost's headers). `crates/mobile` builds `libtorrential_mobile.so` (26 MB,
  needs only system libs and React Native's `libc++_shared.so`). Started from a C harness on the
  F6, the engine answered `/api/version`, searched titles and torrents over HTTPS, and downloaded
  Big Buck Bunny at about 320 KB/s from 2 peers. The platform certificate verifier panics on
  Android without the app's Java context, so Android trusts Mozilla's roots
  (`torrential_search::client_builder`).
- 2026-11-22: Step 4 on Android. `modules/torrential-engine` loads the library and runs it in a
  foreground service (dataSync) on port 47929. The session is now a list of engines with one active;
  the engine sheet lists them, switches, runs the engine on the phone, and adds a computer. On the
  F6, "Run the engine on this phone" switched the app to it, and Big Buck Bunny played while it
  downloaded into the app's storage.
- 2026-11-22: Step 6 on the simulator. The engine builds for `aarch64-apple-ios` and
  `aarch64-apple-ios-sim` (libtorrent needs SystemConfiguration, as on macOS), packed as
  `TorrentialMobile.xcframework` and started by a Swift module in Application Support. Phone builds
  report ffmpeg as unavailable: the simulator had found the Mac's ffprobe and failed to run it, and
  a phone has none to run. Big Buck Bunny played on the iOS simulator from the app's own engine.
- 2026-11-22: From the council review: the phone's engine requires the app's secret on loopback
  (401 without it, on the F6 and the simulator); start waits for the engine and returns its real
  port; the service no longer restarts without the app and stops at Android 15's data sync limit;
  engine-list writes are queued; pairing lands on Home; removing on the phone deletes the files.
  With the app in the background and the screen off, the F6 downloaded Night of the Living Dead at
  about 220 KB/s (1 → 41 MiB in three minutes). A Release build is installed on the iPhone 17 Pro
  Max, untested until the phone is unlocked.
