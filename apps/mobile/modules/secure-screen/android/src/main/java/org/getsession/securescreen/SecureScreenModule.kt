package org.getsession.securescreen

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.PersistableBundle
import android.view.WindowManager
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SecureScreenModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SecureScreen")

    // The window's secure flag: kept out of screenshots, recordings and the recents thumbnail.
    // On the main queue, the only thread a window's flags may be changed from, and resolved once
    // it is set: a dialog made after that copies it, and one made before does not.
    AsyncFunction("setSecure") { secure: Boolean ->
      val window = appContext.currentActivity?.window ?: return@AsyncFunction
      if (secure) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }.runOnQueue(Queues.MAIN)

    // A copy the system preview (Android 13 and later) shows as dots rather than the text.
    // The extra is the documented string before 13, where nothing reads it but some keyboards.
    AsyncFunction("copySensitive") { text: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      val clip = ClipData.newPlainText("", text)
      val key =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) ClipDescription.EXTRA_IS_SENSITIVE
        else "android.content.extra.IS_SENSITIVE"
      clip.description.extras = PersistableBundle().apply { putBoolean(key, true) }
      clipboard.setPrimaryClip(clip)
    }
  }
}
