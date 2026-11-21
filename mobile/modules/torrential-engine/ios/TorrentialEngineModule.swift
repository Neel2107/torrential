import ExpoModulesCore

/// Starts torrential's engine with `home` as its folder if it is not running, and waits until it
/// answers. Returns its port, or a negative error.
@_silgen_name("torrential_start")
private func torrentialStart(_ home: UnsafePointer<CChar>, _ port: UInt16) -> Int32

/// Not the computer engine's 47919, which development reaches over the network.
private let port = 47929

public class TorrentialEngineModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TorrentialEngine")

    Constant("port") { port }

    /// Starts the engine in the app's own folder, waits until it answers, and gives its port and the
    /// secret it lets loopback callers in with. iOS pauses it with the app.
    AsyncFunction("start") { () -> [String: Any] in
      let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      let home = support.appendingPathComponent("engine", isDirectory: true)
      try FileManager.default.createDirectory(at: home, withIntermediateDirectories: true)
      let served = home.path.withCString { torrentialStart($0, UInt16(port)) }
      if served <= 0 {
        throw Exception(name: "ERR_ENGINE", description: "The engine did not start (\(served))")
      }
      let secret = try String(contentsOf: home.appendingPathComponent("app-secret"), encoding: .utf8)
      return ["port": Int(served), "secret": secret.trimmingCharacters(in: .whitespacesAndNewlines)]
    }
  }
}
