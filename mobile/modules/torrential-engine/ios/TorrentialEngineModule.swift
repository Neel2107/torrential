import ExpoModulesCore

/// Starts torrential's engine on its own thread with `home` as its folder. Later calls do nothing.
@_silgen_name("torrential_start")
private func torrentialStart(_ home: UnsafePointer<CChar>, _ port: UInt16) -> Int32

/// Not the computer engine's 47919, which development reaches over the network.
private let port = 47929

public class TorrentialEngineModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TorrentialEngine")

    Constant("port") { port }

    /// Starts the engine in the app's own folder and answers with its port. iOS pauses it with the app.
    AsyncFunction("start") { () -> Int in
      let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      let home = support.appendingPathComponent("engine", isDirectory: true)
      try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true)
      let started = home.path.withCString { torrentialStart($0, UInt16(port)) }
      if started != 0 {
        throw Exception(name: "ERR_ENGINE", description: "The engine could not use \(home.path)")
      }
      return port
    }
  }
}
