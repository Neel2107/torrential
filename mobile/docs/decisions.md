# Decisions and evidence

What was decided while building the app, why, and how each part was checked on the Poco F6 (Android 16, HyperOS) against torrential 0.7.0 on a Mac.

## Decisions

| Decision | Why | Alternative given up |
|---|---|---|
| Native client of the engine's HTTP API, no server of its own | The engine already serves everything the web app needs, and a phone is one more paired device | A WebView around the web app, which loses native playback, PiP and the share sheet |
| Share the web app's `wire.ts`, `format.ts`, `release.ts`, `video.ts`, `words.ts` and `vtt.ts` through Metro `watchFolders` and the `@web/*` alias | One set of types follows the engine; nothing is copied | Copying the types, which drift |
| ExoPlayer plays the original file URL with the device cookie, not `/api/stream` | The file route answers Range requests while the file downloads, so seeking is native and ffmpeg never runs ([engine-api.md](engine-api.md) section 3) | The fMP4 stream, which cannot seek and re-encodes audio |
| X's interaction model, not stock Material | The user asked for X's Android feel: icon-only tab bar, top bar with the engine as avatar, FAB, bars that move with the scroll, sheets for menus | Native Material tabs (built first, then replaced) |
| torrential's palette and Inter, Lucide icons everywhere | Same product as the web and terminal UI; one icon set on both platforms, as X has | SF Symbols on iOS and Material Symbols on Android |
| The device token kept by the app, sent as a `Cookie` header on every request, images and video included | The engine sends it only in `Set-Cookie` and never expires it; ExoPlayer and expo-image do not share a cookie jar | Relying on OkHttp's cookie jar |
| Every screen portrait except the player, which is landscape through its screen options | The runtime lock was unreliable on HyperOS, and Home left sideways after the player looked broken | Free rotation |
| Sheets through a root portal | Sheets drawn inside a tab sat under the tab bar | Per-screen sheets |
| A `.torrent` file becomes a magnet on the phone, by SHA-1 of its bencoded `info` | The engine takes magnets and URLs but no `.torrent` bytes | Uploading the file, which the API does not allow |
| Play-cache cap on the Mac set to 6 GiB (`~/.config/torrential/config.yaml`) | The Mac had about 18 GB free during the build | The 20 GiB default |

## Found along the way

- The Mac and the phone share an IPv6-only network (464XLAT), so each has only a `192.0.0.x` IPv4 address. The engine put `http://192.0.0.2:47919` in the pairing link, which the phone cannot reach. Pairing worked by typing the Mac's global IPv6 address, which the app accepts bare. The engine could prefer a routable IPv6 address, or the `.local` name, when its IPv4 address is in `192.0.0.0/29`.
- `wire.ts` types `Job.info_hash` as a string, but the engine sends `{ v1?, v2? }` (`crates/core/src/ts.rs:31` against `crates/core/src/id.rs:81-93`). The app keys downloads by `Job.id`.
- Hermes has no `Intl.DisplayNames` or `Intl.ListFormat`. The app names languages from a small table and never calls `list()` from `format.ts`.
- On Android, images behind the landscape player lost their pixels after it rotated back; artwork now remounts on an orientation flip and reloads from cache.

## Verified on the phone

| What | How |
|---|---|
| Pairing | `torrential devices add` on the Mac, the address and code typed on the phone; `torrential devices` then listed it |
| Home, title pages, Save | Screenshots; Save toggled on the phone showed up in `GET /api/home` |
| Title play | Night of the Living Dead (public domain) found a source in about 15 s and played in ExoPlayer while downloading |
| Resume | Reopening the film resumed at the saved position; Home's time left updated |
| Scrub and frame previews | Dragging the bar showed `/api/thumbnail` frames; release seeked |
| Subtitle file | The torrent's `.srt` listed in the sheet and selected |
| Picture-in-picture | Home pressed during playback; the video kept playing in a floating window |
| Swipe down to close | Dragged past 100 pt, the player closed back to portrait Home |
| Torrent search, magnet intent | Big Buck Bunny found by the Torrents tab; a `magnet:` VIEW intent opened the add sheet and played |
| Pinned source | The smallest Big Buck Bunny release, picked from Sources, played |
| Downloads | Live list from `/api/events`, sheets for play and remove |

## Not verified yet

- Play on TV: no TV was on the Mac's network (it was on the phone's hotspot).
- Scanning the pairing QR code with the camera.
- A `.torrent` file opened from Files or a chat, and text shared to the app.
- iOS.
