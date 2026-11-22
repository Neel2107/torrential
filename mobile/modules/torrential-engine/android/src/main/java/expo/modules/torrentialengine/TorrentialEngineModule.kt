package expo.modules.torrentialengine

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TorrentialEngineModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TorrentialEngine")

    Constant("port") { Engine.PORT }

    AsyncFunction("start") {
      val context = appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "The app has no context yet", null)
      EngineService.start(context)
      val home = EngineService.home(context)
      val port = Engine.start(home.path, Engine.PORT)
      if (port <= 0) throw CodedException("ERR_ENGINE", "The engine did not start ($port)", null)
      mapOf("port" to port, "secret" to Engine.secret(home))
    }
  }
}
