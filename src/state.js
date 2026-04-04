export const state = {
  persona: null,
  hour: 0,
  analyserNode: null,
  dayPlaybackState: 'paused',
  autoplayEnabled: true,
  dayPlaybackTimer: null,
  hourlyStats: null,
  storyLog: [],
  lastSoundColor: '',
  isSoundPaused: false,
  isAutoPlaying: false,
  autoPlayInterval: null,
  manualSoundSelection: null, // { type, db, borough, hour } for resume on spacebar
}
