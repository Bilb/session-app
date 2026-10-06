import ExpoModulesCore

public class ProcessExitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ProcessExit")

    /// Ends the process at once.
    ///
    /// **`_exit`, never `exit`.** `exit` runs C++ static destructors and `atexit` handlers --
    /// SQLCipher's shutdown and libsession's logger among them -- while libsession's threads are
    /// still running, which then crash on the freed state, and a database write in flight when
    /// SQLCipher shuts down can corrupt the encrypted database. Nothing persists from those
    /// handlers: the database is in WAL mode, so every committed transaction is already durable.
    Function("terminate") { () -> Void in
      _exit(0)
    }
  }
}
