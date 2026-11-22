import type { AudioTrack, SubtitleTrack, VideoPlayer } from 'expo-video';

/** expo-video is driven by setting the player's properties. Setting them here, not inside a component, keeps React Compiler compiling the components that hold the player. */
export function jumpTo(player: VideoPlayer, seconds: number) {
  player.currentTime = seconds;
}

export function chooseAudio(player: VideoPlayer, track: AudioTrack | null) {
  player.audioTrack = track;
}

export function chooseSubtitles(player: VideoPlayer, track: SubtitleTrack | null) {
  player.subtitleTrack = track;
}

export function setSpeed(player: VideoPlayer, rate: number) {
  player.playbackRate = rate;
}
