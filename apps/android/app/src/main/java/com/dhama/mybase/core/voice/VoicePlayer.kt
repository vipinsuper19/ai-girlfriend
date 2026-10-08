package com.dhama.mybase.core.voice

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.net.toUri
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import java.io.File

class VoicePlayer(context: Context) {
    private val player = ExoPlayer.Builder(context).build()

    var playingPath by mutableStateOf<String?>(null)
        private set

    init {
        player.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) playingPath = null
            }

            override fun onPlayerError(error: PlaybackException) {
                playingPath = null
            }
        })
    }

    fun toggle(path: String) {
        if (path.isBlank()) return
        if (playingPath == path) {
            player.pause()
            player.seekTo(0)
            playingPath = null
            return
        }
        val uri = if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("file:")) {
            path.toUri()
        } else {
            File(path).toUri()
        }
        player.setMediaItem(MediaItem.fromUri(uri))
        player.prepare()
        player.play()
        playingPath = path
    }

    fun release() {
        player.release()
    }
}
