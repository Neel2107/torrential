package expo.modules.torrentialengine

/** torrential's engine, built from crates/mobile, running inside the app on loopback. */
object Engine {
  /** Not the computer engine's 47919, which development forwards to the phone over USB. */
  const val PORT = 47929

  init {
    System.loadLibrary("torrential_mobile")
  }

  /**
   * Starts the engine with `home` as its folder if it is not running, and waits until it answers.
   * Returns the port it serves on, or a negative error. Blocks, so never call it on the main thread.
   */
  @JvmStatic external fun start(home: String, port: Int): Int

  /** The secret the engine lets loopback callers in with, written by its first start. */
  fun secret(home: java.io.File): String = java.io.File(home, "app-secret").readText().trim()
}
