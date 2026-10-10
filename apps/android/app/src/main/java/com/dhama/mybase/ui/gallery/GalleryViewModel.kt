package com.dhama.mybase.ui.gallery

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dhama.mybase.core.data.AccountSync
import com.dhama.mybase.core.data.GalleryImage
import com.dhama.mybase.core.data.GalleryRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlin.coroutines.cancellation.CancellationException

@HiltViewModel
class GalleryViewModel @Inject constructor(
    private val gallery: GalleryRepository,
    private val accountSync: AccountSync,
) : ViewModel() {

    private val _images = MutableStateFlow<List<GalleryImage>>(emptyList())
    val images = _images.asStateFlow()

    private val _loading = MutableStateFlow(true)
    val loading = _loading.asStateFlow()

    private val _creating = MutableStateFlow(false)
    val creating = _creating.asStateFlow()

    private val _note = MutableStateFlow<String?>(null)
    val note = _note.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _loading.value = true
            try {
                _images.value = gallery.list()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                _note.value = error.message?.takeIf { it.isNotBlank() } ?: "Couldn't load her photos."
            } finally {
                _loading.value = false
            }
        }
    }

    fun create(prompt: String) {
        if (_creating.value) return
        viewModelScope.launch {
            _creating.value = true
            _note.value = null
            try {
                val made = gallery.create(prompt)
                _images.value = listOf(made) + _images.value.filter { it.id != made.id }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                _note.value = error.message?.takeIf { it.isNotBlank() } ?: "Couldn't make that photo."
            } finally {
                _creating.value = false
                runCatching { accountSync.refreshUsage() }
            }
        }
    }

    fun delete(image: GalleryImage) {
        viewModelScope.launch {
            try {
                gallery.delete(image.id)
                _images.value = _images.value.filter { it.id != image.id }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                _note.value = error.message?.takeIf { it.isNotBlank() } ?: "Couldn't delete that photo."
            }
        }
    }
}
