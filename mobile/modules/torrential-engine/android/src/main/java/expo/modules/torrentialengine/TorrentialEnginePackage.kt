package expo.modules.torrentialengine

import android.app.Application
import android.content.Context
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

/** Starts this phone's engine as the app's process starts, while JavaScript loads, when the phone's engine is the one in use. */
class TorrentialEnginePackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(object : ApplicationLifecycleListener {
      override fun onCreate(application: Application) {
        val home = EngineService.home(application)
        if (!Launch.wanted(home)) return
        Thread({ Engine.start(home.path, Engine.PORT) }, "torrential-engine-launch").start()
      }
    })
}

/** Whether the engine starts with the app: a file in the engine's folder, written when JavaScript starts the engine and removed when it uses another. */
object Launch {
  private fun marker(home: java.io.File) = java.io.File(home, "start-at-launch")

  fun wanted(home: java.io.File): Boolean = marker(home).exists()

  fun set(home: java.io.File, on: Boolean) {
    if (on) {
      home.mkdirs()
      marker(home).writeText("")
    } else {
      marker(home).delete()
    }
  }
}
