export const state = {
  persona: null,
  hour: 0,
  startHour: 0,
  analyserNode: null,
  dayPlaybackState: 'paused',
  autoplayEnabled: true,
  dayPlaybackTimer: null,
  hourlyStats: null,
  storyLog: [],
  lastSoundColor: '',
  manualSoundSelection: null, // { type, db, borough, hour } for resume on spacebar
  allStories: {}, // { 0: { h, displayH, suffix, desc }, ... 23: { ... } }
}
