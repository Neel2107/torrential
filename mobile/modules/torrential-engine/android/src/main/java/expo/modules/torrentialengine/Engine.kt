package expo.modules.torrentialengine

object Engine {
  const val PORT = 47929

  init {
    System.loadLibrary("torrential_mobile")
  }

  @JvmStatic external fun start(home: String, port: Int): Int

  fun secret(home: java.io.File): String = java.io.File(home, "app-secret").readText().trim()
}
