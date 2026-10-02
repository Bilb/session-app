package org.getsession.processexit

import android.content.Intent
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

    // Starts the launcher activity in a new task that replaces this one, then ends the process
    // the same way `terminate` does. The start is handed to the system before the kill, so the
    // relaunch is a fresh process with nothing of this one's memory.
    Function("restart") {
      val context = appContext.reactContext
      val component =
        context?.packageManager?.getLaunchIntentForPackage(context.packageName)?.component
      if (context != null && component != null) {
        context.startActivity(Intent.makeRestartActivityTask(component))
        Process.killProcess(Process.myPid())
      }
    }
  }
}
