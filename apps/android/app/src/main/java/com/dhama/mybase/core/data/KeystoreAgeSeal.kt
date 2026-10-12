package com.dhama.mybase.core.data

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.dhama.mybase.core.age.AGE_SEAL_PREFIX
import com.dhama.mybase.core.age.AgeSeal
import java.security.KeyStore
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject

/** AES-GCM key in the Android Keystore. A plaintext date never leaves [seal]. */
class KeystoreAgeSeal @Inject constructor() : AgeSeal {

    override fun seal(plaintext: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val iv = cipher.iv
        val body = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        val packed = ByteArray(1 + iv.size + body.size)
        packed[0] = iv.size.toByte()
        iv.copyInto(packed, destinationOffset = 1)
        body.copyInto(packed, destinationOffset = 1 + iv.size)
        return AGE_SEAL_PREFIX + Base64.getEncoder().encodeToString(packed)
    }

    override fun open(sealed: String): String? {
        if (!sealed.startsWith(AGE_SEAL_PREFIX)) return null
        return try {
            val packed = Base64.getDecoder().decode(sealed.removePrefix(AGE_SEAL_PREFIX))
            if (packed.isEmpty()) return null
            val ivLength = packed[0].toInt() and 0xff
            if (ivLength !in 12..16 || packed.size <= 1 + ivLength) return null
            val iv = packed.copyOfRange(1, 1 + ivLength)
            val body = packed.copyOfRange(1 + ivLength, packed.size)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, iv))
            String(cipher.doFinal(body), Charsets.UTF_8)
        } catch (_: Exception) {
            null
        }
    }

    override fun discard() {
        val store = keyStore()
        if (store.containsAlias(ALIAS)) store.deleteEntry(ALIAS)
    }

    private fun secretKey(): SecretKey {
        val store = keyStore()
        val existing = store.getKey(ALIAS, null) as? SecretKey
        if (existing != null) return existing
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build()
        generator.init(spec)
        return generator.generateKey()
    }

    private fun keyStore(): KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val ALIAS = "age_date_of_birth"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
