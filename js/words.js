/* SKETCHDUEL word bank: ~225 single words across 3 tiers, curated for
   fast drawing + reliable vision recognition. Difficulty is a WEIGHTED
   MIX, not a hard split, so the curve stays smooth:
     easy   -> easy only
     medium -> 70% medium, 30% easy
     hard   -> 60% hard, 40% medium
   Compound objects are stored as single tokens (icecream, hotdog,
   trafficlight); the matcher is spacing-insensitive, so a guess of
   "ice cream" still scores an exact hit. */
window.SD = window.SD || {};

SD.WORDS = {
  easy: [
    "apple", "banana", "orange", "grapes", "watermelon", "pear", "peach", "cherry", "lemon", "carrot",
    "corn", "potato", "tomato", "onion", "egg", "cake", "pizza", "burger", "cookie", "donut",
    "fries", "cup", "plate", "spoon", "fork", "knife", "bottle", "house", "door", "window",
    "bed", "chair", "table", "lamp", "fan", "mirror", "sink", "pillow", "blanket", "stairs",
    "car", "bus", "truck", "train", "boat", "ship", "bicycle", "rocket", "wheel", "sun",
    "moon", "star", "cloud", "rain", "tree", "flower", "leaf", "fire", "mountain", "river",
    "beach", "dog", "cat", "bird", "fish", "rabbit", "horse", "cow", "pig", "duck",
    "frog", "snake", "turtle", "bear", "eye", "ear", "nose", "mouth", "tooth", "heart",
    "hand", "foot", "finger", "hat", "shoe", "sock", "shirt", "pants", "glasses", "umbrella",
    "balloon", "kite", "ball", "key", "book", "pencil", "pen", "clock", "phone", "gift", "crown"
  ],
  medium: [
    "pineapple", "strawberry", "mango", "broccoli", "mushroom", "icecream", "hotdog", "sandwich", "cupcake", "popcorn",
    "coffee", "tea", "milk", "juice", "laptop", "keyboard", "mouse", "monitor", "television", "camera",
    "headphones", "speaker", "watch", "calculator", "remote", "battery", "charger", "lightbulb", "flashlight", "microphone",
    "eraser", "marker", "paintbrush", "ruler", "notebook", "backpack", "scissors", "glue", "paper", "folder",
    "calendar", "map", "newspaper", "envelope", "stamp", "ticket", "sofa", "toilet", "bathtub", "refrigerator",
    "oven", "microwave", "washingmachine", "airplane", "helicopter", "motorcycle", "scooter", "submarine", "trafficlight", "bridge",
    "road", "tire", "helmet", "anchor", "snowflake", "lightning", "rainbow", "volcano", "cactus", "ocean",
    "island", "tent", "chicken", "elephant", "lion", "tiger", "monkey", "penguin", "butterfly", "dress",
    "football", "basketball", "tennis", "guitar", "piano", "drum", "violin", "dice", "chess", "trophy",
    "medal", "lock", "magnet", "robot", "ghost", "diamond", "brain"
  ],
  hard: [
    "binoculars", "compass", "hourglass", "satellite", "telescope", "microscope", "windmill", "lighthouse", "origami", "joystick",
    "boomerang", "parachute", "zipper", "fountain", "waterfall", "igloo", "castle", "skyscraper", "carousel", "volleyball",
    "skateboard", "rollercoaster", "mailbox", "hammer", "wrench", "screwdriver", "paintpalette", "treasure", "crystal"
  ]
};

/* per-pick tier weights [tier, probability] for each selected difficulty */
SD.MIX = {
  easy:   [["easy", 1.0]],
  medium: [["medium", 0.7], ["easy", 0.3]],
  hard:   [["hard", 0.6], ["medium", 0.4]]
};

SD.SYN = {
  "television": ["tv", "telly"],
  "refrigerator": ["fridge"],
  "airplane": ["plane", "aeroplane", "jet"],
  "bicycle": ["bike", "cycle"],
  "motorcycle": ["motorbike", "bike"],
  "lightbulb": ["bulb", "light"],
  "paintbrush": ["brush"],
  "paintpalette": ["palette"],
  "trafficlight": ["stoplight", "signal"],
  "washingmachine": ["washer"],
  "skyscraper": ["building", "tower"],
  "sofa": ["couch"],
  "fries": ["chips"],
  "burger": ["hamburger", "cheeseburger"],
  "icecream": ["cone"],
  "glasses": ["spectacles", "sunglasses"],
  "phone": ["cellphone", "smartphone", "mobile"],
  "boat": ["ship", "sailboat"],
  "rocket": ["spaceship", "spacecraft"],
  "car": ["automobile"],
  "cup": ["mug"],
  "volcano": ["eruption", "lava"],
  "tornado": ["twister"],
  "elephant": ["mammoth"],
  "treasure": ["chest", "loot"],
  "crown": ["tiara"]
};

/* draw a fresh word using the weighted mix, avoiding repeats. If the
   picked tier is exhausted, fall through to the other mixed tiers;
   only when EVERY involved tier is used up do we reset them. */
SD.pickWord = function (difficulty, usedSet) {
  var mix = SD.MIX[difficulty] || SD.MIX.easy;

  // choose a tier by weight
  var r = Math.random(), acc = 0, tier = mix[0][0];
  for (var i = 0; i < mix.length; i++) {
    acc += mix[i][1];
    if (r <= acc) { tier = mix[i][0]; break; }
  }

  // try the chosen tier first, then the rest of the mix as fallback
  var order = [tier];
  mix.forEach(function (m) { if (order.indexOf(m[0]) === -1) order.push(m[0]); });

  for (var j = 0; j < order.length; j++) {
    var pool = SD.WORDS[order[j]];
    var avail = pool.filter(function (w) { return !usedSet.has(w); });
    if (avail.length) {
      var w = avail[Math.floor(Math.random() * avail.length)];
      usedSet.add(w);
      return w;
    }
  }

  // every involved tier is used up: reset just those tiers and retry
  order.forEach(function (t) {
    SD.WORDS[t].forEach(function (w) { usedSet.delete(w); });
  });
  var fallbackPool = SD.WORDS[tier];
  var fw = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  usedSet.add(fw);
  return fw;
};
