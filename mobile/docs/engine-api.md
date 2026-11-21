# torrential engine HTTP API, for the native client

Engine 0.7.0, branch `mobile`, port 47919. Paths below are relative to the repo root. `http.rs` means
`crates/daemon/src/daemon/http.rs`, `web/` means `crates/daemon/src/daemon/web/`, `devices.rs` means
`crates/daemon/src/daemon/devices/mod.rs`. TS names come from `web/src/wire.ts` (written by `cargo test`
from the Rust types) and `web/src/api.ts`. **Live** means confirmed with a GET to the running engine on
2026-11-21. Nothing here was paired, played, or POSTed.

## 0. Wire basics

| Rule | Source |
|---|---|
| Methods are GET, HEAD and POST only. Anything else gets 405. | http.rs:926-931 |
| A POST must send `Content-Type: application/json` (params after `;` are fine), or it gets 415 with an empty body. **Live** | http.rs:932-935 |
| A POST body must have `Content-Length`. `Transfer-Encoding` on a request gets 411. The body limit is 64 KiB (413). | http.rs:936-943, 50, 494-498 |
| A request head must arrive within 10 s of the last answer, or the connection closes. | http.rs:39, 470 |
| JSON answers send `Cache-Control: no-store`. Every answer sends `X-Content-Type-Options: nosniff`. | http.rs:676-679, 61 |
| Streamed answers (NDJSON, SSE, fMP4, VTT) use HTTP/1.1 chunked encoding and `Connection: close`. | http.rs:683-690 |
| A failed `/api` call answers `{ "error": Error }` with the status below. | web/mod.rs:178-182, 297-299 |

Error status by `ErrorCode` (web/mod.rs:279-295):

| Status | Codes |
|---|---|
| 400 | `usage`, `confirmation_required` |
| 401 | `not_paired` |
| 403 | `local_only` |
| 404 | `invalid_ref`, `invalid_torrent`, `not_found`, `no_selection` |
| 409 | `ambiguous_ref`, `job_conflict`, `path_conflict` |
| 413 | `too_large` |
| 502 | `fetch_failed` |
| 503 | `providers_unavailable`, `network_unavailable`, `no_source`, `interrupted`, `sandbox_*`, `daemon_unavailable`, `daemon_version` |
| 504 | `metadata_timeout` |
| 507 | `disk_full` |
| 500 | `storage_error`, `state_corrupt`, `verification_failed`, `internal` |

```ts
type Error = { code: ErrorCode; message: string; hint?: string | null; details?: Details | null; next?: string | null }; // wire.ts:12
```

Answers that are **not** JSON errors come from the guard, before any route runs:

| Status | Body | When | Source |
|---|---|---|---|
| 403 | empty | Over loopback, a foreign `Origin`, `Sec-Fetch-Site: cross-site/same-site`, or a non-loopback `Host`. **Live** | http.rs:1000, 1043-1056, 629 |
| 307 | empty, `Location: http://127.0.0.1:47919/...` | Over loopback, `Host` is this Mac's `.local` name. **Live** | http.rs:993-999, 640-644 |
| 403 | text/plain "open http://{host}:{port} instead" | From the network, `Host` does not name this Mac, or the request is cross-origin. | http.rs:1001-1006, 633-638 |
| 401 | JSON `not_paired` | From the network with no cookie, or with the cookie of a removed device. | web/devices.rs:44-47 |
| 303 | `Location: /pair` | From the network, unpaired, any non-API GET. | web/devices.rs:52-55 |
| 429 | empty, `Retry-After: 60` | Over 30 tokens from one IP that opened nothing within one minute. | devices.rs:33, http.rs:483-487 |
| 404 | text/plain | `/cast/...` URL whose grant ended. **Live** | http.rs:639 |
| 503 | text/plain, `Retry-After: 5` | File route while the engine is mid-update. | http.rs:736-739 |

## 1. Routes

The route table is `web/mod.rs:66-148`. Unknown routes get 404 `not_found` "the engine has no GET /api/x" (web/mod.rs:146, **live**).

### 1a. Engine, identity, devices

