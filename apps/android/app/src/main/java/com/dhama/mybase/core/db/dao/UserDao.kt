package com.dhama.mybase.core.db.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.dhama.mybase.core.db.entity.User
import kotlinx.coroutines.flow.Flow

@Dao
interface UserDao {

    @Query("SELECT * FROM user LIMIT 1")
     fun getUser(): Flow<User>
//
//    @Query("SELECT * FROM user WHERE uid IN (:userIds)")
//    fun loadAllByIds(userIds: IntArray): List<User>
//
//    @Query("SELECT * FROM user WHERE first_name LIKE :first AND " +
//            "last_name LIKE :last LIMIT 1")
//    fun findByName(first: String, last: String): User
//
//    @Insert
//    fun insertAll(vararg users: User)

    @Query("SELECT * FROM user WHERE uid = :id")
     fun findById(id: Int): User

    @Insert(onConflict = OnConflictStrategy.REPLACE)
     fun insertUser(user: User)

    @Update
     fun updateUser(user: User)

    @Delete
     fun delete(user: User)


}