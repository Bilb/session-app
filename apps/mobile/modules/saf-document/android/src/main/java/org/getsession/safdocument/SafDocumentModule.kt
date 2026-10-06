package org.getsession.safdocument

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import android.webkit.MimeTypeMap
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileNotFoundException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private const val MAX_ATTEMPTS = 1000

/** Matches `FOLDER_ACCESS_LOST` in `src/safDocument.ts`. */
private const val FOLDER_ACCESS_LOST = "ERR_FOLDER_ACCESS_LOST"

/** `name`, then `name (1)`, `name (2)`, ... with the extension kept, as `numberedName`. */
private fun numbered(name: String, attempt: Int): String {
  if (attempt == 0) return name
  val dot = name.lastIndexOf('.')
  return if (dot <= 0) "$name ($attempt)" else "${name.substring(0, dot)} ($attempt)${name.substring(dot)}"
}

/** `name.sessiondl`, then `name.sessiondl1`, ..., as `partName`. */
private fun part(name: String, attempt: Int): String =
  if (attempt == 0) "$name.sessiondl" else "$name.sessiondl$attempt"

private fun firstFree(taken: Set<String>, name: String, nameFor: (String, Int) -> String): String =
  (0 until MAX_ATTEMPTS).asSequence().map { nameFor(name, it) }.firstOrNull { it !in taken }
    ?: throw CodedException("ERR_NO_FREE_NAME", "every name up to $MAX_ATTEMPTS is taken", null)

/** Every display name in the folder, in one query. A refused query is an error, never "empty". */
private fun childNames(resolver: ContentResolver, tree: Uri, folderId: String): Set<String> {
  val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, folderId)
  val cursor = resolver.query(children, arrayOf(Document.COLUMN_DISPLAY_NAME), null, null, null)
    ?: throw CodedException(FOLDER_ACCESS_LOST, "the provider refused to list $tree", null)
  return cursor.use { buildSet { while (it.moveToNext()) it.getString(0)?.let(::add) } }
}

private fun flagsOf(resolver: ContentResolver, document: Uri): Int =
  resolver.query(document, arrayOf(Document.COLUMN_FLAGS), null, null, null)?.use {
    if (it.moveToFirst()) it.getInt(0) else 0
  } ?: 0

private fun mimeTypeOf(name: String): String =
  MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substringAfterLast('.', "").lowercase())
    ?: "application/octet-stream"

private fun create(resolver: ContentResolver, folder: Uri, mimeType: String, name: String): Uri =
  DocumentsContract.createDocument(resolver, folder, mimeType, name)
    ?: throw CodedException("ERR_CREATE_REFUSED", "the provider refused to create $name", null)

private fun write(resolver: ContentResolver, document: Uri, source: File) {
  val out = resolver.openOutputStream(document, "w")
    ?: throw CodedException("ERR_OPEN_REFUSED", "the provider refused to open $document", null)
  out.use { sink -> FileInputStream(source).use { it.copyTo(sink) } }
}

private fun deleteQuietly(resolver: ContentResolver, document: Uri) {
  try {
    DocumentsContract.deleteDocument(resolver, document)
  } catch (_: Exception) {
    // A provider that refuses delete leaves it; the failure being reported is the write's.
  }
}

/**
 * Lands `source` in the picked tree under a name nothing there has, and returns its URI.
 *
 * Written under a temporary name and renamed once whole, so a copy that dies cannot leave a file
 * that looks complete. A provider whose documents cannot be renamed gets the file written under
 * its final name instead.
 */
private fun deliver(context: Context, treeUri: String, sourcePath: String, name: String): String {
  val resolver = context.contentResolver
  val tree = Uri.parse(treeUri)
  val folderId = DocumentsContract.getTreeDocumentId(tree)
  val folder = DocumentsContract.buildDocumentUriUsingTree(tree, folderId)
  val source = File(sourcePath)

  val taken = try {
    childNames(resolver, tree, folderId)
  } catch (lost: SecurityException) {
    throw CodedException(FOLDER_ACCESS_LOST, lost.message ?: "the folder's grant is gone", lost)
  } catch (lost: FileNotFoundException) {
    throw CodedException(FOLDER_ACCESS_LOST, lost.message ?: "the folder is gone", lost)
  }
  val landedName = firstFree(taken, name, ::numbered)
  // An octet stream, or the provider would hang the type's extension on the temporary name; the
  // rename gives it the real name and the type that goes with it.
  val temporary = create(resolver, folder, "application/octet-stream", firstFree(taken, landedName, ::part))

  if ((flagsOf(resolver, temporary) and Document.FLAG_SUPPORTS_RENAME) == 0) {
    deleteQuietly(resolver, temporary)
    val landed = create(resolver, folder, mimeTypeOf(landedName), landedName)
    try {
      write(resolver, landed, source)
    } catch (failure: Throwable) {
      deleteQuietly(resolver, landed)
      throw failure
    }
    return landed.toString()
  }

  try {
    write(resolver, temporary, source)
    return (DocumentsContract.renameDocument(resolver, temporary, landedName)
      ?: throw CodedException("ERR_RENAME_REFUSED", "the provider refused to rename $temporary", null))
      .toString()
  } catch (failure: Throwable) {
    deleteQuietly(resolver, temporary)
    throw failure
  }
}

class SafDocumentModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SafDocument")

    // Off the shared AsyncFunction queue: a large file into a cloud provider would otherwise hold
    // up every other module's async call until it finished.
    AsyncFunction("deliver") Coroutine { treeUri: String, sourcePath: String, name: String ->
      val context = appContext.reactContext
        ?: throw CodedException("ERR_NO_CONTEXT", "no application context", null)
      withContext(Dispatchers.IO) { deliver(context, treeUri, sourcePath, name) }
    }
  }
}