| Method, path | Body or query | Answer | Source |
|---|---|---|---|
| GET `/api/version` | none | `Version = { version: string; notice: string \| null }` **Live** `{"version":"0.7.0","notice":null}` | web/mod.rs:113, wire.ts:423 |
| GET `/api/me` | none | `Me = { asker: "device"; device: Device \| null } \| { asker: "mac" }` **Live** `{"asker":"mac"}` | web/devices.rs:90-104, wire.ts:536 |
| GET `/api/devices` | none (only the Mac) | `DeviceList` **Live**, else 403 `local_only` | web/devices.rs:107-135 |
| POST `/api/devices/add` | `{}` (only the Mac) | `DeviceList` with a new `offer` | web/devices.rs:113-116 |
| POST `/api/devices/remove` | `{ id: string }` (only the Mac) | `DeviceList` | web/devices.rs:118-127 |
| POST `/api/pair` | `{ code: string }` (only an **unpaired** caller) | `{ device: Device }` plus `Set-Cookie` | web/devices.rs:41-88 |
| POST `/api/ffmpeg` | `{}` | NDJSON of `FfmpegMessage`. The last line is `ready` or `error`. | web/mod.rs:362-396, wire.ts:431 |

```ts
type Device = { id: string /* 8 hex */; name: string; added_at: number; seen_at: number; seen_from: string | null }; // wire.ts:262
type PairingOffer = { qr: string[]; code: string /* 6 digits */; url: string; address: string;
  lan_address: string | null; tailnet_address: string | null; expires_at: number };            // wire.ts:499
type DeviceList = { devices: Device[]; offer: PairingOffer | null; unreachable: string | null };  // wire.ts:534
```

### 1b. Search, titles, library

| Method, path | Body or query | Answer | Source |
|---|---|---|---|
| POST `/api/search` | `{ q: string; category?: Category; limit?: number /* 1-200, default 50 */; fresh?: boolean }` | NDJSON of `SearchMessage`: `update` lines as each source answers, then `done` or `error` | web/mod.rs:321-358, 400-431, wire.ts:429 |
| GET `/api/titles?q=` | `q` required | `TitleSearch = { titles: TitleCard[]; offline?: boolean }` **Live** | web/titles.rs:31-48, wire.ts:433 |
| GET `/api/title?id=tt…` | `id` | `TitlePage` (details, seasons with episodes, `saved`, `watched`, `next`, `play_target`, `downloads: Job[]`) **Live** | web/titles.rs:51-54, wire.ts:200 |
| GET `/api/title/art?id=&kind=` | `kind` = `poster`, `background`, `logo`, or `thumbnail` with `season`, `episode` | Image bytes, `Cache-Control: private, max-age=2592000`. 404 JSON when missing. **Live** `image/jpeg` | web/titles.rs:57-95, api.ts:443-449 |
| GET `/api/title/sources?video=` | optional `width`, `height`, `scale`, `playback` (all four or none), `h264`, `hevc`, `av1` (all three or none) | NDJSON of `SearchMessage`, ranked for the caller's screen | web/titles.rs:99-173 |
| GET `/api/home` | none | `Home = { continue: Continue[]; saved: TitleCard[] }` **Live** | web/titles.rs:387-389, wire.ts:242 |
| POST `/api/library` | `{ title: string; saved: boolean }` | `{ saved: boolean }` | web/titles.rs:364-384 |
| POST `/api/watched` | `Position` | `Saved = { watched: Watched; kept: boolean }` | web/titles.rs:286-327, wire.ts:477-495 |
| POST `/api/watched/forget` | `Forget = { video: string }` | `{}` | web/titles.rs:329-341 |

A `video` (`VideoRef`) is `tt0063350` for a film, `tt0903747:3:5` for an episode, or a bare series ID meaning its next episode (wire.ts:455). Season 0 holds specials (wire.ts:180). **Live:** in `/api/title?id=tt0903747`, `seasons[1].number` is 2, and each `EpisodeInfo` carries `season`, `episode` and `thumbnail: boolean`.

`Viewer` (wire.ts:439) is `{ width, height /* device px */, scale, playback: "hevc-hdr"|"hevc"|"h264", decoders?: { h264, hevc, av1: "hardware"|"software"|"no" } }`. A paired device that sends one is ranked as `Player::Device(viewer)`. A request with no viewer and no `playback` is ranked as `Player::External`, the way `torrential play` ranks (web/titles.rs:179-188).

### 1c. Downloads

