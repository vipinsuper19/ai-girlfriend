package com.dhama.mybase.core.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity
data class User(
    @PrimaryKey(autoGenerate = true) val uid: Int,
    @ColumnInfo(name = "name") val name: String,
    @ColumnInfo(name = "dob") val dob: String,
    @ColumnInfo(name = "gender") val gender: String,
    @ColumnInfo(name = "role") val role: String = "guest"
)
