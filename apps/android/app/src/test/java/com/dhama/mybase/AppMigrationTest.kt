package com.dhama.mybase

import android.app.Application
import android.content.Context
import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import com.dhama.mybase.core.db.AppDatabase
import com.dhama.mybase.core.db.AppMigrations
import com.dhama.mybase.core.db.entity.ChatMessageEntity
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [29], application = Application::class)
class AppMigrationTest {

    @get:Rule
    val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        AppDatabase::class.java,
    )

    @Test
    fun migrationsCoverEveryCommittedStepAndLeaveVersion8ForTheNotesDrop() {
        assertEquals(
            listOf(4 to 5, 5 to 6, 6 to 7),
            AppMigrations.ALL.map { it.startVersion to it.endVersion },
        )
    }

    @Test
    fun migrateFrom4KeepsUserAndNotes() {
        seed(4) { db ->
            insertUser(db)
            insertNote(db)
        }
        val migrated = migrate("from-4")
        assertEquals("Ada", text(migrated, "SELECT name FROM `User` WHERE uid = 1"))
        assertEquals("A note", text(migrated, "SELECT `desc` FROM notes WHERE id = 1"))
        assertEquals(0, count(migrated, "chat_messages"))
        assertEquals(0, count(migrated, "memories"))
        migrated.close()
        openRoom("from-4").useRoom { room ->
            assertEquals(0, runBlocking { room.chatMessageDao().snapshot() }.size)
            assertEquals(0, runBlocking { room.memoryDao().snapshot() }.size)
        }
    }

    @Test
    fun migrateFrom5KeepsChatAndFillsVoiceColumns() {
        seed(5) { db ->
            insertUser(db)
            insertNote(db)
            insertChatV5(db)
        }
        val migrated = migrate("from-5")
        assertEquals("hi", text(migrated, "SELECT text FROM chat_messages WHERE id = 'm1'"))
        assertEquals("TEXT", text(migrated, "SELECT kind FROM chat_messages WHERE id = 'm1'"))
        assertEquals("", text(migrated, "SELECT audioPath FROM chat_messages WHERE id = 'm1'"))
        assertEquals(0, countQuery(migrated, "SELECT durationMs FROM chat_messages WHERE id = 'm1'"))
        assertEquals("A note", text(migrated, "SELECT `desc` FROM notes WHERE id = 1"))
        migrated.close()
        openRoom("from-5").useRoom { room ->
            val messages = runBlocking { room.chatMessageDao().snapshot() }
            assertEquals(1, messages.size)
            assertEquals("hi", messages[0].text)
            assertEquals(ChatMessageEntity.KIND_TEXT, messages[0].kind)
            assertEquals("", messages[0].audioPath)
            assertEquals(0L, messages[0].durationMs)
            assertEquals("USER", messages[0].role)
            assertEquals(1_000L, messages[0].createdAtEpochMs)
        }
    }

    @Test
    fun migrateFrom6KeepsChatAndMemory() {
        seed(6) { db ->
            insertUser(db)
            insertNote(db)
            insertChatV5(db)
            insertMemory(db)
        }
        val migrated = migrate("from-6")
        assertEquals("likes tea", text(migrated, "SELECT content FROM memories WHERE id = 'mem1'"))
        assertEquals("hi", text(migrated, "SELECT text FROM chat_messages WHERE id = 'm1'"))
        assertEquals("Ada", text(migrated, "SELECT name FROM `User` WHERE uid = 1"))
        migrated.close()
        openRoom("from-6").useRoom { room ->
            val memories = runBlocking { room.memoryDao().snapshot() }
            assertEquals(1, memories.size)
            assertEquals("likes tea", memories[0].content)
            assertEquals("FACT", memories[0].type)
            assertEquals(2, memories[0].importance)
            assertEquals(0.5f, memories[0].confidence)
            assertEquals("chat", memories[0].source)
            val messages = runBlocking { room.chatMessageDao().snapshot() }
            assertEquals("TEXT", messages.single().kind)
            assertTrue(messages.single().audioPath.isEmpty())
        }
    }

    private fun seed(version: Int, insert: (SupportSQLiteDatabase) -> Unit) {
        val db = helper.createDatabase(name(version), version)
        insert(db)
        db.close()
    }

    private fun migrate(name: String): SupportSQLiteDatabase {
        return helper.runMigrationsAndValidate(name, 7, true, *AppMigrations.ALL)
    }

    private fun name(version: Int) = "from-$version"

    private fun openRoom(name: String): AppDatabase {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val room = Room.databaseBuilder(context, AppDatabase::class.java, name)
            .addMigrations(*AppMigrations.ALL)
            .build()
        helper.closeWhenFinished(room)
        return room
    }

    private fun insertUser(db: SupportSQLiteDatabase) {
        db.execSQL(
            "INSERT INTO `User` (uid, name, dob, gender, role) VALUES (1, 'Ada', '1990-01-02', 'female', 'guest')",
        )
    }

    private fun insertNote(db: SupportSQLiteDatabase) {
        db.execSQL("INSERT INTO notes (id, title, `desc`) VALUES (1, 'Hello', 'A note')")
    }

    private fun insertChatV5(db: SupportSQLiteDatabase) {
        db.execSQL(
            "INSERT INTO chat_messages (id, role, text, createdAtEpochMs, delivery) VALUES ('m1', 'USER', 'hi', 1000, 'SENT')",
        )
    }

    private fun insertMemory(db: SupportSQLiteDatabase) {
        db.execSQL(
            "INSERT INTO memories (id, type, content, importance, confidence, source, createdAtEpochMs, updatedAtEpochMs) " +
                "VALUES ('mem1', 'FACT', 'likes tea', 2, 0.5, 'chat', 1000, 2000)",
        )
    }

    private fun text(db: SupportSQLiteDatabase, sql: String): String {
        db.query(sql).use { cursor ->
            assertTrue(cursor.moveToFirst())
            return cursor.getString(0)
        }
    }

    private fun count(db: SupportSQLiteDatabase, table: String): Int = countQuery(db, "SELECT COUNT(*) FROM $table")

    private fun countQuery(db: SupportSQLiteDatabase, sql: String): Int {
        db.query(sql).use { cursor ->
            assertTrue(cursor.moveToFirst())
            return cursor.getInt(0)
        }
    }
}

private fun AppDatabase.useRoom(block: (AppDatabase) -> Unit) {
    try {
        block(this)
    } finally {
        close()
    }
}