| Method, path | Body or query | Answer | Source |
|---|---|---|---|
| GET `/api/jobs` | none | `{ jobs: Job[] }` **Live** | web/mod.rs:126-129 |
| POST `/api/files` | `{ ref: string }` | `FilesReply` (waits for metadata up to 60 s) | web/mod.rs:130-133, wire.ts:125 |
| POST `/api/play` | `{ ref: string; file?: number }` | `PlayInfo`. This **starts or joins** the download. It is the web app's only "add" route. | web/play.rs:15-42 |
| POST `/api/pause`, `/api/resume` | `{ refs: string[] }` (non-empty) | `{ changes: Change[] }` | web/mod.rs:134-145 |
| POST `/api/remove` | `{ refs: string[]; delete?: boolean }` | `{ changes: Change[] }`. `delete` sends a chosen folder's files to the Trash. | web/mod.rs:212-218 |
| GET `/api/pieces?id=&file=` | `id` is the full 40-hex ID | `FilePieces = { pieces: string }`, 200 chars of `0`-`8` (8 means all there) **Live** | web/mod.rs:122-125, downloads.rs:380-388 |

A `ref` may be a download or search-result ID, an infohash, a magnet, or a `.torrent` **URL**. A `.torrent` path is refused, and so is a title ID (web/mod.rs:262-276). The web API cannot upload `.torrent` bytes.

```ts
type Job = { id: string; info_hash: string /* WRONG, see gotcha 1 */; name: string | null; dir: string; path: string | null;
  progress: Progress; selection: Selection; added_at: number; title?: TitleLink | null; place: "folder" | "plays";
  waiting_for?: string | null } & JobStatus;  // wire.ts:90-111
type JobStatus = {state:"queued"}|{state:"metadata"}|{state:"checking"}|{state:"downloading"}|{state:"paused"}
  |{state:"done"; finished_at:number}|{state:"error"; error:Error};   // wire.ts:63
type Progress = { size: number|null; verified: number; piece_map?: string|null; down_rate: number; up_rate: number;
  peers: number; seeds: number; eta: number|null };   // wire.ts:65
type Change = { id; name; result: ChangeResult; path?; deleted?: string[]; trashed?: string[]; kept?: Kept[] }; // wire.ts:131
```

### 1d. Playback (detail in section 3)

| Method, path | Query | Answer | Source |
|---|---|---|---|
| POST `/api/title/play` | body `PlayTitle = { video; viewer?; playback?; source?; replace? }` | NDJSON of `PlayMessage`. The last line is `playing` (carries `PlayInfo`) or `failed`. | web/titles.rs:204-284, wire.ts:453, 475, api.ts:211 |
| GET `/api/media?id=&file=` | | `MediaInfo` (tracks, `direct`, `ffmpeg`, chapters) **Live** | web/mod.rs:114-117, wire.ts:388 |
| GET `/api/stream?id=&file=&t=&video=&audio=` | `t` seconds (default 0), `video=copy\|h264` (default copy), `audio` stream index | chunked `video/mp4` (fragmented). Ignores Range. **Live** | web/watch.rs:49-75 |
| GET `/api/subtitles?id=&file=[&stream=&t=]` | with `stream`, an embedded track from `t`. Without it, `file` is a subtitle file, converted whole. | chunked `text/vtt` **Live** | web/watch.rs:78-95, media/mod.rs:178-206 |
| GET `/api/subtitles/online?id=&file=` | | `OnlineSubtitles` | web/online.rs:22-75, wire.ts:410 |
| GET `/api/subtitles/online/fetch?id=&file=&subtitle=` | `subtitle` is an `OnlineSubtitle.id` | `text/vtt`, cached 1 h | web/online.rs:79-100, web/mod.rs:80 |
| GET `/api/thumbnail?id=&file=&t=` | `t` ≥ 0 | 240 px wide JPEG, cached 1 h. **Live** 240x136 | web/mod.rs:204-210, media/thumbnail.rs:28-70 |
| GET, HEAD `/{id}/{index}/{name}` | `Range` | the original file's bytes, 200 or 206 | http.rs:605-606, 729-776 |

### 1e. Live updates and cast

| Method, path | Body | Answer | Source |
|---|---|---|---|
| GET `/api/events` | none | SSE, `data: <Event JSON>\n\n` | web/watch.rs:24-46 |
| GET `/api/tvs` | none | `TvList = { tvs: Tv[]; casts: Cast[] }`, as known now **Live** `{"tvs":[],"casts":[]}` | web/mod.rs:102, wire.ts:350 |
| POST `/api/tvs` | `{ fresh?: boolean }` | `TvList` after a search of the home network (skipped if one ran in the last 30 s, unless `fresh`) | web/cast.rs:10-20, api.ts:504-507 |
| POST `/api/cast` | `CastStart` | `{ cast: Cast }`, at once | web/cast.rs:22-57, wire.ts:538 |
| POST `/api/cast/control` | `{ tv?: string } & CastAction` | `{ cast: Cast }` | web/cast.rs:59-71, wire.ts:352 |

