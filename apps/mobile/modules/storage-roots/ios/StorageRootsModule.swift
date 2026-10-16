import ExpoModulesCore

/// The protected roots, to JavaScript. See `ProtectedRoots`.
public class StorageRootsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StorageRoots")

    /// Plain paths rather than URLs: libsession takes paths, and the storage module makes the
    /// `file://` form expo-file-system wants.
    Constant("roots") { () -> [String: String] in
      let paths = ProtectedRoots.paths
      return [
        "data": paths.data.path, "logs": paths.logs.path, "exports": paths.exports.path,
        "staged": paths.staged.path,
      ]
    }

    /// Where the roots are, for the startup block.
    Constant("location") { () -> String in
      ProtectedRoots.paths.inAppGroup ? "app group" : "Application Support (no app group)"
    }

    Function("ensure") { () -> [String] in
      ProtectedRoots.ensure()
    }

    Function("protect") { (path: String) throws -> Bool in
      try ProtectedRoots.protect(URL(fileURLWithPath: path))
    }

    Function("inspect") { (path: String) throws -> [String: Any] in
      try ProtectedRoots.inspect(URL(fileURLWithPath: path))
    }
  }
}
