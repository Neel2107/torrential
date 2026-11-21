package expo.modules.torrentialengine

/** torrential's engine, built from crates/mobile, running inside the app on loopback. */
object Engine {
  /** Not the computer engine's 47919, which development forwards to the phone over USB. */
  const val PORT = 47929

  init {
    System.loadLibrary("torrential_mobile")
  }

  /** Starts the engine on its own thread with `home` as its folder. Later calls do nothing. 0 when it started. */
  @JvmStatic external fun start(home: String, port: Int): Int
}