## 2. Auth and pairing

### Who the engine thinks you are

`ask()` at http.rs:988-1029 sorts every request into an `Asker` (devices.rs:44-55):

| Asker | How it is recognised | What it may reach |
|---|---|---|
| `Local` | TCP peer is loopback, `Host` is `127.0.0.1`, `localhost` or `::1` (or absent), and no foreign `Origin` or `Sec-Fetch-Site`. **No cookie or token needed.** **Live** | everything |
| `Device(id)` | Network peer whose `Cookie: torrential_device=<64 hex>` matches a stored token hash | everything except `/api/devices*` (403 `local_only`) |
| `Cast(grant)` | path `/cast/<64 hex>/<name>` with a live grant | that one file, GET only |
| `Stranger{removed}` | network peer with no valid cookie | `/pair`, `POST /api/pair`. Everything else gets 401 or a 303 to `/pair`. |

Loopback is decided by the TCP peer address (http.rs:174-177). A local reverse proxy that sends `X-Forwarded-For`, or a request naming the public address, counts as the network (http.rs:182-192).

### Network listening

The engine binds only `127.0.0.1` until a device is paired, a code is open, a cast grant is live, or `server` is set in config (devices.rs:209-213, http.rs:84-90). **Live:** with nothing paired, `lsof` shows `127.0.0.1:47919` only, so nothing on the LAN can reach the engine. Opening a code with Add a device rebinds it to `0.0.0.0` plus `[::]` (http.rs:199-233, 92-99).

### Pairing flow

1. The Mac calls `POST /api/devices/add`. It gets a 6-digit code that lasts 10 minutes and replaces any older code (devices.rs:24, 419-458).
2. The QR code holds `PairingOffer.url = "{address}/pair#{code}"` (devices.rs:236). `address` is chosen in this order: public address, the tailnet name (server mode only), `http://{name}.local:47919` (private LAN only), `http://{LAN IPv4}:47919`, then `http://{tailnet}:47919` (devices.rs:219-242). The code sits after `#`, so a browser never sends it to the server (pair.html:94-99).
3. The device POSTs `/api/pair` with `{"code":"123456"}`. Non-digits are stripped (devices.rs:495). Failures:

| Status | Meaning | Source |
|---|---|---|
| 400 `not_paired` | wrong code | devices.rs:134, 496-500 |
| 410 `not_paired` | no open code, or the code burned after 5 wrong tries | devices.rs:27, 134, 501-503 |
| 429 `not_paired` | more than 10 tries per minute from this IP | devices.rs:29, 489-491 |
| 404 `not_found` | the caller is already paired. It is not a stranger, so the route falls through to `respond`. | http.rs:579-580, web/mod.rs:146 |

4. A success answers `200 {"device": Device}`. The device name comes from the User-Agent table at devices.rs:647-667. Anything unknown is named "Browser". The answer carries:

```
Set-Cookie: torrential_device=<64 hex>; Path=/; Max-Age=34560000; HttpOnly; SameSite=Strict[; Secure]
```

(web/devices.rs:27, 35-38, 71-76.) `Secure` is added only when the request's `Host` is the configured HTTPS public address (config `Exposure::secure`). The token is 32 random bytes. The engine keeps only its SHA-256 in SQLite (devices.rs:75-109, 516-521). The server side never expires a token. Only `devices/remove` ends it (devices.rs:472-484, 529-549). `Max-Age` is 400 days and is refreshed each time a device loads an HTML page (http.rs:613-619). A native client never loads HTML, so it should ignore `Max-Age` and keep the token itself.

5. Removing a device on the Mac ends that device's open requests at once (http.rs:527-531, devices.rs:593-608). Its next `/api` call gets 401 `not_paired` with the "removed" message (web/devices.rs:25, 45). The web app answers a 401 by sending the browser to `/pair` (api.ts:237-239).

### Network checks (`home_allowed`, http.rs:1064-1081)

