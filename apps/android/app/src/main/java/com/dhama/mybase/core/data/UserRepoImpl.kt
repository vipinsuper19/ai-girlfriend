package com.dhama.mybase.core.data

import com.dhama.mybase.core.db.dao.UserDao
import com.dhama.mybase.core.db.entity.User
import com.dhama.mybase.core.domain.UserRepo
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class UserRepoImpl @Inject constructor(private val userDao: UserDao): UserRepo {


    override suspend fun getUser(): Flow<User> {
        val user =  userDao.getUser()
        return user
        //return EntityMapper.mapToDomain(user)
    }

    override suspend fun insertUser(user: User) {
        userDao.insertUser(user)
    }

    override suspend fun updateUser(user: User) {
        userDao.updateUser(user)
    }

    override suspend fun deleteUser(user: User) {
        userDao.delete(user)
    }

}