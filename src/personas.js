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
      { h:0,  lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Midnight. Soundly asleep.' },
      { h:1,  lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Zzzzz... Is that her snoring or the construction?' },
      { h:2,  lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Still asleep. Bar voices bleeding through. She\'s learned to sleep through the city\'s opinion.' },
      { h:3,  lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Alarm at 3:30. Or did those people at the bar finally woke her up? Anyways time to get ready.' },
      { h:4,  lat:40.7157, lng:-73.9863, loc:'LES — Loading Cart',       borough:1, desc:'Loading the cart. Some people are already out there, or maybe haven\'t even left. 4am and people are still shouting.' },
      { h:5,  lat:40.7200, lng:-73.9960, loc:'Walking Cart to WSP',      borough:1, desc:'Rolling north through empty streets. Just herself and the trucks.' },
      { h:6,  lat:40.7300, lng:-74.0000, loc:'WSP — Setting Up',         borough:1, desc:'Setting up in early light. WSP\'s still half asleep. Then the construction crew shows up. Her 6am regulars.' },
      { h:7,  lat:40.7308, lng:-74.0002, loc:'WSP — Open',               borough:1, desc:'The saw fires up right on time. She doesn\'t mind' },
      { h:8,  lat:40.7308, lng:-74.0002, loc:'WSP — Morning Rush',       borough:1, desc:'Woof woof! Dogs everywhere. Morning surge. The city finally wakes up, and she\'s out of coffee. Still a big line though. ' },
      { h:9,  lat:40.7308, lng:-74.0002, loc:'WSP — Steady',             borough:1, desc:'Lots of rumblings in the park. Just another day.' },
      { h:10, lat:40.7308, lng:-74.0002, loc:'WSP — Midmorning',         borough:1, desc:'More rumblings... Business has slowed down a tad.' },
      { h:11, lat:40.7308, lng:-74.0002, loc:'WSP — Building',           borough:1, desc:'The park hits its groove. Social, loud, happy loud. NYU students rushing to class.' },
      { h:12, lat:40.7308, lng:-74.0002, loc:'WSP — Lunch Peak',         borough:1, desc:'Line past the fountain. She doesn\'t stop moving. Ninety minutes of pure chaos.' },
      { h:13, lat:40.7308, lng:-74.0002, loc:'WSP — Lunch',              borough:1, desc:'Still packed. Everyone talking at once, eating standing up, needing napkins.' },
      { h:14, lat:40.7308, lng:-74.0002, loc:'WSP — Afternoon',          borough:1, desc:'Even more rumblings.' },
      { h:15, lat:40.7308, lng:-74.0002, loc:'WSP — Best Hour',          borough:1, desc:'Her favorite. Almost sold out. People coming and going. Just chilling on the grass.'},
      { h:16, lat:40.7308, lng:-74.0002, loc:'WSP — After School',       borough:1, desc:'The skaters are starting to roll out. It\'s after school hours.' },
      { h:17, lat:40.7308, lng:-74.0002, loc:'WSP — Rush Hour',          borough:1, desc:'Someone just randomly bursted out a vocal performance. Fun. At least it\'s time to pack up.' },
      { h:18, lat:40.7308, lng:-74.0002, loc:'WSP — Dinner Crowd',       borough:1, desc:'It\'s getting late. Rosa breaking the cart down.' },
      { h:19, lat:40.7308, lng:-74.0002, loc:'WSP — Closing',            borough:1, desc:'Done for the night. More car rumblings. Of course.' },
      { h:20, lat:40.7200, lng:-73.9960, loc:'Rolling Cart Home',        borough:1, desc:'South on Bowery. Was that... bagpipes?? What the heckie?' },
      { h:21, lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Washing up and getting ready for bed. Meanwhile the city\'s at full volume outside. 9pm is Manhattan\'s loudest hour. Actual fact btw.' },
      { h:22, lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Zzz... See you at 3:30.' },
      { h:23, lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Asleep. Some murmurrings outside.' },
    ]
  },
  {
    id: 'eddie',
    name: 'Eddie',
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
      { h:0,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Asleep, kind of. Of course there are people still out.' },
      { h:1,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Asleep..' },
      { h:2,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Asleep, barely. More than one hour till the alarm. He\'s getting restless by the people outside the window.' },
      { h:3,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Alarm at 3:45. He lies there for 30 more minutes. Just a bit of doomscrolling.' },
      { h:4,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Coffee, gear, out before 5. The city\'s delivery trucks are the only other thing awake.' },
      { h:5,  lat:40.7240, lng:-74.0010, loc:'Walking to Job Site',      borough:1, desc:'Walking two miles north. Just him and the trucks.' },
      { h:6,  lat:40.7260, lng:-73.9990, loc:'Job Site — Arriving',      borough:1, desc:'Site staging. The crew shows up quiet. Gets the tools set. The neighborhood\'s still sleeping.' },
      { h:7,  lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Saws fire up at 7:01 AM sharp. This is the loudest hour in the whole dataset. Partially his work.' },
      { h:8,  lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'The saws woke the neighborhood up. Shouldn\'t matter.' },
      { h:9,  lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Bzzzzz... Eddie thanking whoever invented earplugs.' },
      { h:10, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Full pitch. Some exasperated faces around the neighborhood. But he\'s focused on the task.' },
      { h:11, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'The site finding a lower gear. The saw easing back. Almost lunch break, woohoo!' },
      { h:12, lat:40.7300, lng:-73.9990, loc:'Deli — Nearby',            borough:1, desc:'Around the corner for lunch. Like a completely different world. Was that a bird chirping???' },
      { h:13, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Afternoon session. Some lighter work. The loudest part\'s behind him.' },
      { h:14, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Werk werk werk. Steady pace. No drama.' },
      { h:15, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Packing tools. The street outside in full rush. He\'s done for the day.' },
      { h:16, lat:40.7300, lng:-73.9990, loc:'Street — Done',            borough:1, desc:'Done. Back to street level. Rush hour Manhattan. He\'s part of the crowd now.' },
      { h:17, lat:40.7200, lng:-74.0040, loc:'Walking Home',             borough:1, desc:'South on the sidewalk going opposite the commuter surge. Tired. What\'s this ambulance about now?' },
      { h:18, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Home. What\'s going on with the sirens today??!' },
      { h:19, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Dinner, TV on. The city\'s still loud. Not his problem anymore.' },
      { h:20, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Out front for a bit. He has a 3:45 alarm. Better get some sleep.' },
      { h:21, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Asleep. Tomorrow\ we go again.' },
      { h:22, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Asleep hard.' },
      { h:23, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Hardly asleep.' },
    ]
  },
  {
    id: 'miura',
    name: 'Miura',
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
      15: 'alert',       // 3pm at NYU Steinhardt should read as saw
      17: 'music',     // soundcheck
      18: 'music',     // pre-show
      19: 'music',     // first set
      20: 'music',     // performing
      21: 'voice',     // late set
    },
    schedule: [
      { h:0,  lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Now she\'s catching up with a couple friends. And getting free drinks, of course. Engine noises on 7th Ave make the perfect outro.' },
      { h:1,  lat:40.7300, lng:-74.0020, loc:'West Village — Walking',   borough:1, desc:'Walking east toward home. A cab radio somewhere. Someone\'s open window. The city hums itself to sleep.' },
      { h:2,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Home. Asleep by 2:30. The good kind of asleep, amidst all that noise.' },
      { h:3,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep. She\'s dreaming about those sirens. Could make a good song out of that. Comedian Nathan Fielder famously used a smoke detector as an instrument.' },
      { h:4,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep.' },
      { h:5,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep while the motorcycles do their rounds. Are they racing??' },
      { h:6,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep. The city waking up. Not her problem yet.' },
      { h:7,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep. Alarm set for noon. A saw starts up somewhere. Her soundtrack to not waking up.' },
      { h:8,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep while the morning floods the streets.' },
      { h:9,  lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Still asleep. Still dreaming. No classes!' },
      { h:10, lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep while the city builds itself.' },
      { h:11, lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Asleep. The construction site outside has been going for four hours. She hasn\'t heard a note of it.' },
      { h:12, lat:40.7265, lng:-73.9862, loc:'Home — East Village',      borough:1, desc:'Up. Morning routine. Vocal exercises at the window with it half open. The machinery outside becomes part of her warm up. Big day today!' },
      { h:13, lat:40.7290, lng:-73.9900, loc:'East Village — Walk',      borough:1, desc:'Coffee shop and a slow walk. The street\'s loud and social. She\'s just observing.' },
      { h:14, lat:40.7290, lng:-73.9968, loc:'NYU Steinhardt',           borough:1, desc:'Practice room. Door closed all afternoon. Her and the piano. The whole world outside doesn\'t exist.' },
      { h:15, lat:40.7290, lng:-73.9968, loc:'NYU Steinhardt',           borough:1, desc:'Still in the practice room.  No clue what\'s happening outside.' },
      { h:16, lat:40.7290, lng:-73.9900, loc:'East Village — Evening',   borough:1, desc:'Heading toward the West Village. More sirens. Her show is coming up!' },
      { h:17, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Soundcheck. The room is silent, but she can still hear that ice cream truck outside. She snuck out to get one.' },
      { h:18, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Pre-show. The dinner crowd moving past the door. Someone blasting trap music outside.' },
      { h:19, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'First set. She\'s stealing everyone\'s heart.' },
      { h:20, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Performing. The room full. The SONYC sensors outside barely register her, just more trap music.' },
      { h:21, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Late set. The whole city talking at once outside. Inside, not even a whisper. She\'s mesmerizing everyone.' },
      { h:22, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Last song. The room still full but the night\'s is starting to slow down. Some loud engine noises outside still.' },
      { h:23, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Still at the club. She\'s breaking down the set and chatting with some patrons. Full of compliments.' },
    ]
  },
  {
    id: 'marcus',
    name: 'Marcus',
    role: 'Music Tech Professor',
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
      { h:0,  lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep. 2nd Ave through the window. He\'s lived here 22 years. The sound has become ambient.' },
      { h:1,  lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep. Probably dreaming in frequency bands.' },
      { h:2,  lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep.' },
      { h:3,  lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep while delivery trucks make their rounds on the avenue. The overnight economy. He will cite this.' },
      { h:4,  lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep.' },
      { h:5,  lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep. Alarm at 6:45. The day\'s data collection begins.' },
      { h:6,  lat:40.7763, lng:-73.9637, loc:'Upper East Side — Morning',borough:1, desc:'Up. Coffee, the news. The avenue quiet for now. He\'s getting ready to document it all.' },
      { h:7,  lat:40.7775, lng:-73.9460, loc:'East River Esplanade',     borough:1, desc:'Morning walk. The esplanade belongs to the dogs before it belongs to anyone else. Data point: 4.7% at this hour.' },
      { h:8,  lat:40.7763, lng:-73.9637, loc:'Upper East Side — Subway', borough:1, desc:'Heading to the 6 train. The dogs are out in force. He notes this. He notes everything.' },
      { h:9,  lat:40.7290, lng:-73.9976, loc:'Silver Center — NYU',      borough:1, desc:'Office hours. Machinery from across the street drilling into the morning. His students are used to the percussion.' },
      { h:10, lat:40.7290, lng:-73.9976, loc:'Silver Center — NYU',      borough:1, desc:'Class prep. The drill still going. His students have stopped hearing it. He hears it perfectly.' },
      { h:11, lat:40.7290, lng:-73.9976, loc:'Lecture Hall — NYU',       borough:1, desc:'Teaching. Good discussion. Someone asks about the noise. He pivots to explain dB. They get it for a second.' },
      { h:12, lat:40.7308, lng:-74.0002, loc:'Washington Square Park',   borough:1, desc:'Lunch on a bench. He eats and takes notes. Not about the food. About the sounds around it.' },
      { h:13, lat:40.7290, lng:-73.9976, loc:'Silver Center — NYU',      borough:1, desc:'Office hours. An ambulance on the street below. More or less every fifteen minutes. He\'s timed it.' },
      { h:14, lat:40.7480, lng:-73.9890, loc:'Midtown — Field Recording',borough:1, desc:'Subway uptown with a recorder and a notebook. Field recording for his Music Tech class. The real work begins.' },
      { h:15, lat:40.7592, lng:-73.9982, loc:'Hell\'s Kitchen — Street', borough:1, desc:'Mic out, levels set. Crosswalk chirps, HVAC, delivery trucks. The city as a signal. He\'s reading it.' },
      { h:16, lat:40.7592, lng:-73.9982, loc:'Hell\'s Kitchen — Street', borough:1, desc:'He records a garbage truck for twelve minutes. Not for the story. For the spectrum. The rolloff characteristics are perfect.' },
      { h:17, lat:40.7440, lng:-73.9935, loc:'1 Train — Downtown',       borough:1, desc:'Rush hour platform. Too loud to do anything but stand there. He stands there. Listening.' },
      { h:18, lat:40.7290, lng:-73.9976, loc:'NYU — Evening',            borough:1, desc:'Back at Silver Center. Answering emails. The street below still running loud. It\'s always loud here.' },
      { h:19, lat:40.7600, lng:-73.9637, loc:'6 Train — Uptown',         borough:1, desc:'Heading home. Loud downtown, quieter by the 70s. The gradient is real.' },
      { h:20, lat:40.7763, lng:-73.9637, loc:'Upper East Side — Dinner', borough:1, desc:'Neighborhood restaurant. The avenue outside. He\'s been coming here for years. Same noises. Different details every time.' },
      { h:21, lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Reading. Right now the whole city is at its loudest — the number he keeps citing in class. He closes the window. But he knows it\'s out there.' },
      { h:22, lat:40.7763, lng:-73.9637, loc:'Home — Upper East Side',   borough:1, desc:'Asleep. He\'s listened to the city long enough that sleeping through it counts as quiet.' },
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
      { h:0,  lat:40.7308, lng:-74.0002, loc:'West Village — Pickup',    borough:1, desc:'Bar crowd in the backseat. Everyone talking about where they need to go next. Nobody agrees.' },
      { h:1,  lat:40.7550, lng:-73.9850, loc:'Midtown — Late Night',     borough:1, desc:'Fewer fares. Midtown shutting down. She knows the fares get weirder from here.' },
      { h:2,  lat:40.7265, lng:-73.9862, loc:'East Village — Pickup',    borough:1, desc:'The late bars. The fares are quiet. Stranger. She\'s heard every story and most of them were lies.' },
      { h:3,  lat:40.7100, lng:-74.0050, loc:'Lower Manhattan',          borough:1, desc:'Long stretches with nobody in the back seat. The city\'s skeleton crew. Just work.' },
      { h:4,  lat:40.7072, lng:-74.0050, loc:'TriBeCa — Last Fares',     borough:1, desc:'Almost nothing left to pick up. The night shift is almost over. She\'s almost home.' },
      { h:5,  lat:40.7360, lng:-74.0010, loc:'Heading Home',             borough:1, desc:'Last run north. Just trucks and her and the West Side Highway. Golden hour of emptiness.' },
      { h:6,  lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Parked. Asleep by 6:30. She\'s earned it.' },
      { h:7,  lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep. The morning dog walkers are starting their circuits outside. She doesn\'t hear them.' },
      { h:8,  lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep hard.' },
      { h:9,  lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:10, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep while people live their days.' },
      { h:11, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep. A construction site three blocks over. Four hours in. She misses all of it.' },
      { h:12, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:13, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:14, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:15, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Starting to wake up. The afternoon street filtering through the curtains. She can feel her shift coming.' },
      { h:16, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Up. Coffee. Checking the surge map. Grabbing her keys. Back into it.' },
      { h:17, lat:40.7592, lng:-73.9982, loc:'Hell\'s Kitchen — Prepping',borough:1, desc:'Out for food, stretching her legs. Mentally preparing. She\'s about to go back into the machine.' },
      { h:18, lat:40.7550, lng:-73.9850, loc:'Midtown — Early Shift',    borough:1, desc:'Shift starts. Theater crowd, dinner crowd. Everyone needs somewhere to be. She\'s the solution to that problem.' },
      { h:19, lat:40.7480, lng:-73.9890, loc:'Midtown — Working',        borough:1, desc:'Shows letting out, bars opening. The fares come fast. Happy drunk people money in her bank account.' },
      { h:20, lat:40.7380, lng:-74.0020, loc:'West Village — Working',   borough:1, desc:'Restaurant crowd. Good fares, short rides. The pleasant hours. Before it gets weird.' },
      { h:21, lat:40.7308, lng:-74.0002, loc:'WSP Area — Working',       borough:1, desc:'The backseat is a blur of conversations. Everyone talking at once. The whole city talking at once. She drives through it.' },
      { h:22, lat:40.7265, lng:-73.9862, loc:'East Village — Working',   borough:1, desc:'Bars starting to close. The fares shifting character. Getting quieter. Getting weirder. She knows this part.' },
      { h:23, lat:40.7480, lng:-73.9890, loc:'Midtown — Late',           borough:1, desc:'Midnight Manhattan. The city trading voices for sirens. She turns the volume up to match.' },
    ]
  },
]
