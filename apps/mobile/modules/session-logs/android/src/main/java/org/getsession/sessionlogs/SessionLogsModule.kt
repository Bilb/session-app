package org.getsession.sessionlogs

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Debug
import android.os.StatFs
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.zip.GZIPOutputStream

// The device logs' native half: compression off the JS thread, and the facts the export header
// needs that JavaScript cannot read. See the iOS module for why compression is here.
class SessionLogsModule : Module() {
  private val logFile = Regex("^session-\\d{8}T\\d{6}Z-\\d+\\.log$")

  override fun definition() = ModuleDefinition {
    Name("SessionLogs")

    // Parts in order through one gzip stream; a part is a text or a log file name in `directory`,
    // checked to be a bare log file name so it cannot reach outside it.
    AsyncFunction("gzip") { parts: List<Map<String, String>>, directory: String, outPath: String ->
      val out = File(outPath)
      GZIPOutputStream(FileOutputStream(out), 64 * 1024).use { gzip ->
        for (part in parts) {
          val text = part["text"]
          val name = part["file"]
          if (text != null) {
            gzip.write(text.toByteArray(Charsets.UTF_8))
          } else if (name != null) {
            require(logFile.matches(name)) { "not a log file name: $name" }
            // A file rotated away since the list was taken is skipped rather than failing.
            val file = File(directory, name)
            if (file.exists()) file.inputStream().use { it.copyTo(gzip, 64 * 1024) }
          }
        }
      }
      out.length().toInt()
    }

    AsyncFunction("diagnostics") {
      val context = appContext.reactContext ?: throw IllegalStateException("no context")
      val activity = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val memory = ActivityManager.MemoryInfo().also { activity.getMemoryInfo(it) }
      val process = Debug.MemoryInfo().also { Debug.getMemoryInfo(it) }
      mapOf(
        "model" to "${Build.MANUFACTURER} ${Build.MODEL}",
        "install" to install(context),
        "usedBytes" to process.totalPss.toLong() * 1024,
        "availableBytes" to memory.availMem,
        "totalBytes" to memory.totalMem,
        "freeBytes" to StatFs(context.filesDir.path).availableBytes,
        "permissions" to permissions(context),
      )
    }
  }

  // The installing package: com.android.vending is the Play Store; null is a sideload or adb.
  private fun install(context: Context): String {
    val installer =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        context.packageManager.getInstallSourceInfo(context.packageName).installingPackageName
      } else {
        @Suppress("DEPRECATION")
        context.packageManager.getInstallerPackageName(context.packageName)
      }
    return installer ?: "unknown"
  }

  // Granted or not: Android cannot tell "never asked" from "denied" without an activity.
  private fun permissions(context: Context): List<List<String>> {
    fun state(permission: String) =
      if (context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) "granted"
      else "not granted"
    val photos =
      if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_IMAGES
      else Manifest.permission.READ_EXTERNAL_STORAGE
    return listOfNotNull(
      listOf("camera", state(Manifest.permission.CAMERA)),
      listOf("microphone", state(Manifest.permission.RECORD_AUDIO)),
      listOf("photos", state(photos)),
      if (Build.VERSION.SDK_INT >= 33) {
        listOf("notifications", state(Manifest.permission.POST_NOTIFICATIONS))
      } else {
        null
      },
    )
  }
}