* `Host` must name the address the TCP connection reached, the `.local` name, or the tailnet MagicDNS name, **with port 47919**. In server mode, or at the configured public address, any host and port pass.
* `Origin`, if sent, must equal `http://{Host}` (or the public origin). `Sec-Fetch-Site: cross-site` and `same-site` are refused. `none` and `same-origin` pass.
* LAN and Tailscale are treated the same way. Tailscale gets no extra trust and no extra checks (tests at http.rs:1202-1208).

### What a native client must send

* `Host: <the address it dialed>:47919`. OkHttp sets this from the URL.
* `Cookie: torrential_device=<token>` on **every** request: API calls, the original-file URL, `/api/stream`, subtitles, thumbnails, and art. The guard reads only that cookie name for `/api` and files (http.rs:917-920, 1023-1028).
* No `Origin` header, or one that exactly equals `http://{host}:47919`.
* `Content-Type: application/json` on every POST, and a known-length body.
* `Authorization: Bearer <device token>` is accepted **only** at `POST /engine`, the CLI's framed protocol (`application/x-torrential-frames`, wire.rs:18-20). There it unlocks the device-allowed CLI requests (http.rs:1009-1016, server.rs:97-111, protocol `refused_to_device`). It does not work for `/api/*`.

### Browser assumptions

* SameSite=Strict and HttpOnly only matter to a browser. A native cookie jar ignores both.
* The Origin and Sec-Fetch-Site checks are anti-CSRF. A native client passes them as long as it sends no foreign `Origin`.
* There is no CSRF token header. Instead, state-changing routes are JSON POSTs, which a foreign page cannot send without a preflight (web/mod.rs:4-6).
* Unpaired GETs answer 303 to `/pair`. A native client should treat any 303 to `/pair`, or a 401 `not_paired`, as "pair again".

## 3. Playback

### Start a play

**By title** (what the web app does for films and episodes). `POST /api/title/play` with `{ video, viewer }` (titleSession.ts:103). The answer is NDJSON (web/titles.rs:221-257):

```ts
type PlayMessage =
  | { type: "resolved"; video: string; title: TitleCard; episode: EpisodeInfo | null }
  | { type: "searched"; found: number; sources: SourceReport[] }
  | { type: "trying"; rank: number; of: number; release: Release }
  | { type: "check"; check: "file_list" | "start" | "first_bytes" }
  | { type: "skipped"; release: string; reason: Skip }
  | { type: "failed"; error: Error; tried: Tried[] }                                      // last
  | { type: "playing"; video: string; release: Release; play: PlayInfo; resume_at: number | null }; // last
// wire.ts:254, 475
```

Closing the connection early cancels the play and gives up the source under test (web/titles.rs:219-220, 249). Read the stream to the end. `source` pins one release. `replace` names a stalled download to swap out.

**By torrent.** `POST /api/play { ref, file? }` returns `PlayInfo` (web/play.rs). It waits up to 60 s for a magnet's metadata (protocol `METADATA_WAIT`).

```ts
type PlayInfo = { id: string; name: string; job: Job; files: TorrentFile[]; total_size: number;
  video: StreamedFile; subtitles: StreamedFile[] };                   // wire.ts:364
type StreamedFile = { index: number; path: string; size: number; url: string /* "/{id}/{index}/{name}", relative */; offset: number }; // wire.ts:354
```

### How the web player chooses (player/plan.ts:33-47)

1. Call `GET /api/media` to get `MediaInfo`. If `direct` (a MIME type with codecs) is something the browser can play, it plays `video.url` directly with Range (`DirectSource`, Playback.tsx:226-227). `direct` is set only for mp4 and webm containers (media/tracks.rs:239-260). **Live:** for an MKV it is `null`, and for an MP4 it is `video/mp4; codecs="avc1.640029, mp4a.40.2"`.
2. Otherwise it uses `/api/stream` with `video=copy` when MSE takes the file's own codec, else `video=h264`. Audio is always AAC (`-c:a copy` when the source is AAC, else stereo 192k AAC; media/ffmpeg.rs:118-124).
3. If `MediaInfo.ffmpeg` is not `"ready"`, it calls `POST /api/ffmpeg` to fetch ffmpeg first.

### Original-file URL: direct playback in ExoPlayer is possible

`GET /{40-hex id}/{file index}/{any name}`. The server routes on the ID and index alone (http.rs:1095-1099). The name only gives the player an extension.

