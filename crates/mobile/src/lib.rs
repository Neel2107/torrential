//! torrential's engine inside the phone app. The app calls `torrential_start` once with a folder of
//! its own; the engine keeps everything under it and serves the same HTTP API as on a computer, on
//! loopback, where the app trusts it without pairing.

use std::ffi::{CStr, c_char};
use std::path::Path;
use std::sync::OnceLock;

use torrential_daemon::env::Env;

/// The engine's thread, started at most once per process.
static STARTED: OnceLock<()> = OnceLock::new();

/// What the phone's engine is told before it starts: never update itself, and keep the plays it
/// streams within what a phone can spare.
const CONFIG: &str = "updates: off\nplays:\n  max: 8GiB\n";

/// Starts the engine on its own thread with `home` as its folder and `port` for its HTTP API, and
/// returns at once. A second call does nothing. Returns 0, or 1 when `home` cannot be used.
fn start(home: &Path, port: u16) -> i32 {
    let config = home.join("config");
    if std::fs::create_dir_all(&config).is_err() {
        return 1;
    }
    let file = config.join("config.yaml");
    if !file.exists() && std::fs::write(&file, CONFIG).is_err() {
        return 1;
    }
    STARTED.get_or_init(|| {
        let home = home.to_string_lossy().into_owned();
        std::thread::Builder::new()
            .name("torrential-engine".into())
            .spawn(move || {
                let env = Env::from_pairs([("HOME", home.as_str()), ("TORRENTIAL_HOME", home.as_str())]);
                torrential_daemon::daemon::run(&env, false, Some(port), false);
            })
            .expect("a thread for the engine");
    });
    0
}

/// # Safety
/// `home` is a NUL-terminated UTF-8 path that stays valid for the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn torrential_start(home: *const c_char, port: u16) -> i32 {
    if home.is_null() {
        return 1;
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
        let Ok(home) = env.get_string(&home) else { return 1 };
        let home: String = home.into();
        super::start(std::path::Path::new(&home), port as u16)
    }
}
