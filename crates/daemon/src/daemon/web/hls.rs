//! The video as HLS, for players that take nothing else from a live conversion. AVPlayer on iOS
//! plays progressive video only from a server that answers Range requests, which a conversion that
//! is still being written cannot, so `/api/stream` does not play there. The same conversion written
//! as HLS segments into a folder does.
//!
//! A seek starts a new session, but the old one is not stopped at once: the player's old item may
//! still reload its playlist while the new one starts, and stopping it would start it again and stop
//! the new one.

use std::collections::HashMap;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::io;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use tokio::io::AsyncReadExt;
use tokio::process::Child;
use torrential_core::{Error, ErrorCode};

use super::super::ctx::Ctx;
use super::super::http::{Connection, Request};
use super::super::media::ffmpeg::Picture;
use super::super::media::{self};
use super::{fail, file_of, number};

const SEGMENT_SECONDS: &str = "4";
const IDLE: Duration = Duration::from_secs(60);
const PER_FILE: usize = 3;
const FIRST_SEGMENT: Duration = Duration::from_secs(90);
const POLL: Duration = Duration::from_millis(200);
const PLAYLIST: &str = "application/vnd.apple.mpegurl";

struct Session {
    file: (String, u32),
    dir: PathBuf,
    child: Child,
    last: Instant,
}

static SESSIONS: LazyLock<Mutex<HashMap<String, Session>>> = LazyLock::new(Mutex::default);

pub async fn answer(conn: &mut Connection<'_>, request: &Request, route: &str) -> io::Result<bool> {
    sweep();
    match route.strip_prefix("hls/") {
        Some("index.m3u8") => playlist(conn, request).await,
        Some(rest) => match rest.split_once('/') {
            Some((key, name)) => segment(conn, request, key, name).await,
            None => fail(conn, request, &not_found()).await,
        },
        None => fail(conn, request, &not_found()).await,
    }
}

fn not_found() -> Error {
    Error::new(ErrorCode::NotFound, "no such HLS session or segment; ask for the playlist again")
}

async fn playlist(conn: &mut Connection<'_>, request: &Request) -> io::Result<bool> {
    let ctx = conn.ctx;
    let started = tokio::select! {
        started = start(ctx, request) => started,
        gone = conn.gone() => return Err(gone),
    };
    let (key, dir) = match started {
        Ok(started) => started,
        Err(error) => return fail(conn, request, &error).await,
    };
    let ready = tokio::select! {
        ready = first_segment(&key, &dir) => ready,
        gone = conn.gone() => return Err(gone),
    };
    match ready {
        Ok(text) => {
            let body = rewrite(&text, &key);
            conn.send("200 OK", PLAYLIST, "Cache-Control: no-store\r\n", body.as_bytes(), request).await
        }
        Err(error) => fail(conn, request, &error).await,
    }
}

async fn start(ctx: &Ctx, request: &Request) -> Result<(String, PathBuf), Error> {
    let (id, index) = file_of(request)?;
    let t = number::<f64>(request, "t")?.unwrap_or(0.0);
    let audio = number::<u32>(request, "audio")?;
    let picture = match request.param("video").as_deref() {
        None | Some("copy") => Picture::Copy,
        Some("h264") => Picture::H264,
        Some(other) => return Err(Error::new(ErrorCode::Usage, format!("video={other} is not copy or h264"))),
    };
    let file = (id.to_string(), index);
    let key = session_key(&file, t, audio, picture);
    if let Some(session) = SESSIONS.lock().expect("no holder panics").get_mut(&key) {
        session.last = Instant::now();
        return Ok((key, session.dir.clone()));
    }

    let (program, args, _) = media::stream(ctx, id, index, t, audio, picture).await?;
    let dir = std::env::temp_dir().join("torrential-hls").join(&key);
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir)
        .map_err(|e| Error::new(ErrorCode::StorageError, format!("cannot make {}: {e}", dir.display())))?;
    let child = tokio::process::Command::new(&program)
        .args(as_hls(args, &dir))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| crate::ffmpeg::cannot_run(&program, &e))?;

    let mut sessions = SESSIONS.lock().expect("no holder panics");
    let mut siblings: Vec<(String, Instant)> =
        sessions.iter().filter(|(_, s)| s.file == file).map(|(k, s)| (k.clone(), s.last)).collect();
    siblings.sort_by_key(|(_, last)| *last);
    while siblings.len() >= PER_FILE {
        let (oldest, _) = siblings.remove(0);
        if let Some(session) = sessions.remove(&oldest) {
            stop(session);
        }
    }
    sessions.insert(key.clone(), Session { file, dir: dir.clone(), child, last: Instant::now() });
    Ok((key, dir))
}

fn as_hls(args: Vec<String>, dir: &Path) -> Vec<String> {
    let mut args: Vec<String> = args.into_iter().filter(|arg| arg != "-copyts").collect();
    if let Some(at) = args.iter().position(|arg| arg == "-movflags") {
        args.truncate(at);
    }
    let path = |name: &str| dir.join(name).to_string_lossy().into_owned();
    args.extend(
        [
            "-f",
            "hls",
            "-hls_time",
            SEGMENT_SECONDS,
            "-hls_list_size",
            "0",
            "-hls_playlist_type",
            "event",
            "-hls_segment_type",
            "fmp4",
            "-hls_fmp4_init_filename",
            "init.mp4",
            "-hls_flags",
            "independent_segments+temp_file",
            "-hls_segment_filename",
        ]
        .map(String::from),
    );
    args.push(path("segment%05d.m4s"));
    args.push(path("index.m3u8"));
    args
}

