# UI/UX council, 2026-11-22

Three reviewers (Codex gpt-6.2-sol, high effort) read the code and screenshots in `.review/`, each
with one lens: iOS and Liquid Glass, Android and motion, states against Vercel's and Apple's
guidelines. This is their findings merged and ranked. Each item names what to change; check it
off with the commit that does.

## Now: broken, risky or felt on every use

- [ ] Player saves progress and invalidates Home on every tick: `useTimeline` returns a new object
      each render, so the save effect re-runs (Player.tsx save effects, timeline.ts return).
- [ ] A cancelled scrub still seeks: SeekBar commits in `onFinalize`; commit once in `onEnd` when
      `success`.
- [ ] Remove and Delete from this phone act without confirmation, and a failed local delete still
      drops the row (downloads.tsx menu, offline/saved.ts).
- [ ] TV remote: Stop closes the sheet even when the request failed; control errors are swallowed;
      the Cast Bar opens `/tv` without saying which TV (tv.tsx, CastBar.tsx).
- [ ] Player heading and subheading repeat the same name ("Big Buck Bunny" twice).
- [ ] Android tab switch cross-fades two feeds: tabs `animation: 'none'`; selected icon settles
      0.96 → 1 over 110 ms instead of dipping to 0.82.
- [ ] Row entrance stagger delays content up to 580 ms (rise.ts): limit to the first 4 rows,
      140 ms, 12 ms apart, once per query; none for recycled rows.
- [ ] Haptics on every tap: keep selection haptics for changed choices; success only after the
      thing succeeded (add.tsx fires before the player plays).
- [ ] Secondary text under 4.5:1: `pencil` on raised/lifted and the search placeholder.

## Next: states and recovery

- [ ] iOS player can sit black with no source when `/api/media` fails: explicit checking,
      preparing and failed states with Retry and Close.
- [ ] Player error panel has no actions: Retry playback, Choose another source, Close.
- [ ] Failed refresh replaces cached Home and title content with the full-page error.
- [ ] Downloads says "Connecting…" forever; offline list looks current; Pause/Resume failures
      close the menu silently.
- [ ] Streaming requests ignore cancellation once headers arrive (client.ts `stream`).
- [ ] TV scan failure reads as "No TVs found"; opening the picker pauses the phone before the TV
      plays.
- [ ] Pairing: a rejected QR code resubmits while still in view; no deadline on the request.
- [ ] Save celebrates before Home updates; rollback is silent.
- [ ] Add: invalid input only disables Play; say why inline.
- [ ] Phone copies are behind the pairing guard; reachable without the engine.
- [ ] Save to phone can start twice; selected subtitles can silently render nothing.

## Platform polish

- [ ] iOS: cast bar in `NativeTabs.BottomAccessory`.
- [ ] iOS: player icons as SF Symbols (`gobackward.10`, `goforward.10`, `xmark`,
      `captions.bubble`); scrim only at the edges, not a 45% wash.
- [ ] iOS: segmented controls for Films & shows / Torrents and Downloads' three lists.
- [ ] iOS: Search tab with `Stack.SearchBar` so one tap focuses the field.
- [ ] Both: sheets: the pan only on the grabber; lists own vertical scrolling; a Close button.
- [ ] Both: player controls: immediate single-tap reveal in the middle; hide timer resets on input
      and pauses for screen readers; fade glass through `glassEffectStyle`, not ancestor opacity.
- [ ] Both: scroll-linked chrome settles once; pin Search while its field is focused.
- [ ] Both: 44 pt / 48 dp targets for Clear, More, Engine, Add, Back.
- [ ] Both: Reduce Motion and Reduce Transparency subscriptions (chrome, parallax, glass fallback).
- [ ] Both: Dynamic Type: two poster columns at fontScale ≥ 1.4, wrapping button labels.
- [ ] Android: container transform from a poster into the title page, a root overlay driven by
      one progress value (270 ms open, 210 ms back), measured on press; fall back to a fade.
- [ ] Android: scrubber on the UI thread (translateX/scaleX), thumbnails throttled with a trailing
      update.
- [ ] Android: predictive back for sheets and the player.

## Delight

- iOS ClipboardPasteButton in Add; Saved bookmark bounce; Downloads badge with a count.
- Carousel dots follow the finger; skip flash says −10 s / +10 s; TV start confirmation.

## Overnight, 2026-11-22

Done, each verified on the iOS simulator or the F6 unless marked:

- Speed: the Android poster flight starts from the title page's layout (tap to flight 36–94 ms,
  median 44 ms, release build on the F6); sections skip entrances while it flies; episodes,
  synopsis, cast and the sources warmup wait for landing; jobs are a store that tab bars and
  Search read through selectors; the swipe pill and idle cast polling stopped re-rendering.
- Download to this phone (a play with `keep`), episode download status, New episodes, Popular
  films and shows (engine `GET /api/titles/popular`), Settings with theme, data saver and about.
- Player: error recovery, sleep timer, lock, chapter marks, subtitle and audio memory per show,
  Up next artwork, next episode prepared on Wi-Fi near the end (untested on a device).
- Phone-first pairing, offline copies without an engine (with resume and subtitles; subtitles
  untested), unsent watch positions kept and resent, TV errors and handoff.

Open:

- [ ] Virtualize Home's Saved grid and long seasons (measure first; keep the poster measurable).
- [ ] Smaller artwork for backdrops (976 KB at 1920 px; needs an image library in the engine).
- [ ] Find the "Reading from value during render" warnings (needs Metro and a stack).
- [ ] Remember a torrent subtitle file's language; move Lock controls into player Settings.
- [ ] Settings entry: a gear instead of the engine avatar? (Avatar kept for now, X-style.)
- [ ] Cast bar growing into the remote with a finger-following swipe (cut for now).