| Property | Value | Source |
|---|---|---|
| Who may fetch it | `Local`, or `Device` with the cookie. It falls through to `route()` after the asker checks. | http.rs:594-606 |
| Range | single `bytes=a-b`, `a-`, `-n`. Multi-range or unreadable gets the whole file (200). Out of range gets 416 with `Content-Range: bytes */size`. | http.rs:1105-1129 |
| Headers | `Accept-Ranges: bytes`, `Content-Length`, `ETag: "<id>-<index>"`, `Content-Range` on 206 | http.rs:756-763 |
| Content-Type | by extension. **Live:** MKV is `video/x-matroska`, MP4 is `video/mp4`. Unknown is `application/octet-stream`. | http.rs:1131-1133 |
| While downloading | each 1 MiB chunk waits for its pieces and tells the engine to fetch them first. Waits up to 5 min per chunk, then the connection drops. | http.rs:32-34, 802-879 |
| HEAD | supported **Live** | http.rs:765 |

**Live:** `curl -r 100-199` gave `206 Partial Content`, `Content-Range: bytes 100-199/2381828161`. An MKV `-r 0-1` gave 206 `video/x-matroska`.

So ExoPlayer can play the original MKV (HEVC, Dolby Vision, EAC3, embedded SRT/ASS/PGS) with its own extractor and seek by Range, while the file downloads. Pass the cookie as a request header on the media source. Codec support then depends on the device's decoders, not on ffmpeg on the Mac. The engine was built for exactly this: the file URL is fixed across runs "so players remember where playback stopped" (http.rs:29-31), and ffprobe reads files through this same route (media/mod.rs:125).

### `/api/stream` (fallback)

* It is fragmented MP4 (`frag_keyframe+empty_moov+default_base_moof+frag_discont`) with `-copyts`. Timestamps are the file's own, so a stream from `t=600` starts near PTS 600, not 0 (media/ffmpeg.rs:9-12, 81-129).
* It is not seekable. It ignores `Range` and always answers 200 chunked, with no Content-Length (**live**). To seek, open a new request with a new `t` (source.ts:286-313).
* `video=copy` tags HEVC as `hvc1`. `video=h264` scales to at most 1920x1080 with a keyframe every 2 s, using VideoToolbox on macOS (media/ffmpeg.rs:14-22, 97-116).
* ffmpeg reads at 1.5x real time after a 60 s burst, when ffmpeg is 6.1 or newer (media/ffmpeg.rs:16-21).
* Errors: 400 `usage` for a bad `video`/`audio`, 404 `no_selection` for no video track, 502 JSON when ffmpeg fails before the first byte (web/watch.rs:160-163). A failure mid-stream just cuts the connection.

### Subtitles

| Kind | URL | Notes |
|---|---|---|
| Embedded text track | `/api/subtitles?id&file=<video index>&stream=<SubtitleTrack.stream>&t=` | Streams from `t`. Cue times are on the file's timeline. **Live:** `t=600` gave a first cue of `09:59.375`. Picture tracks (`text:false`) get 400 `usage`. |
| Subtitle file in the torrent | `/api/subtitles?id&file=<PlayInfo.subtitles[i].index>` | Converted whole. Files over 16 MiB get 400. |
| Online | `/api/subtitles/online?id&file` lists them. `/api/subtitles/online/fetch?id&file&subtitle=<id>` fetches one. | Ask again once both ends of the file are on disk (`hashed:false`) to get hash-matched results. |

Sources: web/watch.rs:78-95, media/mod.rs:176-206, web/online.rs. With direct ExoPlayer playback, embedded tracks need none of these, because ExoPlayer reads them from the MKV.

### Seek-bar thumbnails

`GET /api/thumbnail?id&file&t`, where the client floors `t` to a multiple of `THUMBNAIL_EVERY = 10` (api.ts:378-381, wire.ts:572). The answer is a JPEG 240 px wide, `Cache-Control: private, max-age=3600`. It is made only from bytes already on disk.

* It answers 404 `not_found` until `GET /api/media` has probed the file, until that part has downloaded (8 MiB or 2% margin each side), or past the end.
* It answers 503 `daemon_unavailable` while two thumbnails are already being made and a third has queued for 3 s.

Source: media/thumbnail.rs:14-70. The web app waits 120 ms after the pointer stops before it asks (thumbnails.ts:5).

### Progress, resume, finished

