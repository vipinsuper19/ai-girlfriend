package com.dhama.mybase.core.db.mapper

import com.dhama.mybase.core.db.entity.Notes
import com.dhama.mybase.ui.screen.NoteUiState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

object EntityMapper {

    fun mapToDomain(entity: Flow<Notes>): Flow<NoteUiState> {
        return entity.map {
            NoteUiState(
                id = it.id,
                title = it.title,
                desc = it.desc,
            )
        }
    }

    fun mapToEntity(domain: NoteUiState): Notes {
        return Notes(
            id = domain.id,
            title = domain.title,
            desc = domain.desc,
        )
    }

//    fun mapToDomainList(entities: List<UserEntity>): List<User> {
//        return entities.map { mapToDomain(it) }
//    }
//
//    fun mapToEntityList(domains: List<User>): List<UserEntity> {
//        return domains.map { mapToEntity(it) }
//    }


}