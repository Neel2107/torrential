use std::ffi::{CStr, c_char};
use std::net::{SocketAddr, TcpStream};
use std::path::Path;
use std::sync::Mutex;
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use torrential_daemon::env::Env;

static ENGINE: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);

const CONFIG: &str = "updates: off\nplays:\n  max: 8GiB\n";
const READY_WITHIN: Duration = Duration::from_secs(20);

const HOME_UNUSABLE: i32 = -1;
const ENGINE_STOPPED: i32 = -2;
const NOT_READY: i32 = -3;

fn start(home: &Path, port: u16) -> i32 {
    let Ok(secret) = prepare(home) else { return HOME_UNUSABLE };
    torrential_daemon::daemon::require_loopback_secret(secret);
    {
        let mut engine = ENGINE.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        if !engine.as_ref().is_some_and(|thread| !thread.is_finished()) {
            let folder = home.to_string_lossy().into_owned();
            let spawned = std::thread::Builder::new().name("torrential-engine".into()).spawn(move || {
                let env = Env::from_pairs([("HOME", folder.as_str()), ("TORRENTIAL_HOME", folder.as_str())]);
                torrential_daemon::daemon::run(&env, false, Some(port), false);
            });
            match spawned {
                Ok(thread) => *engine = Some(thread),
                Err(_) => return ENGINE_STOPPED,
            }
        }
    }
    ready(home)
}

fn prepare(home: &Path) -> std::io::Result<String> {
    std::fs::create_dir_all(home.join("config"))?;
    let config = home.join("config/config.yaml");
    if !config.exists() {
        write_whole(&config, CONFIG.as_bytes())?;
    }
    let file = home.join("app-secret");
    match std::fs::read_to_string(&file) {
        Ok(secret) if secret.trim().len() == 64 => Ok(secret.trim().to_string()),
        _ => {
            let mut bytes = [0u8; 32];
            getrandom::fill(&mut bytes).map_err(|e| std::io::Error::other(e.to_string()))?;
            let secret: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
            write_whole(&file, secret.as_bytes())?;
            Ok(secret)
        }
    }
}

fn write_whole(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let partial = path.with_extension("partial");
    std::fs::write(&partial, bytes)?;
    std::fs::rename(partial, path)
}

fn ready(home: &Path) -> i32 {
    let deadline = Instant::now() + READY_WITHIN;
    while Instant::now() < deadline {
        let stopped = ENGINE.lock().map(|engine| engine.as_ref().is_none_or(JoinHandle::is_finished)).unwrap_or(true);
        if stopped {
            return ENGINE_STOPPED;
        }
        let written = std::fs::read_to_string(home.join("state/http-port")).ok();
        if let Some(port) = written.and_then(|text| text.trim().parse::<u16>().ok()) {
            let address = SocketAddr::from(([127, 0, 0, 1], port));
            if TcpStream::connect_timeout(&address, Duration::from_millis(200)).is_ok() {
                return i32::from(port);
            }
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    NOT_READY
}

/// # Safety
/// `home` is a NUL-terminated UTF-8 path that stays valid for the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn torrential_start(home: *const c_char, port: u16) -> i32 {
    if home.is_null() {
        return HOME_UNUSABLE;
    }
    let home = unsafe { CStr::from_ptr(home) }.to_string_lossy().into_owned();
    start(Path::new(&home), port)
}

#[cfg(target_os = "android")]
mod android {
    use jni::JNIEnv;
    use jni::objects::{JClass, JString};
    use jni::sys::jint;

    #[unsafe(no_mangle)]
    pub extern "system" fn Java_expo_modules_torrentialengine_Engine_start(
        mut env: JNIEnv,
        _class: JClass,
        home: JString,
        port: jint,
    ) -> jint {
        let Ok(home) = env.get_string(&home) else { return super::HOME_UNUSABLE };
        let home: String = home.into();
        super::start(std::path::Path::new(&home), port as u16)
    }
}
