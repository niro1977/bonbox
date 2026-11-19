/* Candoku narrator: recorded lines in a deep, charismatic male voice (audio/voice/*.mp3).
   If a clip is missing or can't play, it falls back to the device's own speech voice. */
(function (root) {
  const S = root.CandokuSound, synth = root.speechSynthesis, ES = root.LANG === 'es', TT = root.T || ((x) => x), DIR = ES ? 'audio/voice/es/' : 'audio/voice/';
  let enabled = true, last = 0, chosen = null, current = null;
  try { const v = localStorage.getItem('candoku.voice'); if (v !== null) enabled = JSON.parse(v); } catch (e) {}

  const CLIPS = {
    welcome: 'Welcome to Bonbox!',
    intro1: 'Bonbox Land was the sweetest place in the world.',
    intro2: 'Then came a giant sneeze. Achoo! Every candy got mixed up!',
    intro3: 'Help Gumi put them back. One candy in every color, and no two candies can touch!',
    story1: 'In Bonbox Land, every sweet lived in the great Bonbox, each one in its own perfect spot.',
    story2: 'But up in the clouds lived Vinegar, the grumpy storm king. He could not stand all that sweetness!',
    story3: 'He took a giant breath and... ACHOO! A wild candy storm blew every candy out of the Bonbox!',
    story4: 'Only Gumi can fix it! Help him find the perfect spot for every candy: one in every color, and no two candies touching!',
    boss1: 'Vinegar blocks the way! You can beat him!', boss2: 'You defeated Vinegar! Amazing!',
    end1: 'At the top of the storm, Gumi did not fight. He held out one sweet lollipop and said: try it, just once.',
    end2: 'Vinegar took one tiny taste... and his sour face melted into the biggest smile Bonbox Land had ever seen!',
    end3: 'From that day on, Vinegar was the sweetest cloud in Bonbox Land, and the Bonbox was full again. Thank you for playing!',
    perfectword: 'Perfect!',
    two1: 'Nicely done!', two2: 'Great job!', two3: 'Well played!', two4: 'So close to perfect!',
    one1: 'Phew! That was close!', one2: 'Wow, you just made it!', one3: 'By a whisker!', one4: 'What a narrow escape!',
    letsplay: "Let's play!",
    mmmsweet: 'Mmm, sweet!', sugarrush: 'Sugar rush!', candylicious: 'Candy-licious!', sosweet: 'So sweet!', gumtastic: 'Gum-tastic!', bontastic: 'Bon-tastic!', treattastic: 'Treat-tastic!', whatatreat: 'What a treat!',
    first: 'Sweet!', yummy: 'Yummy!', tasty: 'Tasty!', nice: 'Nice one!', delicious: 'Delicious!',
    perfect: 'Delicious! Perfect!', divine: 'Divine! Perfect!', sugartastic: 'Sugar-tastic! Perfect!',
    verytasty: 'Very tasty!', close: 'Sweet! That was close!', lose: 'Oh no! Try again!',
    go: "Let's go!", ready: 'Ready? Go!', hard: 'Hard level! You can do it!', veryhard: 'Very hard level! Good luck!', extremehard: 'Extremely hard level! Good luck!',
    reward1: 'You got a prize!', reward2: 'Congratulations!', reward3: 'Wow! Nice reward!', bigreward: 'Amazing! A big reward!', wandget: 'A magic wand! Use it wisely!',
    z0: 'Welcome to Lollipop Meadow!', z1: 'Welcome to Chocolate River!', z2: 'Welcome to Frosting Mountains!', z3: 'Welcome to Cotton Candy Sky!',
    z4: 'Welcome to Ice Cream Beach!', z5: 'Welcome to Gingerbread Winter!', z6: 'Welcome to Donut Lake!', z7: 'Welcome to Cookie Canyon!', z8: 'Welcome to Crystal Caves!',
    z9: 'Welcome to Jelly Jungle!', z10: 'Welcome to Cupcake Village!', z11: 'Welcome to Candy Cane Forest!', z12: 'Welcome to Caramel Falls!', z13: 'Welcome to Carnival Fairground!', z14: 'Welcome to Macaron Mesa!', z15: 'Welcome to Waffle Castle!', z16: 'Welcome to Soda Springs!', z17: 'Welcome to Honey Hive Hills!', z18: 'Welcome to Berry Bog!', z19: 'Welcome to Mint Mountain!', z20: 'Welcome to Licorice Night Market!', z21: 'Welcome to Sugar Dunes Oasis!', z22: 'Welcome to Pudding Pools!', z23: 'Welcome to Cinnamon Autumn Forest!', z24: 'Welcome to Starlight Sprinkle Galaxy!', z25: 'Welcome to Toffee Treehouse Village!', z26: 'Welcome to Gumdrop Garden!', z27: 'Welcome to Royal Cake Palace!', z28: 'Welcome to Rainbow Sherbet Glacier!', z29: 'Welcome to Sweet Kingdom Gate!',
    z30: 'Welcome to Sour Lemon Grove!', z31: 'Welcome to Bubblegum Swamp!', z32: 'Welcome to Marshmallow Clouds!', z33: 'Welcome to Popcorn Peaks!', z34: 'Welcome to Jellybean Harbor!', z35: 'Welcome to Peppermint Blizzard!', z36: 'Welcome to Fudge Volcano!', z37: 'Welcome to Taffy Twister Plains!', z38: 'Welcome to Sprinkle Desert!', z39: 'Welcome to Gummy Bear Woods!', z40: 'Welcome to Candy Carnival Night!', z41: 'Welcome to Blueberry Moon Lagoon!', z42: 'Welcome to Maple Syrup Marsh!', z43: 'Welcome to Rock Candy Cliffs!', z44: 'Welcome to Churro Canyon!', z45: 'Welcome to Strawberry Storm Fields!', z46: 'Welcome to Licorice Ruins!', z47: 'Welcome to Thundercloud Citadel!', z48: 'Welcome to Sour Storm Summit!', z49: "Welcome to Vinegar's Castle!"
  };
  const ID_OF = {}; Object.keys(CLIPS).forEach((k) => { ID_OF[CLIPS[k]] = k; });
  const buffers = {}, loading = {};

  // Only the short, frequent lines are kept ready (about 8 MB). Every other line (story, worlds, prizes, ending) is loaded when it is
  // needed, and only the last few of those stay in memory. Loading all 113 lines at the first touch held about 75 MB of decoded sound,
  // made slow phones stutter, and could get the game closed by Android.
  const READY = ['go', 'ready', 'letsplay', 'perfectword', 'two1', 'two2', 'two3', 'two4', 'one1', 'one2', 'one3', 'one4', 'close', 'lose'];
  const MAX_KEPT = 12, kept = [];
  const isReady = (id) => READY.indexOf(id) >= 0 || PRAISE.indexOf(id.replace(/^f\//, '')) >= 0;
  function remember(id) {
    if (isReady(id)) return;
    const i = kept.indexOf(id); if (i >= 0) kept.splice(i, 1); kept.push(id);
    while (kept.length > MAX_KEPT) { const old = kept.shift(); delete buffers[old]; delete loading[old]; }   // a line still playing keeps its own copy
  }
  function load(id) {
    if (buffers[id] !== undefined) return Promise.resolve(buffers[id]);
    if (loading[id]) return loading[id];
    const ctx = S.ctx();
    if (!ctx) return Promise.resolve(null);
    loading[id] = fetch(DIR + id + '.mp3')
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('missing'))))
      .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then((b) => { buffers[id] = b; remember(id); return b; })
      .catch(() => (buffers[id] = null));
    return loading[id];
  }
  function preload() { READY.forEach(load); PRAISE.forEach((k) => { load(k); load('f/' + k); }); }
  // the story and the ending load their next lines while the first one plays, so no line starts late
  function prefetch(textsOrIds) { (textsOrIds || []).forEach((t) => { const id = CLIPS[t] ? t : ID_OF[t]; if (id) load(id); }); }

  function stop() {
    if (current) { try { current.onended = null; current.stop(); } catch (e) {} current = null; }
    if (synth) synth.cancel();
    const M = root.CandokuMusic; if (M) M.duck(false);
  }

  function pickVoice() {
    if (!synth) return null;
    const vs = synth.getVoices().filter((v) => (ES ? /^es/i : /^en/i).test(v.lang));
    if (!vs.length) return null;
    chosen = vs.find((v) => /(guy|andrew|christopher|david|daniel|alex|male|fred|george|google uk english male)/i.test(v.name)) || vs.find((v) => (ES ? /^es-(MX|US|419)/i : /^en-US/i).test(v.lang)) || vs[0];
    return chosen;
  }
  if (synth && synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice);
  function speakFallback(text) {
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(TT(text)), M = root.CandokuMusic;
    u.voice = chosen || pickVoice(); u.lang = ES ? 'es-MX' : 'en-US'; u.pitch = 0.7; u.rate = 1.0; u.volume = 1;
    u.onstart = () => { if (M) M.duck(true); };
    u.onend = u.onerror = () => { if (M) M.duck(false); };
    synth.speak(u);
  }

  function playClip(id, text) {
    const ctx = S.ctx();
    if (!ctx) return;
    load(id).then((buf) => {
      if (!buf) { stop(); speakFallback(text); return; }
      remember(id);
      stop();
      const src = ctx.createBufferSource(), g = ctx.createGain(), M = root.CandokuMusic;
      src.buffer = buf; g.gain.value = 1.15;
      src.connect(g); g.connect(S.dest());
      src.onended = () => { if (current === src) { current = null; if (M) M.duck(false); } };
      current = src;
      if (M) M.duck(true);
      src.start();
    });
  }

  // a shuffled bag per group: every line of the group is used once before any of them comes back, and never the same line twice in a row
  const bags = {}, lastOf = {};
  const any = (key, a) => {
    let b = bags[key];
    if (!b || !b.length) { b = bags[key] = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } if (b.length > 1 && b[b.length - 1] === lastOf[key]) b.unshift(b.pop()); }
    return (lastOf[key] = b.pop());
  };
  // every word is recorded in English (audio/voice/) and Spanish (audio/voice/es/), by both narrators (the female one in f/)
  // one 'sweet' word only ("Mmm, sweet!" and "So sweet!" are left out so the word does not repeat)
  const PRAISE = ['first', 'yummy', 'tasty', 'nice', 'delicious', 'verytasty', 'sugarrush', 'candylicious', 'bontastic', 'treattastic', 'whatatreat'];
  // what the Spanish recordings of these words say (shown on the board in Spanish)
  const ES_WORD = { first: '¡Dulce!', yummy: '¡Rico!', tasty: '¡Sabroso!', nice: '¡Bien hecho!', delicious: '¡Delicioso!', verytasty: '¡Muy sabroso!', sugarrush: '¡Subidón de azúcar!', candylicious: '¡Caramelicioso!', bontastic: '¡Fantástico!', treattastic: '¡Riquísimo!', whatatreat: '¡Qué golosina!' };
  // the words already said on this board: none of them comes back until the next board
  let boardUsed = new Set();
  const boardWord = () => { let left = PRAISE.filter((k) => !boardUsed.has(k)); if (!left.length) { boardUsed = new Set(); left = PRAISE.slice(); } const k = left[Math.floor(Math.random() * left.length)]; boardUsed.add(k); return k; };
  const V = {
    available() { return true; },
    isEnabled() { return enabled; },
    setEnabled(v) { enabled = !!v; try { localStorage.setItem('candoku.voice', JSON.stringify(enabled)); } catch (e) {} if (!enabled) stop(); else preload(); },
    preload,
    prefetch,
    cancel: stop,
    // say by clip id ("first") or by its exact text ("Sweet!"); unknown text uses the device voice
    say(textOrId, force) {
      if (!enabled || !S.isOn()) return;
      const now = performance.now();
      if (!force && now - last < 1500) return;
      last = now;
      const id = CLIPS[textOrId] ? textOrId : ID_OF[textOrId];
      if (id) playClip(id, CLIPS[id]); else { stop(); speakFallback(textOrId); }
    },
    praise() { V.say(boardWord()); },
    newBoard() { boardUsed = new Set(); },
    pick(key, list) { return any(key, list); },
    first() { V.say(boardWord()); },
    // a word for every candy found; a word still being spoken is never cut off (that candy just stays quiet)
    // about 2 times in 10 the word comes from the female narrator (audio/voice/f/, same words, a little faster)
    // returns the word it says, so the game shows exactly that word on the board (null while a word is still being said)
    candy() {
      if (current || (synth && synth.speaking)) return null;
      const id = boardWord(), word = ES ? (ES_WORD[id] || CLIPS[id]) : CLIPS[id];
      if (!enabled || !S.isOn()) return word;
      if (Math.random() < 0.2) { last = performance.now(); playClip('f/' + id, CLIPS[id]); } else V.say(id, true);
      return word;
    },
    // three hearts: Perfect. Two hearts: a warm well-done. One heart left: a close call.
    win(hearts) { V.say(hearts >= 3 ? 'perfectword' : hearts === 2 ? any('two', ['two1', 'two2', 'two3', 'two4']) : any('one', ['close', 'one1', 'one2', 'one3', 'one4']), true); },   // a finished level is always "Perfect!"
    lose() { V.say('lose', true); },
    start(lv, tier) { V.say(tier === 'extreme' ? 'extremehard' : tier === 'veryhard' ? 'veryhard' : tier === 'hard' ? 'hard' : any('go', ['go', 'ready']), true); }
  };
  document.addEventListener('pointerdown', () => { if (enabled) preload(); }, { once: true });
  root.CandokuVoice = V;
})(window);
