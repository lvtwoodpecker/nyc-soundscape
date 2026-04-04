export const SOUND_COLORS = {
  'engine':    '#d94f4f',
  'machinery': '#c97c28',
  'impact':    '#b89000',
  'saw':       '#1a9e5c',
  'alert':     '#c9456e',
  'music':     '#6b5fd4',
  'voice':     '#3a7fd4',
  'dog':       '#1eaa88',
}

export const SOUND_FINE = {
  'engine':    ['small engine', 'medium engine', 'large engine'],
  'machinery': ['rock drill', 'jackhammer', 'hoe-ram', 'pile driver'],
  'impact':    ['non-machinery impact'],
  'saw':       ['chainsaw', 'rotating saw'],
  'alert':     ['car horn', 'car alarm', 'siren', 'reverse beeper'],
  'music':     ['stationary music', 'mobile music', 'ice cream truck'],
  'voice':     ['talking', 'shouting', 'crowd', 'amplified speech'],
  'dog':       ['dog barking'],
}

// reads the current theme's CSS var so dark mode gets brighter colors
export function getSoundColor(type) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--c-${type}`).trim()
  return v || SOUND_COLORS[type] || '#888'
}

export const SOUND_LABELS = {
  engine:    'Engine',
  machinery: 'Machinery',
  impact:    'Impact',
  saw:       'Powered Saw',
  alert:     'Alert Signal',
  music:     'Music',
  voice:     'Human Voice',
  dog:       'Dog',
}

// borough: 1=Manhattan
// sounds and db are derived at runtime from hourly-stats.json — not stored here

export const PERSONAS = [
  {
    id: 'rosa',
    name: 'Rosa',
    role: 'Food Cart Vendor',
    home: 'Lower East Side',
    color: '#d94f4f',
    soundFocus: ['voice', 'music', 'dog', 'engine'],
    soundWeights: {
      voice: 1.14,
      music: 1.1,
      dog: 1.08,
      engine: 1.04,
      alert: 1.02,
      machinery: 0.95,
      saw: 0.9,
      impact: 0.92,
    },
    soundCurve: {
      gamma: 1.15,
      focusBoosts: [0.12, 0.08, 0.05, 0.02],
      thresholdPenalty: 0.08,
      priorityBoost: 0.05,
    },
    // override data-driven sound pick for hours where the story demands a specific class
    soundOverrides: {
      7:  'saw',    // the construction site is her first customer
      8:  'dog',    // 7.6% — the morning dog peak
    },
    schedule: [
      { h:0,  lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Delancey doesn\'t go quiet. Engine, voices from the bar on the corner. She sleeps through it fine.' },
      { h:1,  lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Asleep.' },
      { h:2,  lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Asleep.' },
      { h:3,  lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Alarm at 3:30. Gets up in the dark.' },
      { h:4,  lat:40.7157, lng:-73.9863, loc:'LES — Loading Cart',       borough:1, desc:'Loading the cart. Just workers out this hour. She can tell by the sound of it.' },
      { h:5,  lat:40.7200, lng:-73.9960, loc:'Walking Cart to WSP',      borough:1, desc:'Rolling north through empty streets. Her and the trucks. The city at its most stripped down.' },
      { h:6,  lat:40.7300, lng:-74.0000, loc:'WSP — Setting Up',         borough:1, desc:'Setting up. The park is mostly air and early light. The construction crew from across the street crosses over. Her first customers, every morning.' },
      { h:7,  lat:40.7308, lng:-74.0002, loc:'WSP — Open',               borough:1, desc:'The saw fires up at 7. She knew it would. The men who buy her first coffee built this hour.' },
      { h:8,  lat:40.7308, lng:-74.0002, loc:'WSP — Morning Rush',       borough:1, desc:'Dogs everywhere. Morning rush. She runs out of coffee before 9.' },
      { h:9,  lat:40.7308, lng:-74.0002, loc:'WSP — Steady',             borough:1, desc:'Machinery from across the park. Horns stacking on the surrounding streets. Everything at pitch.' },
      { h:10, lat:40.7308, lng:-74.0002, loc:'WSP — Midmorning',         borough:1, desc:'The construction noise easing back, slightly. The voices filling in behind it.' },
      { h:11, lat:40.7308, lng:-74.0002, loc:'WSP — Building',           borough:1, desc:'The park finding its social frequency.' },
      { h:12, lat:40.7308, lng:-74.0002, loc:'WSP — Lunch Peak',         borough:1, desc:'Line past the fountain. She doesn\'t stop moving for ninety minutes.' },
      { h:13, lat:40.7308, lng:-74.0002, loc:'WSP — Lunch',              borough:1, desc:'Still packed. People eating standing up, shouting across to each other.' },
      { h:14, lat:40.7308, lng:-74.0002, loc:'WSP — Afternoon',          borough:1, desc:'The crowd shifts. Tourists, students, the afternoon regulars.' },
      { h:15, lat:40.7308, lng:-74.0002, loc:'WSP — Best Hour',          borough:1, desc:'Her favorite hour. Voices, music from the piano at the fountain, dogs off-leash.' },
      { h:16, lat:40.7308, lng:-74.0002, loc:'WSP — After School',       borough:1, desc:'Skaters, the piano guy, chess tables full. Someone\'s radio from an open window.' },
      { h:17, lat:40.7308, lng:-74.0002, loc:'WSP — Rush Hour',          borough:1, desc:'Everyone moving at once.' },
      { h:18, lat:40.7308, lng:-74.0002, loc:'WSP — Dinner Crowd',       borough:1, desc:'She starts thinking about packing up.' },
      { h:19, lat:40.7308, lng:-74.0002, loc:'WSP — Closing',            borough:1, desc:'Breaking down the cart. The park keeps going without her.' },
      { h:20, lat:40.7200, lng:-73.9960, loc:'Rolling Cart Home',        borough:1, desc:'South on Bowery. Someone playing on the corner of Bleecker.' },
      { h:21, lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Home. Already asleep. Outside, the whole city is talking at once. 9pm is Manhattan\'s loudest hour on record.' },
      { h:22, lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Asleep.' },
      { h:23, lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Asleep. Alarm at 3:30.' },
    ]
  },
  {
    id: 'carlos',
    name: 'Carlos',
    role: 'Construction Crew',
    home: 'TriBeCa',
    color: '#c97c28',
    soundFocus: ['machinery', 'saw', 'engine', 'alert'],
    soundWeights: {
      machinery: 1.18,
      saw: 1.16,
      engine: 1.1,
      alert: 1.05,
      impact: 1.02,
      voice: 0.96,
      music: 0.9,
      dog: 0.88,
    },
    soundCurve: {
      gamma: 1.28,
      focusBoosts: [0.16, 0.11, 0.07, 0.03],
      thresholdPenalty: 0.1,
      priorityBoost: 0.04,
    },
    soundOverrides: {
      7:  'saw',       // "saw fires up at 7:01" — engine would win otherwise
      8:  'machinery', // "full swing. machinery 15.6%"
      9:  'machinery', // "machinery peaks at 17.4%"
      10: 'machinery', // "machinery 16.5%"
      11: 'machinery', // "tapering. saw easing."
    },
    schedule: [
      { h:0,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Asleep. The West Side Highway one block west.' },
      { h:1,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Asleep.' },
      { h:2,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Asleep.' },
      { h:3,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Alarm at 3:45. Lies there a minute.' },
      { h:4,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Coffee, gear, out before 5. Delivery trucks on every block. The kitchen before the kitchen opens.' },
      { h:5,  lat:40.7240, lng:-74.0010, loc:'Walking to Job Site',      borough:1, desc:'Two miles north on foot. Just him and the trucks in the dark.' },
      { h:6,  lat:40.7260, lng:-73.9990, loc:'Job Site — Arriving',      borough:1, desc:'Site staging. The crew assembles quietly before the neighborhood wakes.' },
      { h:7,  lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Saw fires up at 7:01. This is the loudest hour in the whole dataset. He is the reason for that.' },
      { h:8,  lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Full swing. The neighborhood woke up to this.' },
      { h:9,  lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'The whole corridor hums. A noise complaint was filed at 7:30.' },
      { h:10, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'The site at full pitch. The street outside getting louder in response.' },
      { h:11, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'The site finding a lower gear. The saw easing back.' },
      { h:12, lat:40.7300, lng:-73.9990, loc:'Deli — Nearby',            borough:1, desc:'Around the corner for lunch. A completely different world from inside the fence.' },
      { h:13, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Afternoon session. Lighter work, conduit and framing. The loudest part of the day is behind him.' },
      { h:14, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Two cities separated by a chain-link fence.' },
      { h:15, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Packing tools. The street outside running full.' },
      { h:16, lat:40.7300, lng:-73.9990, loc:'Street — Done',            borough:1, desc:'Done. Street level. Rush hour Manhattan. He\'s part of it now.' },
      { h:17, lat:40.7200, lng:-74.0040, loc:'Walking Home',             borough:1, desc:'South on the sidewalk. Walking opposite the commuter flow.' },
      { h:18, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Home. Kids on the block, the evening starting up.' },
      { h:19, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Dinner, TV on. The city outside is still loud. Not his problem.' },
      { h:20, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Out front for a bit. He has a 3:45 alarm.' },
      { h:21, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Asleep.' },
      { h:22, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Asleep.' },
      { h:23, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Asleep.' },
    ]
  },
  {
    id: 'amara',
    name: 'Amara',
    role: 'Jazz Vocalist',
    home: 'East Village',
    color: '#6b5fd4',
    soundFocus: ['music', 'voice', 'alert', 'dog'],
    soundWeights: {
      music: 1.2,
      voice: 1.12,
      alert: 1.04,
      dog: 1,
      engine: 0.92,
      machinery: 0.88,
      saw: 0.86,
      impact: 0.9,
    },
    soundCurve: {
      gamma: 1.12,
      focusBoosts: [0.13, 0.09, 0.06, 0.03],
      thresholdPenalty: 0.07,
      priorityBoost: 0.05,
    },
    soundOverrides: {
      12: 'machinery', // wakes up to it — construction in its 4th hour
      17: 'music',     // soundcheck
      18: 'music',     // pre-show
      19: 'music',     // first set
      20: 'music',     // performing
      21: 'music',     // late set — she's the music in a sea of voice
      22: 'music',     // last song
    },
    schedule: [
      { h:0,  lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Packing up after the late set. Green room still warm. Sirens on 7th Ave outside.' },
      { h:1,  lat:40.7300, lng:-74.0020, loc:'West Village — Walking',   borough:1, desc:'Walking east toward home. A cab radio somewhere, someone\'s open window.' },
      { h:2,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Home. Asleep by 2:30.' },
      { h:3,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep.' },
      { h:4,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep.' },
      { h:5,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep. The overnight trucks outside. She doesn\'t hear any of it.' },
      { h:6,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep.' },
      { h:7,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep. She set the alarm for noon. A saw starts up somewhere nearby.' },
      { h:8,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep.' },
      { h:9,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep.' },
      { h:10, lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep.' },
      { h:11, lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep. The construction site outside has been going for four hours. She hasn\'t heard a note of it.' },
      { h:12, lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Up. Coffee, vocal exercises with the window cracked. The machinery still going.' },
      { h:13, lat:40.7290, lng:-73.9900, loc:'East Village — Walk',      borough:1, desc:'Coffee shop, a slow walk. The street loud and social.' },
      { h:14, lat:40.7290, lng:-73.9968, loc:'NYU Steinhardt',           borough:1, desc:'Practice room. Closed door, all afternoon.' },
      { h:15, lat:40.7290, lng:-73.9968, loc:'NYU Steinhardt',           borough:1, desc:'Still in the practice room. The park just outside the window, barely audible.' },
      { h:16, lat:40.7290, lng:-73.9900, loc:'East Village — Evening',   borough:1, desc:'Heading toward the West Village. Something from a bar on the corner. She knows the song.' },
      { h:17, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Soundcheck. The room holds silence differently in the afternoon. Old wood, low light, something spilled years ago.' },
      { h:18, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Pre-show. The dinner crowd moves past the door.' },
      { h:19, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'First set.' },
      { h:20, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Performing. The room full. The SONYC sensors outside barely register her.' },
      { h:21, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Late set. The whole city talking at once outside. She\'s singing into it.' },
      { h:22, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Last song. The room still full but thinning.' },
      { h:23, lat:40.7330, lng:-74.0010, loc:'West Village — Walking',   borough:1, desc:'Packing up, walking east. The city sounds different at midnight.' },
    ]
  },
  {
    id: 'marcus',
    name: 'Prof. Marcus',
    role: 'Urban Studies Faculty',
    home: 'Upper East Side',
    color: '#3a7fd4',
    soundFocus: ['voice', 'dog', 'engine', 'alert'],
    soundWeights: {
      voice: 1.14,
      dog: 1.1,
      engine: 1.06,
      alert: 1.04,
      music: 0.98,
      impact: 0.95,
      machinery: 0.93,
      saw: 0.9,
    },
    soundCurve: {
      gamma: 1.18,
      focusBoosts: [0.11, 0.07, 0.05, 0.02],
      thresholdPenalty: 0.08,
      priorityBoost: 0.05,
    },
    soundOverrides: {
      7:  'dog',    // "dogs everywhere this hour" — 4.7%, engine would dominate
      8:  'dog',    // "dogs at 7.6% — the daily peak"
      16: 'engine', // "records a garbage truck for twelve minutes"
    },
    schedule: [
      { h:0,  lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep. 2nd Ave through the window. He\'s lived here 22 years.' },
      { h:1,  lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep.' },
      { h:2,  lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep.' },
      { h:3,  lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep. Delivery trucks on the avenue. The overnight economy doing its rounds.' },
      { h:4,  lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep.' },
      { h:5,  lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep. Alarm at 6:45.' },
      { h:6,  lat:40.7763, lng:-73.9637, loc:'Upper East Side — Morning',borough:1, desc:'Up. Coffee, the news. The avenue quiet for now.' },
      { h:7,  lat:40.7775, lng:-73.9460, loc:'East River Esplanade',     borough:1, desc:'Morning walk. The esplanade belongs to the dogs before it belongs to anyone else.' },
      { h:8,  lat:40.7763, lng:-73.9637, loc:'Upper East Side — Subway', borough:1, desc:'Heading to the 6. The dogs are all out before the commute swallows the streets. He goes underground.' },
      { h:9,  lat:40.7290, lng:-73.9976, loc:'Silver Center — NYU',      borough:1, desc:'Office hours. Machinery from the construction site across the street. The peak of the morning.' },
      { h:10, lat:40.7290, lng:-73.9976, loc:'Silver Center — NYU',      borough:1, desc:'Seminar prep. The drill still going. The students have stopped noticing it.' },
      { h:11, lat:40.7290, lng:-73.9976, loc:'Lecture Hall — NYU',       borough:1, desc:'Teaching. Good discussion today.' },
      { h:12, lat:40.7308, lng:-74.0002, loc:'Washington Square Park',   borough:1, desc:'Lunch on a bench. He eats and takes notes.' },
      { h:13, lat:40.7290, lng:-73.9976, loc:'Silver Center — NYU',      borough:1, desc:'Office hours. An ambulance on the street below, more or less every fifteen minutes.' },
      { h:14, lat:40.7480, lng:-73.9890, loc:'Midtown — Fieldwork',      borough:1, desc:'Subway uptown with a recorder and a notebook. Three SONYC sensors in the Hell\'s Kitchen cluster worth walking.' },
      { h:15, lat:40.7592, lng:-73.9982, loc:'Hell\'s Kitchen',          borough:1, desc:'Walking the sensor coverage area. More alert-heavy than downtown. He writes that down.' },
      { h:16, lat:40.7592, lng:-73.9982, loc:'Hell\'s Kitchen',          borough:1, desc:'He records a garbage truck for twelve minutes.' },
      { h:17, lat:40.7440, lng:-73.9935, loc:'1 Train — Downtown',       borough:1, desc:'Rush hour platform. Too loud to do anything but stand there.' },
      { h:18, lat:40.7290, lng:-73.9976, loc:'NYU — Evening',            borough:1, desc:'Back at Silver Center. Answering emails. The street below still running loud.' },
      { h:19, lat:40.7600, lng:-73.9637, loc:'6 Train — Uptown',         borough:1, desc:'Heading home. Loud downtown, quieter by the 70s.' },
      { h:20, lat:40.7763, lng:-73.9637, loc:'Upper East Side — Dinner', borough:1, desc:'Neighborhood restaurant. The avenue outside.' },
      { h:21, lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Reading. Right now the whole city is at its loudest — the number he keeps citing in papers. He closes the window.' },
      { h:22, lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep. He\'s lived here long enough that this counts as quiet.' },
      { h:23, lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep.' },
    ]
  },
  {
    id: 'nadia',
    name: 'Nadia',
    role: 'Rideshare Driver',
    home: 'Hell\'s Kitchen',
    color: '#9f7420',
    soundFocus: ['engine', 'alert', 'voice', 'music'],
    soundWeights: {
      engine: 1.16,
      alert: 1.14,
      voice: 1.08,
      music: 1.03,
      machinery: 0.95,
      impact: 0.94,
      saw: 0.9,
      dog: 0.88,
    },
    soundCurve: {
      gamma: 1.24,
      focusBoosts: [0.15, 0.1, 0.06, 0.03],
      thresholdPenalty: 0.09,
      priorityBoost: 0.04,
    },
    soundOverrides: {
      2:  'voice',  // "the fares are quieter, stranger" — voice still 21%, more evocative than engine
      23: 'alert',  // "trading voices for sirens" — voice 34.7% would win, but alert is the story
    },
    schedule: [
      { h:0,  lat:40.7308, lng:-74.0002, loc:'West Village — Pickup',    borough:1, desc:'Bar crowd. The backseat is a conversation about where to go next.' },
      { h:1,  lat:40.7550, lng:-73.9850, loc:'Midtown — Late Night',     borough:1, desc:'Fewer fares. Midtown going quiet.' },
      { h:2,  lat:40.7265, lng:-73.9862, loc:'East Village — Pickup',    borough:1, desc:'The late bars. The fares are quieter, stranger.' },
      { h:3,  lat:40.7100, lng:-74.0050, loc:'Lower Manhattan',          borough:1, desc:'She drives long stretches without anyone in the back seat.' },
      { h:4,  lat:40.7072, lng:-74.0050, loc:'TriBeCa — Last Fares',     borough:1, desc:'Almost nothing left to pick up.' },
      { h:5,  lat:40.7360, lng:-74.0010, loc:'Heading Home',             borough:1, desc:'Last run north. Just trucks and her and the West Side Highway.' },
      { h:6,  lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Parked. Asleep by 6:30.' },
      { h:7,  lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep. The morning dog walkers starting their circuits outside.' },
      { h:8,  lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:9,  lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:10, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:11, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep. A construction site three blocks over, in its fourth hour.' },
      { h:12, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:13, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:14, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:15, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Starting to wake up. The afternoon street filtering through the curtains.' },
      { h:16, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Up. Coffee, surge map, the car.' },
      { h:17, lat:40.7592, lng:-73.9982, loc:'Hell\'s Kitchen — Prepping',borough:1, desc:'Out for food, stretching her legs. She\'s about to go back into it.' },
      { h:18, lat:40.7550, lng:-73.9850, loc:'Midtown — Early Shift',    borough:1, desc:'Shift starts. Theater crowd, dinner crowd, all of them needing somewhere to be.' },
      { h:19, lat:40.7480, lng:-73.9890, loc:'Midtown — Working',        borough:1, desc:'Shows letting out, bars opening up. The fares come fast.' },
      { h:20, lat:40.7380, lng:-74.0020, loc:'West Village — Working',   borough:1, desc:'Restaurant crowd. Good fares, short rides.' },
      { h:21, lat:40.7308, lng:-74.0002, loc:'WSP Area — Working',       borough:1, desc:'The backseat is a blur of conversations. The whole city talking at once.' },
      { h:22, lat:40.7265, lng:-73.9862, loc:'East Village — Working',   borough:1, desc:'The bars starting to close. The fares changing character.' },
      { h:23, lat:40.7480, lng:-73.9890, loc:'Midtown — Late',           borough:1, desc:'Midnight Manhattan. The city trading voices for sirens.' },
    ]
  },
]
