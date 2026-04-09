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
    color: '#ff6e00',
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
      0:  'engine', // asleep, but street noise outside
      1:  'machinery',
      4:  'voice',
      8:  'dog',    // 7.6% — the morning dog peak
      13: 'voice',
      17: 'music',  // busker fires up as she's packing
      20: 'music',
      21: 'engine',
      23: 'voice',  // no dog clips within ±2h of midnight
    },
    schedule: [
      { h:0,  lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Midnight. Soundly asleep.' },
      { h:1,  lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Zzzzz... Is that her snoring or just the wind hitting the sensor? Or both?' },
      { h:2,  lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Still asleep. Some sirens. It\'s acutally just relaxing white noise to her.' },
      { h:3,  lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Alarm at 3:30. Or did that arbitrarily loud rumbling wake her up? Anyways time to get ready.' },
      { h:4,  lat:40.7157, lng:-73.9863, loc:'LES — Loading Cart',       borough:1, desc:'Some people shouting outside ><. She\'s already pulling the cart out though. Not her problem.' },
      { h:5,  lat:40.7200, lng:-73.9960, loc:'Walking Cart to WSP',      borough:1, desc:'Rolling north through empty streets. Just herself and the trucks.' },
      { h:6,  lat:40.7300, lng:-74.0000, loc:'WSP — Setting Up',         borough:1, desc:'Early street cleaners starting their shift. She\'s starting hers. Setting up.' },
      { h:7,  lat:40.7308, lng:-74.0002, loc:'WSP — Open',               borough:1, desc:'Here come the chainsaws. She doesn\'t mind. She\'s a Chainsaw Man anime fan.' },
      { h:8,  lat:40.7308, lng:-74.0002, loc:'WSP — Morning Rush',       borough:1, desc:'Woof woof! Dogs everywhere. Morning surge. The city finally wakes up. A big line forming. ' },
      { h:9,  lat:40.7308, lng:-74.0002, loc:'WSP — Steady',             borough:1, desc:'Lots of rumblings in the park. Just like any other day.' },
      { h:10, lat:40.7308, lng:-74.0002, loc:'WSP — Midmorning',         borough:1, desc:'More rumblings... Business has slowed down a tad.' },
      { h:11, lat:40.7308, lng:-74.0002, loc:'WSP — Building',           borough:1, desc:'Is that someone sweeping the park really loudly? Or is it the sound of an alien spaceship landing? Either way, lunch rush is coming up.' },
      { h:12, lat:40.7308, lng:-74.0002, loc:'WSP — Lunch Peak',         borough:1, desc:'Line past the fountain. She doesn\'t stop moving. Ninety minutes of pure chaos.' },
      { h:13, lat:40.7308, lng:-74.0002, loc:'WSP — Lunch',              borough:1, desc:'Still packed. Everyone talking at once, eating standing up, needing napkins.' },
      { h:14, lat:40.7308, lng:-74.0002, loc:'WSP — Afternoon',          borough:1, desc:'Even more rumblings.' },
      { h:15, lat:40.7308, lng:-74.0002, loc:'WSP — Best Hour',          borough:1, desc:'Her favorite. Almost sold out. People coming and going. Some chilling on the grass.'},
      { h:16, lat:40.7308, lng:-74.0002, loc:'WSP — After School',       borough:1, desc:'The skaters are starting to roll out. So are the ambulances.' },
      { h:17, lat:40.7308, lng:-74.0002, loc:'WSP — Rush Hour',          borough:1, desc:'Time for some ice cream!! It\'s been a long day.' },
      { h:18, lat:40.7308, lng:-74.0002, loc:'WSP — Dinner Crowd',       borough:1, desc:'It\'s getting late. Rosa breaking the cart down. Chatting with some folks in the mean time.' },
      { h:19, lat:40.7308, lng:-74.0002, loc:'WSP — Closing',            borough:1, desc:'Done for the night. Someone trying to promote their comedy show.' },
      { h:20, lat:40.7200, lng:-73.9960, loc:'Rolling Cart Home',        borough:1, desc:'South on Bowery. A pop up drum performance! Rosa has always been a punk at heart, so she loved that <3' },
      { h:21, lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'Washing up and getting ready for bed. Meanwhile the city\'s at full volume outside. 9pm is Manhattan\'s loudest hour. Actual fact btw.' },
      { h:22, lat:40.7157, lng:-73.9863, loc:'Home — Lower East Side',   borough:1, desc:'The street is calming down... Zzz... See you at 3:30.' },
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
      0:  'engine',    
      2:  'voice',
      5:  'engine',    // just him and the trucks
      6:  'engine',    // first truck on site, crew loading in quiet
      7:  'saw',       // "saw fires up at 7:01" — engine would win otherwise
      8:  'machinery', // "full swing. machinery 15.6%"
      10: 'machinery', // "machinery 16.5%"
      11: 'machinery', // "tapering. saw easing."
      17: 'alert',
      18: 'alert',
    },
    schedule: [
      { h:0,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Someone turned on the genrator? Eddie can NOT sleep!!!!' },
      { h:1,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Asleep... barely.' },
      { h:2,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Having a rough night. More than one hour till the alarm. Those people chatting outside the window are really bothering him.' },
      { h:3,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Three alarms popping in a row. He\'s already awake long before. Been doomscrolling for at least an hour.' },
      { h:4,  lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Coffee, gear, out before 5. He needded that coffee. The city\'s delivery trucks are the only other thing awake.' },
      { h:5,  lat:40.7240, lng:-74.0010, loc:'Walking to Job Site',      borough:1, desc:'Walking two miles north. Just him and the trucks.' },
      { h:6,  lat:40.7260, lng:-73.9990, loc:'Job Site — Arriving',      borough:1, desc:'First truck on the site. Crew loading in quiet. The neighborhood still sleeping.' },
      { h:7,  lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Saws fire up at 7:01 AM sharp. Fun fact, 7AM is the loudest hour across the five boroughs. Partially his work.' },
      { h:8,  lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'The saws woke the neighborhood up. Shouldn\'t matter.' },
      { h:9,  lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Bzzzzz... Eddie thanking whoever invented earplugs.' },
      { h:10, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Full pitch. Some exasperated faces around the neighborhood. But he\'s focused on the task.' },
      { h:11, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'The site finding a lower gear. The saw easing back. Almost lunch break, woohoo!' },
      { h:12, lat:40.7300, lng:-73.9990, loc:'Deli — Nearby',            borough:1, desc:'Around the corner for lunch. Like a completely different world. Still some rumblings, but they\'re not his!' },
      { h:13, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Afternoon session. Some lighter work. The loudest part\'s behind him.' },
      { h:14, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Werk werk werk. Steady pace. No drama.' },
      { h:15, lat:40.7300, lng:-73.9990, loc:'Job Site',                 borough:1, desc:'Packing tools. The street outside in full rush. He\'s done for the day.' },
      { h:16, lat:40.7300, lng:-73.9990, loc:'Street — Done',            borough:1, desc:'All wrapped up. Some faint music playing at WSP. Maybe he should go to Rosa\'s cart? They\'re good friends! Nevermind, it\'s almost rush hour. Better get home ASAP and catch up on sleep.' },
      { h:17, lat:40.7200, lng:-74.0040, loc:'Walking Home',             borough:1, desc:'South on the sidewalk going opposite the commuter surge. Tired. What\'s this ambulance about now?' },
      { h:18, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Home. He\'s a bit cranky, but happy to be back finally.' },
      { h:19, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Dinner, TV on. The city\'s still loud. Not his problem anymore.' },
      { h:20, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Hanging out in front for a bit. Lively crowd outside today! Hopefully they don\'t stay out until late...' },
      { h:21, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Alright, bed time. Tomorrow we go again. Alarm 3.45AM set.' },
      { h:22, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Asleep hard.' },
      { h:23, lat:40.7175, lng:-74.0090, loc:'Home — TriBeCa',           borough:1, desc:'Hardly asleep. That damned car woke him up!' },
    ]
  },
  {
    id: 'miura',
    name: 'Miura',
    role: 'Jazz Vocalist | NYU Student',
    clockRole: 'Jazz Vocalist',
    clockSubtitle: 'NYU Student',
    home: 'East Village',
    color: '#4f545b',
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
      1:  'music',
      3:  'alert',
      5:  'engine',
      7:  'saw',
      11: 'machinery',
      12: 'machinery', // wakes up to it — construction in its 4th hour
      16: 'alert',
      17: 'music',     // soundcheck
      18: 'music',     // pre-show
      19: 'music',     // first set
      20: 'music',     // performing
      21: 'voice',     // late set
      22: 'music',
    },
    schedule: [
      { h:0,  lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Now she\'s catching up with a couple friends. And getting free drinks, of course. Engine noises on 7th Ave make the perfect outro.' },
      { h:1,  lat:40.7300, lng:-74.0020, loc:'West Village — Walking',   borough:1, desc:'Walking east toward home. A cab radio somewhere. Someone\'s open window. More trap music.' },
      { h:2,  lat:40.7245, lng:-73.9832, loc:'Home — East Village',      borough:1, desc:'Home. Asleep by 2:30. The good kind of asleep, despite all that noise.' },
      { h:3,  lat:40.7245, lng:-73.9832, loc:'Home — East Village',      borough:1, desc:'Asleep. She\'s dreaming about those sirens. Could make a good song out of that. Comedian Nathan Fielder famously used a smoke detector as an instrument.' },
      { h:4,  lat:40.7245, lng:-73.9832, loc:'Home — East Village',      borough:1, desc:'Asleep.' },
      { h:5,  lat:40.7245, lng:-73.9832, loc:'Home — East Village',      borough:1, desc:'Asleep while the motorcycles do their rounds. Are they racing??' },
      { h:6,  lat:40.7245, lng:-73.9832, loc:'Home — East Village',      borough:1, desc:'Asleep. The city waking up. Not her problem yet.' },
      { h:7,  lat:40.7245, lng:-73.9832, loc:'Home — East Village',      borough:1, desc:'Asleep. Alarm set for noon. A saw starts up somewhere. Somehow she sleeps even better. Dreaming about that day she stumbled upon Dog Mode on the NYC Soundscape website, and how soothing that was.' },
      { h:8,  lat:40.7245, lng:-73.9832, loc:'Home — East Village',      borough:1, desc:'Asleep while the morning floods the streets.' },
      { h:9,  lat:40.7245, lng:-73.9832, loc:'Home — East Village',      borough:1, desc:'Still asleep. Still dreaming. No classes today! And a big performance! Woof woof!' },
      { h:10, lat:40.7245, lng:-73.9832, loc:'Home — East Village',      borough:1, desc:'ZZzzzZZzzZZZZzzzz.' },
      { h:11, lat:40.7245, lng:-73.9832, loc:'Home — East Village',      borough:1, desc:'Asleep. The construction site outside has been going for four hours. She hasn\'t heard a note of it.' },
      { h:12, lat:40.7245, lng:-73.9832, loc:'Home — East Village',      borough:1, desc:'Up. Morning routine. Vocal exercises at the window. The rumbling outside is her backing band. Big day today!' },
      { h:13, lat:40.7290, lng:-73.9900, loc:'Greenwich Village — Walk',      borough:1, desc:'Coffee shop and a casual walk. The street\'s loud today. She\'s taking it all in. Ahh... New York City. She\'s like that meme of someone romanticizing New York City like it\'s Tokyo.' },
      { h:14, lat:40.7290, lng:-73.9968, loc:'NYU Steinhardt',           borough:1, desc:'Practice room. Door closed all afternoon. Her and the piano. The whole world outside doesn\'t exist.' },
      { h:15, lat:40.7290, lng:-73.9968, loc:'NYU Steinhardt',           borough:1, desc:'...Bagpipes??!? What the heckie?! Miura is still in the practice room, missing out on all the excitement :(' },
      { h:16, lat:40.7290, lng:-73.9900, loc:'Greenwich Village — Evening',   borough:1, desc:'Heading toward the West Village. More sirens. Her show is coming up!' },
      { h:17, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Soundcheck. The room is silent, but she can still hear that ice cream truck outside. She snuck out to get one.' },
      { h:18, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Pre-show. The crowd moving past the door. Someone playing Don\'t Stop \'Til You Get Enough outside. Talk about out of place! Issa bop tho.' },
      { h:19, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'First set. She\'s stealing everyone\'s heart. The ice cream truck outside trying its best to compete.' },
      { h:20, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'A sold out show! The SONYC sensors outside barely register her, because the crowd outside is jamming to Justin Bieber\'s Let Me Love You. Another bop!' },
      { h:21, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Another set. The whole city talking at once outside. Inside, not even a whisper. She\'s mesmerizing everyone.' },
      { h:22, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Last song... standing ovation... loud Jazz music starts playing to chase out the crowd. SONYC sensors finally picked up some sounds from the venue!' },
      { h:23, lat:40.7348, lng:-74.0026, loc:'Village Vanguard',         borough:1, desc:'Still at the club. She\'s breaking down the set and chatting with some patrons. Full of compliments.' },
    ]
  },
  {
    id: 'marcus',
    name: 'Marcus',
    role: 'Music Tech Professor',
    home: 'Upper East Side',
    color: '#009952',
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
      5:  'engine',  // avenue delivery trucks while he sleeps
      7:  'dog',     // dogs everywhere this hour — 4.7%, engine would dominate
      8:  'dog',     
    },
    schedule: [
      { h:0,  lat:40.7763, lng:-73.9523, loc:'Home — Upper East Side',   borough:1, desc:'Asleep. The podcast has turned into Aphex Twin.' },
      { h:1,  lat:40.7763, lng:-73.9523, loc:'Home — Upper East Side',   borough:1, desc:'Asleep. He\'s been living here long enough, so nothing really bothers him anymore, not even the street engines. Maybe the sleep paralysis demon? But that\'s about it. Oh, and the back pain too.' },
      { h:2,  lat:40.7763, lng:-73.9523, loc:'Home — Upper East Side',   borough:1, desc:'Sleeping..' },
      { h:3,  lat:40.7763, lng:-73.9523, loc:'Home — Upper East Side',   borough:1, desc:'His daughter woke him up. That rumbly sound scared her, she said. She\'s taken over 3/4 of the bed. He gets the last quarter and sleeps just fine.' },
      { h:4,  lat:40.7763, lng:-73.9523, loc:'Home — Upper East Side',   borough:1, desc:'Asleep. It\'s been a relatively qutet night.' },
      { h:5,  lat:40.7763, lng:-73.9523, loc:'Home — Upper East Side',   borough:1, desc:'Still asleep. The avenue starting up outside. Two more hours.' },
      { h:6,  lat:40.7763, lng:-73.9523, loc:'Upper East Side — Morning',borough:1, desc:'The delivery truck that does his block every morning. He\'s heard it so many times he knows when it\'ll slow down before it does.' },
      { h:7,  lat:40.7775, lng:-73.9460, loc:'East River Esplanade',     borough:1, desc:'Morning walk. Fun fact: 4.7% of sounds at this hour are dog sounds.' },
      { h:8,  lat:40.7763, lng:-73.9523, loc:'Upper East Side — Subway', borough:1, desc:'Walking to the 6 train. Some dogs chasing him. No fear. Ocean waves...' },
      { h:9,  lat:40.7290, lng:-73.9976, loc:'Silver Center — NYU',      borough:1, desc:'Got to work. The street outside is a full of rumblings, but it\'s fine. He has Brian Eno in his ears.' },
      { h:10, lat:40.7290, lng:-73.9976, loc:'Silver Center — NYU',      borough:1, desc:'Class prep. There\'s a quiz today. It\'s not too hard, he thinks. (Half the class got a D+ on that, it turns out).' },
      { h:11, lat:40.7290, lng:-73.9976, loc:'Lecture Hall — NYU',       borough:1, desc:'Teaching. Fun discussions. Fourier transforms. Started class with the meme: \"She\'s giving me mixed signals, so I did a Fourier Analysis.\" No one laughed.' },
      { h:12, lat:40.7308, lng:-74.0002, loc:'Washington Square Park',   borough:1, desc:'Class dismissed 30 minutes early. He\'s bringing his packed lunch to the park. It\'s a nice day out, and he wants to hear the birds.' },
      { h:13, lat:40.7290, lng:-73.9976, loc:'Silver Center — NYU',      borough:1, desc:'Something vibrates the window. He barely noticed it. These papers won\'t grade themselves.' },
      { h:14, lat:40.7480, lng:-73.9890, loc:'Herald Square — Field Recording',borough:1, desc:'Time to do some field recordings. Somehow he ended up around Herald Square, and they\'re playing a pretty sick percussion beats.' },
      { h:15, lat:40.7592, lng:-73.9982, loc:'Hell\'s Kitchen — Field Recording', borough:1, desc:'Now for some real taste of NYC: the drill. Marcus is looking for ways to improve the SONYC dataset. Bzzzzzzz. That could be Eddie\'s crew!' },
      { h:16, lat:40.7592, lng:-73.9982, loc:'Hell\'s Kitchen — Field Recording', borough:1, desc:'Still recording. Now the sirens. He\'s basically collecting every single sound types in the dataset! What a nerd :D.' },
      { h:17, lat:40.7440, lng:-73.9935, loc:'E Train — Downtown',       borough:1, desc:'Rush hour platform. Too crowded to do anything. He clutches onto his trusty Zoom recorder. Someone brought a boombox cranked to the max. Classic.' },
      { h:18, lat:40.7290, lng:-73.9976, loc:'NYU — Evening',            borough:1, desc:'Back at his desk. Answering emails. The street below still running loud. It\'s always loud here.' },
      { h:19, lat:40.7700, lng:-73.9600, loc:'Trader Joe\'s — Upper East Side',         borough:1, desc:'Heading home. But first, a quick grocery run at the nearby Trader Joe\'s. On the way, eh saw a big protest on 1st Avenue. He supports them.' },
      { h:20, lat:40.7763, lng:-73.9523, loc:'Home — Upper East Side', borough:1, desc:'Family dinner. They\'re still protesting outside!' },
      { h:21, lat:40.7763, lng:-73.9523, loc:'Home — Upper East Side',   borough:1, desc:'Reading. The neighbors are noisy, but it\'s just white noise to him. He\'s finishing Project Hail Mary and nothing else can take his attention.' },
      { h:22, lat:40.7763, lng:-73.9523, loc:'Home — Upper East Side',   borough:1, desc:'\'What a book\', he says to himself. Lets out a big yawn, tugs his daughter into bed, and glares at the big, restless crowd gathering outside his window.' },
      { h:23, lat:40.7763, lng:-73.9523, loc:'Home — Upper East Side',   borough:1, desc:'Put on his favorite podcast. Quickly falling asleep.' },
    ]
  },
  {
    id: 'nadia',
    name: 'Nadia',
    role: 'Rideshare Driver',
    home: 'Hell\'s Kitchen',
    color: '#d82233',
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
      1:  'alert',  // siren cuts through Midtown — city thinking about going to sleep
      2:  'voice',  // the fares are quieter, stranger — voice 21%, more evocative than engine
      6:  'engine', // parked/asleep; trucks outside are the only sound
      19: 'voice',  // shows letting out, happy crowd — voice over engine for this hour
      23: 'alert',  // trading voices for sirens — alert is the story
    },
    schedule: [
      { h:0,  lat:40.7308, lng:-74.0002, loc:'West Village — Pickup',    borough:1, desc:'A bus rolls past. Life just rolling along.' },
      { h:1,  lat:40.7550, lng:-73.9850, loc:'Times Square — Late Night',     borough:1, desc:'She hates driving through Times Square. What are people doing here at this hour anyway!' },
      { h:2,  lat:40.7265, lng:-73.9862, loc:'East Village — Pickup',    borough:1, desc:'The late bars. The fares are quiet. Stranger. She\'s heard every story and most of them were lies.' },
      { h:3,  lat:40.7100, lng:-74.0050, loc:'Lower Manhattan',          borough:1, desc:'Long stretches with nobody in the back seat. The city\'s skeleton crew. Just work.' },
      { h:4,  lat:40.7072, lng:-74.0050, loc:'TriBeCa — Last Fares',     borough:1, desc:'Almost nothing left to pick up. The night shift is almost over. She\'s almost home.' },
      { h:5,  lat:40.7360, lng:-74.0010, loc:'Heading Home',             borough:1, desc:'Last run north. A car alarm somewhere west keeps insisting on itself, bright and stupid in the empty lanes. She doesn\'t even flinch.' },
      { h:6,  lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Parked. Asleep by 6:30. She\'s earned it.' },
      { h:7,  lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep. Morning traffic starts stitching the avenue back together, one engine at a time. She sleeps through every stitch.' },
      { h:8,  lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep hard.' },
      { h:9,  lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:10, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep while people live their days.' },
      { h:11, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep. Idling trucks and passing buses trade places outside her window like it\'s a shift schedule. She misses every handoff.' },
      { h:12, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:13, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:14, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Asleep.' },
      { h:15, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'Starting to wake up. The afternoon street filtering through the curtains. She can feel her shift coming.' },
      { h:16, lat:40.7592, lng:-73.9982, loc:'Home — Hell\'s Kitchen',   borough:1, desc:'A tinny melody outside, the kind that makes your brain look up even when you don\'t. She checks the surge map, grabs her keys, and follows the music back into the street.' },
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