* Where to resume: `TitlePage.next` and `TitlePage.play_target` (`{ video, resume_at }`), `Continue.resume_at` in `/api/home`, and `PlayMessage.playing.resume_at`.
* Saving: `POST /api/watched` with `Position = { video, position, duration, release, tab, starts }` (wire.ts:477). The web app saves every `SAVE_EVERY_MS = 5000`, and on play, pause, hide and leave (saving.ts, TitlePlayer.tsx:207-208). `tab` is a random 8-character string per player instance (TitlePlayer.tsx:162). `starts: true` means this screen started or resumed playback since its last save, which claims the place. A screen that has not claimed it gets `kept:false` (web/titles.rs:303-318).
* Validation: `position` must be 0 to 3.6e6 and not past `duration`, else 400 (web/titles.rs:343-362). The engine works out `finished` using `FINISHED_SHARE = 0.03` and `FINISHED_WITHIN = 20` (wire.ts:581-584). Positions under `WORTH_SAVING = 5` s are not kept.
* `POST /api/watched/forget { video }` clears a position.

## 4. Live updates: `GET /api/events`

The answer is `text/event-stream`, chunked. Each message is only a `data: <json>` line. There is no `event:`, `id:` or `retry:` field, so `Last-Event-ID` does nothing (web/watch.rs:43-46). **Live.**

```ts
type JobEvent =
  | { event: "snapshot"; jobs: Job[] }   // always first, and again after the server lagged
  | { event: "job"; job: Job }           // one download changed (whole object)
  | { event: "removed"; id: string }
  | { event: "heartbeat"; at: number };  // after 15 s with no other event
// wire.ts:113, api.ts:208, downloads.rs:33, 92-137
```

The stream follows every download (web/watch.rs:25). On reconnect, rebuild the list from the new snapshot (lib/jobs.ts:25-35). When a device is removed, the stream closes. Cast state is **not** on this stream.

## 5. Play on TV (DLNA)

```ts
type Tv = { id: string /* "uuid:…@192.168.1.40" */; name: string; address: string; plays: Container[];
  decodes: "hevc-hdr"|"hevc"|"h264"; volume: boolean };                                   // wire.ts:287
type Cast = { tv; tv_name; name; video: string|null; download: string|null; file: number|null;
  subtitle: string|null; position: number|null; duration: number|null; volume: number|null; started_at: number }
  & ({state:"finding"}|{state:"loading"}|{state:"playing"}|{state:"paused"}|{state:"ended"; error: Error|null}); // wire.ts:316
type CastStart = { tv?; video?; source?; ref?; file?; subtitle?; start_at? };  // wire.ts:538 (needs video or ref)
type CastAction = {action:"pause"}|{action:"resume"}|{action:"seek"; position:number}|{action:"stop"}|{action:"volume"; level:number /*0-100*/}; // wire.ts:352
```

1. Discover with `POST /api/tvs {fresh}` (an SSDP search, cached 30 s) or `GET /api/tvs` (cached list).
2. Start with `POST /api/cast`. It answers at once in state `finding` or `loading`. Without `tv`, it uses the only TV. For a title, the engine picks a release the TV decodes (`Plays::tv`, crates/core/src/cast.rs:62-65).
3. Control with `POST /api/cast/control {tv, action, …}`. Without `tv`, it controls the only live cast.
4. For status, **poll** `GET /api/tvs`: every 1 s while a cast is not `ended`, every 5 s otherwise (cast/casts.ts:4-7, 24-28).
5. The TV fetches the file itself at `/cast/<grant>/<name>` (devices.rs:562-581). The client never handles that URL.

A paired device may use all of this (web/cast.rs:1-2).

## 6. Quick reference by screen

| Screen | Calls |
|---|---|
| Home | `GET /api/home`, art per `TitleCard` |
| Search titles | `GET /api/titles?q=` |
| Search torrents | `POST /api/search` (NDJSON) |
| Title page | `GET /api/title?id=`, `POST /api/library`, `GET /api/title/sources?video=` (NDJSON), episode art `kind=thumbnail&season&episode` |
| Play title | `POST /api/title/play` (NDJSON), then `GET /api/media`, file URL or `/api/stream`, `POST /api/watched` |
| Downloads | `GET /api/events` (SSE) or `GET /api/jobs`, `POST /api/files`, `POST /api/pause\|resume\|remove` |
| Add magnet or .torrent URL | `POST /api/play {ref}` (starts it) |
| Devices | Mac-only. A phone can only call `GET /api/me`. |
| Cast | `GET/POST /api/tvs`, `POST /api/cast`, `POST /api/cast/control` |

