package com.dhama.mybase.core.domain

import com.dhama.mybase.core.db.entity.User
import kotlinx.coroutines.flow.Flow

interface UserRepo {

    suspend fun getUser(): Flow<User>
    suspend fun insertUser(user: User)
    suspend fun updateUser(user: User)
    suspend fun deleteUser(user: User)

}