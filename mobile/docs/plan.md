# torrential mobile: plan

A native Android app (iOS parity next) for the torrential engine. It talks to the same HTTP API on port 47919 that the web app uses, so it adds no server of its own.

## Done means

On the Poco F6, against the engine on the Mac:

1. A fresh install pairs with the engine by scanning the QR code or typing the six-digit code, and stays paired across restarts.
2. Home shows Continue watching and Saved with artwork, live download progress, and pull to refresh.
3. Search returns films and shows as you type. A title page shows artwork, details, episodes for a show, and Play.
4. Play opens a native full-screen player: the original file plays in ExoPlayer when the phone decodes it, and the engine's converted stream otherwise. It has seek with thumbnails, subtitles, audio tracks, resume where you left off, picture-in-picture, and lock-screen controls.
5. Play on TV lists the TVs the engine finds. Picking one starts the cast, and the phone becomes a remote with play/pause, seek and volume, including the hardware volume keys.
6. A magnet link or .torrent file shared or opened from another app lands in torrential and can be played or downloaded.
7. Downloads shows every download with progress, speed and remove.

Each item is verified on the phone with a screenshot, never by "it compiles".

## Design

Native-first, same brand. The palette is the web and terminal UI's (`paper #14120f`, `raised #1d1a16`, `ink #f0e9dc`, `soft #bdb5a6`, `pencil #837c70`, `rule #3b3730`, `action #a6c79a`, `error #e2806e`) and the type is Inter. Layout, motion and gestures follow the platform: Material 3 behaviors on Android, Apple's Human Interface Guidelines on iOS, and Vercel's interface guidelines everywhere (hit targets of at least 44 pt, honest loading states, no layout shift, optimistic actions, tabular numbers for times and sizes, motion that respects reduced-motion).

## Order

Riskiest first.

1. Scaffold, native build, install on the phone.
2. Engine client and pairing (auth is the first thing that can block everything).
3. Playback spike: original file in ExoPlayer, then the fMP4 stream as fallback.
4. Design system: tokens, type scale, buttons, cards, sheets, skeletons.
5. Home, search, title pages, episodes.
6. Player: custom controls, seek thumbnails, tracks, resume, PiP, lock screen.
7. Play on TV remote.
8. Share sheet and magnet intents. Downloads.
9. Hill-climb: one screen at a time, screenshot, critique against the guidelines, fix, screenshot again.