## 7. Gotchas for a native client

1. **`Job.info_hash` in wire.ts is wrong.** The engine sends `{ v1?: string; v2?: string }`, not a string (**live** `"info_hash":{"v1":"c35a…"}`). The cause is that `crates/core/src/ts.rs:31` maps `InfoHash => "string"`, while `crates/core/src/id.rs:81-93` serializes an object. Use `Job.id` as the key.
2. **Cookie handling.** The token only ever comes in `Set-Cookie` on `POST /api/pair`. The body holds just `{device}`. Capture it once, store it in secure storage, and send `Cookie: torrential_device=…` yourself on every request, including ExoPlayer's media source headers. A separate HTTP stack, such as ExoPlayer's data source, does not share RN's cookie jar. Whether RN's Android `fetch` exposes `set-cookie` to JS is a guess to check on the device. If it does not, read it from the native cookie store.
3. **The cookie never expires on the server.** Don't rely on `Max-Age`. Re-pair only on 401 `not_paired` or a 303 to `/pair`.
4. **Pair without a cookie.** `POST /api/pair` from an already-paired caller gets 404.
5. **The engine is invisible on the LAN until the Mac opens a code.** Until then it listens on 127.0.0.1 only (**live**). After pairing it stays on the network while any device is paired.
6. **`Host` must carry port 47919** and name the IP that was dialed, the `.local` name, or the tailnet name. A port forward or proxy changes the port and gets 403 text/plain (http.rs:1071). An Android emulator dialing `10.0.2.2` reaches the Mac over loopback with a non-loopback `Host`, so it gets 403. Inferred from code: with `adb reverse tcp:47919 tcp:47919`, `127.0.0.1` makes the phone `Asker::Local`, meaning full Mac rights with no pairing. That works for development but does not exercise the paired path.
7. **Android cleartext.** The engine is plain HTTP on the LAN and Tailscale, so the app needs a network security config that allows cleartext (or `usesCleartextTraffic`).
8. **Streaming bodies.** Search, sources, title/play and ffmpeg are NDJSON over chunked HTTP, and events are SSE. RN's default `fetch` on Android does not stream response bodies. Use `expo/fetch` (streaming), or a native or XHR-progress reader, and an SSE client library. Never abort `/api/title/play` early unless you mean to cancel.
9. **Every POST needs `Content-Type: application/json`.** Without it the answer is 415 with an empty body, not JSON.
10. **Error bodies are not always JSON.** Guard refusals (403, 307, 405, 411, 413, 415, 429) have empty or text bodies. Branch on status first.
11. **Direct play first.** For ExoPlayer, prefer `PlayInfo.video.url`, prefixed with the base URL, over `/api/stream`. `MediaInfo.direct` answers "can a *browser* play it", so it is `null` for every MKV. Ignore it and decide from `MediaInfo.video.codec` and `audio[].codec` against `MediaCodecList`. Fall back to `/api/stream?video=h264` or `copy` only for codecs the device lacks. That stream is unseekable and starts at PTS `t`.
12. **Thumbnails need a prior `GET /api/media`**, and they 404 for parts not downloaded yet. Treat 404 and 503 as "no frame".
13. **Rank sources for the phone.** Send `viewer` (screen in device pixels, `playback`, and `decoders` from `MediaCodecList`) to `title/play` and `title/sources`. Otherwise the engine ranks for `External`. The title play still filters with `Plays::BROWSER` (browser or remuxable containers, web/titles.rs:229), which is stricter than ExoPlayer needs.
14. **No `.torrent` upload.** Only magnets, infohashes and `.torrent` URLs work. A picked `.torrent` file would need converting to a magnet on the device. `POST /engine` with Bearer refuses local `.torrent` paths to devices too.
15. **Rate limits.** 10 pair tries per minute per IP. Over 30 bad tokens per minute from one IP gets 429 for every request carrying a token from that IP, until the minute ends.
16. **Removal kills streams at once.** A removed device's open video, SSE and NDJSON connections are cut mid-body (http.rs:527-531). Treat an abrupt EOF as a cue to check `GET /api/me`.
17. **IDs.** `id` and `file` params need the full 40-hex download ID (web/mod.rs:254-260). `SHORT_ID = 6` is for display only.
