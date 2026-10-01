package org.getsession.processexit

import android.os.Process
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ProcessExitModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ProcessExit")

    // Ends the process at once, rather than finishing the activity and leaving the process --
    // and libsession in it -- running. A signal rather than `System.exit`, which runs the native
    // `atexit` handlers and static destructors while libsession's threads are still using them.
    // The task is taken out of recents first, so the app is gone rather than shown as running.
    Function("terminate") {
      appContext.currentActivity?.finishAndRemoveTask()
      Process.killProcess(Process.myPid())
    }
  }
}
