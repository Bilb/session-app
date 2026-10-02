package org.getsession.safdocument

import android.net.Uri
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream

private const val MAX_ATTEMPTS = 1000

/** `name`, then `name (1)`, `name (2)`, ... with the extension kept. */
private fun numbered(name: String, attempt: Int): String {
  if (attempt == 0) return name
  val dot = name.lastIndexOf('.')
  return if (dot <= 0) "$name ($attempt)" else "${name.substring(0, dot)} ($attempt)${name.substring(dot)}"
}

class SafDocumentModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SafDocument")

    // Lands a file in a picked document tree under a name nothing there has, written as
    // `<name>.part` and renamed once whole, so a copy that dies cannot leave a file that looks
    // complete. expo-file-system exposes no SAF rename, and its display-name probe is wrong on a
    // provider with opaque document ids; `findFile` asks the provider itself.
    AsyncFunction("deliver") { treeUri: String, sourcePath: String, name: String ->
      val context = appContext.reactContext
        ?: throw CodedException("ERR_NO_CONTEXT", "no application context", null)
      val folder = DocumentFile.fromTreeUri(context, Uri.parse(treeUri))
        ?: throw CodedException("ERR_NOT_A_TREE", "$treeUri is not a document tree", null)
      val landedName = (0 until MAX_ATTEMPTS).map { numbered(name, it) }.firstOrNull { folder.findFile(it) == null }
        ?: throw CodedException("ERR_NO_FREE_NAME", "every name up to $MAX_ATTEMPTS is taken", null)
      val partName = "$landedName.part"
      folder.findFile(partName)?.delete()
      // An octet stream, or the provider would hang the type's extension on the temporary name;
      // the rename gives it the real name and the type that goes with it.
      val part = folder.createFile("application/octet-stream", partName)
        ?: throw CodedException("ERR_CREATE_REFUSED", "the provider refused to create $partName", null)
      try {
        val resolver = context.contentResolver
        val out = resolver.openOutputStream(part.uri, "w")
          ?: throw CodedException("ERR_OPEN_REFUSED", "the provider refused to open $partName", null)
        out.use { sink -> FileInputStream(File(sourcePath)).use { it.copyTo(sink) } }
        val landed = DocumentsContract.renameDocument(resolver, part.uri, landedName)
          ?: throw CodedException("ERR_RENAME_REFUSED", "the provider refused to rename $partName", null)
        landed.toString()
      } catch (failure: Throwable) {
        part.delete()
        throw failure
      }
    }
  }
}