fn session_key(file: &(String, u32), t: f64, audio: Option<u32>, picture: Picture) -> String {
    let mut hasher = DefaultHasher::new();
    (file, (t * 1000.0).round() as i64, audio, matches!(picture, Picture::Copy)).hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

async fn first_segment(key: &str, dir: &Path) -> Result<String, Error> {
    let deadline = Instant::now() + FIRST_SEGMENT;
    loop {
        if let Ok(text) = tokio::fs::read_to_string(dir.join("index.m3u8")).await
            && text.contains("#EXTINF")
        {
            return Ok(text);
        }
        let exited = {
            let mut sessions = SESSIONS.lock().expect("no holder panics");
            match sessions.get_mut(key) {
                Some(session) => session.child.try_wait().ok().flatten().is_some(),
                None => return Err(not_found()),
            }
        };
        if exited {
            let complaint = complaint(key).await;
            return Err(Error::internal(format!("ffmpeg cannot convert this file: {complaint}")));
        }
        if Instant::now() > deadline {
            return Err(Error::new(ErrorCode::Interrupted, "the first seconds of video did not arrive in time")
                .with_hint("the download may have no peers; try again or pick another source"));
        }
        tokio::time::sleep(POLL).await;
    }
}

async fn complaint(key: &str) -> String {
    let stderr = SESSIONS.lock().expect("no holder panics").get_mut(key).and_then(|s| s.child.stderr.take());
    let Some(mut stderr) = stderr else { return String::new() };
    let mut kept = Vec::new();
    let _ = tokio::time::timeout(Duration::from_secs(1), stderr.read_to_end(&mut kept)).await;
    String::from_utf8_lossy(&kept[..kept.len().min(4096)]).into_owned()
}

fn rewrite(text: &str, key: &str) -> String {
    text.lines()
        .map(|line| {
            if let Some(rest) = line.strip_prefix("#EXT-X-MAP:URI=\"") {
                format!("#EXT-X-MAP:URI=\"{key}/{rest}")
            } else if !line.is_empty() && !line.starts_with('#') {
                format!("{key}/{line}")
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
        + "\n"
}

async fn segment(conn: &mut Connection<'_>, request: &Request, key: &str, name: &str) -> io::Result<bool> {
    let safe = !name.contains('/') && !name.contains("..") && (name.ends_with(".m4s") || name == "init.mp4");
    let dir = SESSIONS.lock().expect("no holder panics").get_mut(key).map(|session| {
        session.last = Instant::now();
        session.dir.clone()
    });
    let (Some(dir), true) = (dir, safe) else { return fail(conn, request, &not_found()).await };
    match tokio::fs::read(dir.join(name)).await {
        Ok(bytes) => conn.send("200 OK", "video/mp4", "Cache-Control: no-store\r\n", &bytes, request).await,
        Err(_) => fail(conn, request, &not_found()).await,
    }
}

fn sweep() {
    let mut sessions = SESSIONS.lock().expect("no holder panics");
    let idle: Vec<String> = sessions.iter().filter(|(_, s)| s.last.elapsed() > IDLE).map(|(k, _)| k.clone()).collect();
    for key in idle {
        if let Some(session) = sessions.remove(&key) {
            stop(session);
        }
    }
}

fn stop(mut session: Session) {
    let _ = session.child.start_kill();
    let dir = session.dir;
    tokio::spawn(async move {
        let _ = session.child.wait().await;
        let _ = tokio::fs::remove_dir_all(dir).await;
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_stream_conversion_becomes_hls_in_the_folder() {
        let args: Vec<String> = [
            "-v",
            "error",
            "-copyts",
            "-i",
            "URL",
            "-map",
            "0:0",
            "-c:v",
            "copy",
            "-movflags",
            "frag",
            "-f",
            "mp4",
            "pipe:1",
        ]
        .map(String::from)
        .to_vec();
        let hls = as_hls(args, Path::new("/tmp/s"));
        assert!(!hls.contains(&"-copyts".to_string()), "timestamps start at zero");
        assert!(!hls.contains(&"pipe:1".to_string()), "nothing goes to stdout");
        assert_eq!(hls.last().map(String::as_str), Some("/tmp/s/index.m3u8"));
        assert!(hls.windows(2).any(|w| w[0] == "-hls_segment_type" && w[1] == "fmp4"));
    }

    #[test]
    fn the_playlist_names_segments_inside_the_session() {
        let text = "#EXTM3U\n#EXT-X-MAP:URI=\"init.mp4\"\n#EXTINF:4.0,\nsegment00000.m4s\n";
        let out = rewrite(text, "abc");
        assert!(out.contains("#EXT-X-MAP:URI=\"abc/init.mp4\""));
        assert!(out.contains("\nabc/segment00000.m4s\n"));
    }
}
