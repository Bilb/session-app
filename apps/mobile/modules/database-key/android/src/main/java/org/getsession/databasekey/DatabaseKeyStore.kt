package org.getsession.databasekey

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import java.io.File
import java.security.KeyStore
import java.security.UnrecoverableKeyException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The database key, sealed with an Android Keystore key and kept in the app's no-backup files.
 *
 * Native rather than expo-secure-store so that the push service can read it with no JavaScript
 * running: a push that starts the app's process cold is handled there, as an iOS extension handles
 * one. The Keystore key never leaves the device and needs no screen unlock, so a message arriving
 * on a locked phone can still be written; no-backup storage keeps the sealed key out of backups.
 */
object DatabaseKeyStore {
  private const val ALIAS = "session.db.key"
  private const val FILE = "db-key.bin"
  private const val IV_BYTES = 12
  private const val TAG_BITS = 128

  /** Thrown when the Keystore won't answer now; the key may still be readable later. */
  class Unavailable(message: String, cause: Throwable? = null) : Exception(message, cause)

  private fun file(context: Context) = File(context.noBackupFilesDir, FILE)

  private fun keystore(): KeyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

  private fun sealingKey(create: Boolean): SecretKey? {
    (keystore().getKey(ALIAS, null) as SecretKey?)?.let { return it }
    if (!create) return null
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(
      KeyGenParameterSpec.Builder(
          ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build()
    )
    return generator.generateKey()
  }

  /**
   * The key as hex, or null when there is none. A sealing key the Keystore has invalidated reads as
   * none, after removing what it can no longer open: the caller decides whether that is a first
   * launch or a key lost beside a database.
   */
  @Synchronized
  fun read(context: Context): String? {
    val sealed = file(context)
    if (!sealed.exists()) return null
    try {
      val bytes = sealed.readBytes()
      if (bytes.size <= IV_BYTES) throw Unavailable("$FILE is ${bytes.size} bytes")
      val key = sealingKey(create = false) ?: return forget(context)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_BITS, bytes, 0, IV_BYTES))
      return String(cipher.doFinal(bytes, IV_BYTES, bytes.size - IV_BYTES), Charsets.US_ASCII)
    } catch (e: KeyPermanentlyInvalidatedException) {
      return forget(context)
    } catch (e: UnrecoverableKeyException) {
      return forget(context)
    } catch (e: Unavailable) {
      throw e
    } catch (e: Exception) {
      throw Unavailable("the database key could not be unsealed: ${e.message}", e)
    }
  }

  /** Seals and stores `hex`, replacing any key stored before. */
  @Synchronized
  fun write(context: Context, hex: String) {
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, sealingKey(create = true))
      val sealed = cipher.iv + cipher.doFinal(hex.toByteArray(Charsets.US_ASCII))
      val target = file(context)
      val partial = File(target.parentFile, "$FILE.part")
      partial.writeBytes(sealed)
      if (!partial.renameTo(target)) throw Unavailable("$FILE could not be written")
    } catch (e: Unavailable) {
      throw e
    } catch (e: Exception) {
      throw Unavailable("the database key could not be sealed: ${e.message}", e)
    }
  }

  private fun forget(context: Context): String? {
    file(context).delete()
    runCatching { keystore().deleteEntry(ALIAS) }
    return null
  }
}
