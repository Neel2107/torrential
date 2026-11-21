package expo.modules.torrentialengine

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TorrentialEngineModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TorrentialEngine")

    Constant("port") { Engine.PORT }

    /** Starts the engine in its foreground service and answers with its port. */
    AsyncFunction("start") {
      val context = appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "The app has no context yet", null)
      EngineService.start(context)
      Engine.PORT
    }
  }
}
