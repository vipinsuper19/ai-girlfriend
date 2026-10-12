package com.dhama.mybase.core.db

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * Version steps that exist in this repository:
 * 4 is the oldest committed schema (user and notes).
 * 5 adds chat_messages.
 * 6 adds memories.
 * 7 adds voice-note columns on chat_messages.
 * 8 drops the unused notes table ([AppDatabase.MIGRATION_7_8]).
 *
 * Versions 1–3 are not in the repository. The database builder uses
 * fallbackToDestructiveMigrationFrom only for those versions.
 * Do not reuse version 7 or 8 for a different schema.
 */
object AppMigrations {
    val MIGRATION_4_5: Migration = object : Migration(4, 5) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS `chat_messages` (`id` TEXT NOT NULL, `role` TEXT NOT NULL, `text` TEXT NOT NULL, `createdAtEpochMs` INTEGER NOT NULL, `delivery` TEXT NOT NULL, PRIMARY KEY(`id`))",
            )
        }
    }

    val MIGRATION_5_6: Migration = object : Migration(5, 6) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS `memories` (`id` TEXT NOT NULL, `type` TEXT NOT NULL, `content` TEXT NOT NULL, `importance` INTEGER NOT NULL, `confidence` REAL NOT NULL, `source` TEXT NOT NULL, `createdAtEpochMs` INTEGER NOT NULL, `updatedAtEpochMs` INTEGER NOT NULL, PRIMARY KEY(`id`))",
            )
        }
    }

    /**
     * Rebuilds chat_messages so the added columns match a fresh version 7 table.
     * SQLite requires a DEFAULT to add a NOT NULL column, which would not match
     * Room's expected schema. Copying into the version 7 CREATE TABLE keeps the rows.
     */
    val MIGRATION_6_7: Migration = object : Migration(6, 7) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS `chat_messages_new` (`id` TEXT NOT NULL, `role` TEXT NOT NULL, `text` TEXT NOT NULL, `createdAtEpochMs` INTEGER NOT NULL, `delivery` TEXT NOT NULL, `kind` TEXT NOT NULL, `audioPath` TEXT NOT NULL, `durationMs` INTEGER NOT NULL, PRIMARY KEY(`id`))",
            )
            db.execSQL(
                """
                INSERT INTO `chat_messages_new` (
                    `id`, `role`, `text`, `createdAtEpochMs`, `delivery`, `kind`, `audioPath`, `durationMs`
                )
                SELECT `id`, `role`, `text`, `createdAtEpochMs`, `delivery`, 'TEXT', '', 0
                FROM `chat_messages`
                """.trimIndent(),
            )
            db.execSQL("DROP TABLE `chat_messages`")
            db.execSQL("ALTER TABLE `chat_messages_new` RENAME TO `chat_messages`")
        }
    }

    val ALL: Array<Migration> = arrayOf(
        MIGRATION_4_5,
        MIGRATION_5_6,
        MIGRATION_6_7,
        AppDatabase.MIGRATION_7_8,
    )
}
