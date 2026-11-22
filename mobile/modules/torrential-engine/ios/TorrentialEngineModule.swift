import ExpoModulesCore

@_silgen_name("torrential_start")
private func torrentialStart(_ home: UnsafePointer<CChar>, _ port: UInt16) -> Int32

private let port = 47929

public class TorrentialEngineModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TorrentialEngine")

    Constant("port") { port }

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
