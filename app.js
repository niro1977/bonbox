/* Bonbox app: level map, play logic, hearts, hints, sound hooks, transitions. */
(function () {
  const T = window.T || ((x) => x);
  const E = window.CandokuEngine, H = window.CandokuHints, S = window.CandokuSound;
  const SEEDS = window.CandokuSeeds || { hard: {}, veryhard: {} };
  // vivid tiles, one per color region
  const COLORS = ['#22b8ff', '#7ee21f', '#ffd400', '#ff52c8', '#a45cff', '#00dcb0', '#ff8a00', '#ff3d3d', '#3a5cff', '#c98240'];
  const NAMES = ['Lollipop', 'Wrapped Candy', 'Chocolate Bar', 'Glazed Donut', 'Cupcake', 'Choc Chip Cookie', 'Cherries', 'Soft Serve', 'Shortcake', 'Candy Dango'];
  const starSvg = (on) => '<img class="star ' + (on ? '' : 'off') + '" src="art/star_' + (on ? 'gold' : 'grey') + '.webp" alt="" draggable="false">';
  const MAX_HEARTS = 3;
  const $ = (id) => document.getElementById(id);
  const M = window.CandokuMusic, V = window.CandokuVoice;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('candoku.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('candoku.' + k, JSON.stringify(v)); } catch (e) {} }
  };

  let level = store.get('level', 1);
  let stars = store.get('stars', {});
  let daily = store.get('daily', { last: '', streak: 0 });
  let cur = null;
  let score = store.get('score', { date: '', points: 0, run: 0, best: 0 });
  const START_HINTS = 3, HINT_EVERY = 10, WAND_EVERY = 15;
  let items = Object.assign({ shield: 1, double: 0, sweeper: 1, lens: 1 }, store.get('items', {}));
  let coins = store.get('coins', 30), wands = store.get('wands', 1), bonus = store.get('bonus', { last: '', streak: 0 });
  let hintsLeft = store.get('hints', START_HINTS), cleared = store.get('cleared', 0);   // hints in the bag, levels passed for the first time
  const RANKS = [[0, 'Rookie'], [200, 'Candy Fan'], [500, 'Sweet Tooth'], [1000, 'Sugar Pro'], [2000, 'Candy Master'], [4000, 'Candy Legend']];
  function freshScore() {
    const t = today();
    if (score.date !== t) { score = { date: t, points: 0, run: 0, best: score.best || 0 }; store.set('score', score); }   // every day starts at 0
  }
  // Each board solved in a row multiplies the reward: x1, x2, x3 ... up to x10.
  // Reward = 10 points x multiplier, capped by board size (10x10 = 100, 9x9 = 90, 8x8 = 80 ...).
  function pointsFor(n, run) {
    const mult = Math.min(10, Math.max(1, run));
    return { mult, cap: n * 10, gain: Math.min(n * 10, 10 * mult) };
  }
  /* ---------- daily ranking (Cloudflare Worker) ---------- */
  const RANK_URL = 'https://candoku-ranking.niriangelo.workers.dev';
  let pid = store.get('pid', ''), pname = store.get('pname', '');
  if (!pid) { pid = (crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now() + Math.random().toString(36).slice(2, 10)); store.set('pid', pid); }
  if (!pname) { pname = 'Player' + Math.floor(1000 + Math.random() * 9000); store.set('pname', pname); }
  function postScore() {
    if (!score.points) return Promise.resolve(null);
    return fetch(RANK_URL + '/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pid, name: pname, points: score.points }) })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  }
  function renderBoard(d) {
    const box = $('rankList'); box.innerHTML = '';
    if (!d || !d.top) { box.innerHTML = '<p class="small">Cannot reach the ranking. Check your connection and try again.</p>'; $('rankMine').textContent = ''; return; }
    if (!d.top.length) box.innerHTML = '<p class="small">No one has scored yet today. Be the first!</p>';
    for (const r of d.top) {
      const row = document.createElement('div'); row.className = 'rrow' + (r.me ? ' me' : '');
      const n = document.createElement('b'); n.textContent = r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank;
      const nm = document.createElement('span'); nm.textContent = r.name;
      const pt = document.createElement('em'); pt.textContent = r.points;
      row.append(n, nm, pt); box.appendChild(row);
    }
    $('rankMine').textContent = d.mine ? 'You are #' + d.mine.rank + ' of ' + d.mine.players + ' today with ' + d.mine.points + ' pts' : (score.points ? '' : 'Solve a board to join the ranking today');
  }
  async function openRanking() {
    S.unlock(); S.tap();
    freshScore();
    $('rankName2').value = pname;
    $('rankList').innerHTML = '<p class="small">Loading…</p>'; $('rankMine').textContent = '';
    $('ranking').hidden = false;
    const posted = await postScore();     // also refreshes my row
    if (posted) return renderBoard(posted);
    try { const r = await fetch(RANK_URL + '/top?id=' + encodeURIComponent(pid)); renderBoard(r.ok ? await r.json() : null); } catch (e) { renderBoard(null); }
  }
  function saveName() {
    const v = $('rankName2').value.replace(/[<>&"'`]/g, '').trim().slice(0, 16);
    if (v && v !== pname) { pname = v; store.set('pname', pname); postScore().then((d) => { if (d && !$('ranking').hidden) renderBoard(d); }); }
  }
  function renderScore() {
    freshScore();
    let i = 0; for (let k = 0; k < RANKS.length; k++) if (score.points >= RANKS[k][0]) i = k;
    const next = RANKS[i + 1];
    $('rankName').textContent = RANKS[i][1];
    $('ptsToday').textContent = score.points;
    $('rankBar').style.width = (next ? Math.min(100, ((score.points - RANKS[i][0]) / (next[0] - RANKS[i][0])) * 100) : 100) + '%';
    $('scoreSub').textContent = (next ? (next[0] - score.points) + ' pts to ' + next[1] : 'Top rank reached!') + (score.run ? ' · next board ×' + Math.min(10, score.run + 1) : '') + (score.best ? ' · best day ' + score.best : '');
  }

  const baseSize = (lv) => Math.min(10, 5 + Math.floor((lv - 1) / 4));
  // from level 21 the boards are 10x10, with a hard 9x9 or 8x8 mixed in now and then (never on Hard/Very Hard/Extreme levels)
  const varietySize = (lv) => { if (lv < 21 || lv % 5 === 0) return 0; const h = Math.imul(lv, 2654435761) >>> 0; const r = (h >>> 8) % 100; return r < 16 ? 9 : r < 30 ? 8 : 0; };
  const LAST_LEVEL = 500, ULTRA_FROM = 301;   // 301-500: only the hardest boards
  const sizeFor = (lv) => (lv >= ULTRA_FROM ? (lv % 5 === 0 || lv % 5 === 2 ? 10 : 9) : varietySize(lv) || baseSize(lv));
  const tierOf = (lv) => (lv % 10 === 0 ? 'extreme' : lv >= ULTRA_FROM ? 'veryhard' : lv % 5 === 0 ? 'hard' : 'normal');   // every world ends with an Extremely Hard level
  const dailySize = () => [6, 7, 8, 9, 10, 8, 7][new Date().getDay()];
  const tierLabel = { hard: 'Hard', veryhard: '👑 Very Hard', extreme: '💀 Extremely Hard' };

  function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  let hapticOn = store.get('haptic', true);
  function buzz(p) { try { if (hapticOn && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  document.addEventListener('pointerdown', (e) => { if (hapticOn && e.target.closest && e.target.closest('button,.cell,.node,.bcard,.mcard,.med,.chip,.colcell,.bst')) { try { if (navigator.vibrate) navigator.vibrate(7); } catch (_) {} } }, true);
  /* ---------- polish: every button answers the finger; every window pops in with a sound ---------- */
  const PRESSABLE = 'button,.node,.bcard,.mcard,.med,.chip,.colcell,.bst,.evcard';
  let pressedEl = null;
  document.addEventListener('pointerdown', (e) => { const b = e.target.closest && e.target.closest(PRESSABLE); if (!b || b.disabled || b.closest('#board')) return; pressedEl = b; b.classList.add('pressing'); S.press(); }, true);
  const liftPress = () => { if (!pressedEl) return; pressedEl.classList.remove('pressing'); pressedEl = null; S.release(); };
  document.addEventListener('pointerup', liftPress, true); document.addEventListener('pointercancel', liftPress, true);
  // the wallet bar lives on <body>, fixed to the top: visible on the map and above every popup, so prizes can fly into it
  (function liftWallet() { const w = document.querySelector('.wallet'); if (w) { document.body.appendChild(w); w.classList.add('topbar'); } })();
  const anyOverlay = () => [...document.querySelectorAll('.overlay')].some((o) => !o.hidden && o.id !== 'wipe');
  function watchOverlays() {
    const quiet = { wipe: 1, coach: 1 }; let lastPop = 0;
    document.querySelectorAll('.overlay').forEach((ov) => {
      new MutationObserver(() => {
        document.body.classList.toggle('ov-open', anyOverlay());
        const now = performance.now(), card = ov.querySelector('.card');
        if (!ov.hidden) {
          if (card) { card.classList.remove('popin'); void card.offsetWidth; card.classList.add('popin'); }
          ov.classList.remove('fadein'); void ov.offsetWidth; ov.classList.add('fadein');
          if (!quiet[ov.id] && now - lastPop > 120) { lastPop = now; S.popIn(); }
        } else if (!quiet[ov.id] && now - lastPop > 120) { lastPop = now; S.popOut(); }
      }).observe(ov, { attributes: true, attributeFilter: ['hidden'] });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchOverlays); else setTimeout(watchOverlays, 0);
  function show(id) { ['home', 'game'].forEach((s) => { $(s).hidden = s !== id; }); document.body.classList.toggle('in-game', id === 'game'); if (M) M.mood(id === 'game' ? 'game' : 'menu'); window.scrollTo(0, 0); }

  /* ---------- screen transition: a rainbow wipe with a spinning candy ---------- */
  function transition(mid) {
    return new Promise((resolve) => {
      const w = $('wipe'); w.hidden = false; S.whoosh();
      const a = w.animate([{ clipPath: 'circle(0% at 50% 60%)' }, { clipPath: 'circle(150% at 50% 60%)' }], { duration: 420, easing: 'ease-in', fill: 'forwards' });
      a.onfinish = async () => {
        await sleep(30);
        try { await mid(); } catch (e) { console.error(e); }
        await sleep(160);
        const b = w.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, fill: 'forwards' });
        b.onfinish = () => { w.getAnimations().forEach((x) => x.cancel()); w.hidden = true; resolve(); };
      };
    });
  }

  /* ---------- sound button state ---------- */
  function syncSound() {
    document.querySelectorAll('.sndBtn use').forEach((u) => u.setAttribute('href', S.isOn() ? '#snd-on' : '#snd-off'));
  }

  /* ---------- level map ---------- */
  const WORLD_HUES = [178, 330, 270, 140, 215, 8, 300, 45, 100, 195];   // same colors as the world ribbons
  const MAP_STEP = 96, WORLD_GAP = 96;
  function mapGeom() {
    const W = Math.min(window.innerWidth, 460) - 32;
    const count = LAST_LEVEL;   // every level of every world is on the map from the start
    const Ht = count * MAP_STEP + (count / 10) * WORLD_GAP + 150;   // a clear band between worlds holds the title ribbon
    return { W, count, Ht, pos: (lv) => ({ x: W / 2 + Math.sin((lv - 1) * 0.9) * W * 0.2, y: Ht - 140 - (lv - 1) * MAP_STEP - Math.floor((lv - 1) / 10) * WORLD_GAP }) };
  }
  /* ---------- illustrated worlds: a new landscape every 10 levels ---------- */
  const ZONES = [
    { name: 'Lollipop Meadow' },
    { name: 'Chocolate River' },
    { name: 'Frosting Mountains' },
    { name: 'Cotton Candy Sky' },
    { name: 'Ice Cream Beach' },
    { name: 'Gingerbread Winter' },
    { name: 'Donut Lake' },
    { name: 'Cookie Canyon' },
    { name: 'Crystal Caves' },
    { name: 'Jelly Jungle' },
    { name: 'Cupcake Village' },
    { name: 'Candy Cane Forest' },
    { name: 'Caramel Falls' },
    { name: 'Carnival Fairground' },
    { name: 'Macaron Mesa' },
    { name: 'Waffle Castle' },
    { name: 'Soda Springs' },
    { name: 'Honey Hive Hills' },
    { name: 'Berry Bog' },
    { name: 'Mint Mountain' },
    { name: 'Licorice Night Market' },
    { name: 'Sugar Dunes Oasis' },
    { name: 'Pudding Pools' },
    { name: 'Cinnamon Autumn Forest' },
    { name: 'Starlight Sprinkle Galaxy' },
    { name: 'Toffee Treehouse Village' },
    { name: 'Gumdrop Garden' },
    { name: 'Royal Cake Palace' },
    { name: 'Rainbow Sherbet Glacier' },
    { name: 'Sweet Kingdom Gate' },
    // worlds 31-50: the road to Vinegar's castle
    { name: 'Sour Lemon Grove' },
    { name: 'Bubblegum Swamp' },
    { name: 'Marshmallow Clouds' },
    { name: 'Popcorn Peaks' },
    { name: 'Jellybean Harbor' },
    { name: 'Peppermint Blizzard' },
    { name: 'Fudge Volcano' },
    { name: 'Taffy Twister Plains' },
    { name: 'Sprinkle Desert' },
    { name: 'Gummy Bear Woods' },
    { name: 'Candy Carnival Night' },
    { name: 'Blueberry Moon Lagoon' },
    { name: 'Maple Syrup Marsh' },
    { name: 'Rock Candy Cliffs' },
    { name: 'Churro Canyon' },
    { name: 'Strawberry Storm Fields' },
    { name: 'Licorice Ruins' },
    { name: 'Thundercloud Citadel' },
    { name: 'Sour Storm Summit' },
    { name: "Vinegar's Castle" }
  ];
  const ASPECT = { 'd-lolly': [0.6, 1], 'd-bush': [1, 0.6], 'd-cane': [0.5, 1], 'd-cloud': [2, 1], 'd-house': [1, 1], 'd-cone': [0.85, 1.15], 'd-choco': [0.8, 1], 'd-star': [1, 1] };
  const zoneOf = (lv) => ZONES[Math.floor((lv - 1) / 10) % ZONES.length];
  const hashn = (n) => Math.imul(n + 17, 2654435761) >>> 0;
  function worldHtml(g) {
    let html = '';
    const zones = Math.ceil(g.count / 10);
    const edge = (k) => (k <= 0 ? g.Ht : k >= zones ? 0 : g.pos(k * 10 + 1).y + (MAP_STEP + WORLD_GAP) / 2);   // where world k begins
    for (let k = 0; k < zones; k++) {
      const top = edge(k + 1), bottom = edge(k);
      html += '<div class="zone" style="top:' + top + 'px;height:' + (bottom - top) + 'px;background:#2a1450 center/cover no-repeat" data-bg="art/bg_' + (k % ZONES.length) + '.jpg"></div>';
    }
    for (let k = 0; k < zones; k++) {
      const z = ZONES[k % ZONES.length], cy = g.pos(k * 10 + 1).y + (MAP_STEP + WORLD_GAP) / 2;
      html += '<div class="ribbon zlazy" data-bg="art/ribbon_' + (k % 10) + '.webp" style="top:' + Math.round(cy) + 'px"><span><small>WORLD ' + (k + 1) + '</small><b>' + z.name + '</b></span></div>';
    }
    return html;
  }

  let zoneObs = null;
  function lazyZones() {   // a world's painting is fetched only when it is about to scroll into view
    const els = document.querySelectorAll('.zone[data-bg],.ribbon[data-bg]');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => { e.style.backgroundImage = 'url(' + e.dataset.bg + ')'; }); return; }
    if (zoneObs) zoneObs.disconnect();
    zoneObs = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.style.backgroundImage = 'url(' + en.target.dataset.bg + ')'; zoneObs.unobserve(en.target); } }), { rootMargin: '900px 0px' });
    els.forEach((e) => zoneObs.observe(e));
  }
  // keep every world title on one line, centred, shrinking long names until they fit the ribbon body
  function fitRibbons() {
    document.querySelectorAll('.map .ribbon').forEach((r) => {
      const b = r.querySelector('b'), sp = r.querySelector('span'); if (!b || !sp || !r.clientWidth) return;
      let fs = 17; b.style.fontSize = fs + 'px';
      while (b.scrollWidth > r.clientWidth * 0.7 && fs > 9) { fs -= 0.5; b.style.fontSize = fs + 'px'; }
    });
  }
  window.addEventListener('resize', () => { fitRibbons(); });
  function renderHome() {
    const t = today();
    $('dailyInfo').textContent = daily.last === t ? 'Solved today ✓ come back tomorrow' : dailySize() + '×' + dailySize() + ' · new board today';
    renderScore(); updateHintUi(); updateSides();
    $('streak').textContent = daily.streak > 1 ? '🔥 ' + daily.streak + ' day streak' : '';
    const map = $('map'), g = mapGeom();
    map.innerHTML = ''; map.style.height = g.Ht + 'px';
    map.insertAdjacentHTML('beforeend', worldHtml(g)); lazyZones();
    // winding trail
    let d = '';
    const pts = [];
    for (let lv = 1; lv <= g.count; lv++) pts.push(g.pos(lv));
    pts.forEach((p, i) => {
      if (i === 0) d += 'M' + p.x + ' ' + p.y;
      else { const q = pts[i - 1], my = (q.y + p.y) / 2; d += ' C' + q.x + ' ' + my + ' ' + p.x + ' ' + my + ' ' + p.x + ' ' + p.y; }
    });
    map.insertAdjacentHTML('beforeend', '<svg class="trail" viewBox="0 0 ' + g.W + ' ' + g.Ht + '"><path d="' + d + '" fill="none" stroke="rgba(40,0,90,.35)" stroke-width="22" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 14" opacity=".9"/></svg>');
    for (let lv = 1; lv <= g.count; lv++) {
      const p = g.pos(lv), tier = tierOf(lv), n = sizeFor(lv);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'node ' + (tier === 'normal' ? '' : tier) + (lv > level ? ' locked' : '') + (lv === level ? ' current' : '');
      b.dataset.lv = lv; if (lv % 10 === 0) b.classList.add('bossn', lv < level ? 'beaten' : 'waiting'); else if (lv >= ULTRA_FROM) b.classList.add('ultra');
      b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
      { const hue = WORLD_HUES[Math.floor((lv - 1) / 10) % 10]; b.style.setProperty('--nimg', 'url(art/node_w' + (Math.floor((lv - 1) / 10) % 10) + '.webp)'); if (tier === 'normal') { b.style.setProperty('--c', 'hsl(' + hue + ',78%,50%)'); b.style.setProperty('--cb', 'hsl(' + hue + ',85%,88%)'); } }   // every button of a world wears the colour of that world's ribbon
      let html = '' + lv;
      if (tier !== 'normal') html += '<span class="badge">' + (tier === 'hard' ? 'HARD' : tier === 'extreme' ? 'EXTREME' : 'VERY HARD') + '</span>';
      if (lv < level && stars[lv]) { b.classList.add('hasst'); html += '<span class="st">'; for (let i = 1; i <= 3; i++) html += starSvg(i <= stars[lv]); html += '</span>'; }
      b.innerHTML = html;
      b.onclick = () => { S.unlock(); S.tap(); openPrelevel(lv); };
      map.appendChild(b);
      if (lv === (mascotAt || level)) map.insertAdjacentHTML('beforeend', '<div class="mascot" style="left:' + p.x + 'px;top:' + (p.y - 30) + 'px"><svg><use href="#gumi"/></svg><svg class="blink"><use href="#gumiblink"/></svg></div>');
    }
    fitRibbons(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitRibbons);
  }
  function scrollToLevel(lv) {
    const g = mapGeom(), map = $('map');
    const y = map.getBoundingClientRect().top + window.scrollY + g.pos(Math.min(lv, g.count)).y;
    window.scrollTo(0, Math.max(0, y - window.innerHeight * 0.55));
  }
  let pendingHop = null;   // set when a win moves you on, played the next time the map is shown
  let mascotAt = 0;   // while set, the bear is drawn on this level instead of the current one
  async function hopTo(from, to) {
    // our bear jumps from the level you just passed to the next one and stands there
    const g = mapGeom(), a = g.pos(from), b = g.pos(to), map = $('map'), still = map.querySelector('.mascot');
    if (still) still.style.visibility = 'hidden';
    const h = document.createElement('div'); h.className = 'hopper gumi';
    h.style.left = a.x + 'px'; h.style.top = (a.y - 30) + 'px';
    h.innerHTML = '<img class="hg" src="' + look.stand + '" alt="" draggable="false"><img class="ha" src="' + look.air + '" alt="" draggable="false">';
    map.appendChild(h);
    const dx = b.x - a.x, dy = b.y - a.y, T = 1150;
    { const fn = map.querySelector('.node[data-lv="' + from + '"]'), sts = fn ? fn.querySelectorAll('.st img.star:not(.off)') : [];
      if (sts.length) { fn.classList.add('fresh'); sts.forEach((x, n) => setTimeout(() => { S.stamp(n); buzz(8); }, 120 + n * 170)); await sleep(240 + sts.length * 170); } }
    S.hop();
    // natural jump: crouch (anticipation), spring up, a true parabola through the air, squash on landing, a small rebound, settle.
    // The camera pans with the bear, a shadow stays on the ground and shrinks while he is up, and dust puffs at take-off and landing.
    const out = 'cubic-bezier(.23,1,.32,1)', HGT = Math.max(84, Math.min(130, Math.hypot(dx, dy) * 0.9)), A0 = 0.16, A1 = 0.8;
    const kf = [{ transform: 'translate(0,0) scale(1,1)', offset: 0, easing: out }, { transform: 'translate(0,0) scale(1.14,.8)', offset: A0 - 0.03, easing: out }];
    const tilt = Math.max(-12, Math.min(12, dx * 0.12));
    for (let n = 0; n <= 10; n++) {
      const u = n / 10, x = dx * u, y = dy * u - HGT * 4 * u * (1 - u), st = u < 0.2 ? 1 + (0.2 - u) * 0.9 : u > 0.85 ? 1 + (u - 0.85) * 0.6 : 1;
      kf.push({ transform: 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + (2 - st).toFixed(3) + ',' + st.toFixed(3) + ') rotate(' + (tilt * (1 - 2 * u)).toFixed(1) + 'deg)', offset: A0 + (A1 - A0) * u, easing: 'linear' });
    }
    kf.push({ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1.2,.76)', offset: A1 + 0.05, easing: out });
    kf.push({ transform: 'translate(' + dx + 'px,' + (dy - 9) + 'px) scale(.95,1.07)', offset: A1 + 0.12, easing: 'ease-in' });
    kf.push({ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1.06,.94)', offset: A1 + 0.17, easing: out });
    kf.push({ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1,1)', offset: 1 });
    const anim = h.animate(kf, { duration: T, fill: 'forwards' });
    h.querySelector('.ha').animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: A0 }, { opacity: 1, offset: A0 + 0.03 }, { opacity: 1, offset: A1 - 0.02 }, { opacity: 0, offset: A1 + 0.01 }, { opacity: 0, offset: 1 }], { duration: T, fill: 'forwards' });
    h.querySelector('.hg').animate([{ opacity: 1, offset: 0 }, { opacity: 1, offset: A0 }, { opacity: 0, offset: A0 + 0.03 }, { opacity: 0, offset: A1 - 0.02 }, { opacity: 1, offset: A1 + 0.01 }, { opacity: 1, offset: 1 }], { duration: T, fill: 'forwards' });
    const sh = document.createElement('i'); sh.className = 'hopshadow'; sh.style.left = a.x + 'px'; sh.style.top = (a.y - 22) + 'px'; map.insertBefore(sh, h);
    sh.animate([{ transform: 'translate(-50%,0) scale(1)', opacity: 0.5, offset: 0 }, { transform: 'translate(-50%,0) scale(1.1)', opacity: 0.52, offset: A0 }, { transform: 'translate(calc(-50% + ' + dx / 2 + 'px),' + dy / 2 + 'px) scale(.55)', opacity: 0.3, offset: (A0 + A1) / 2 },
      { transform: 'translate(calc(-50% + ' + dx + 'px),' + dy + 'px) scale(1.15)', opacity: 0.4, offset: A1 + 0.04 }, { transform: 'translate(calc(-50% + ' + dx + 'px),' + dy + 'px) scale(1)', opacity: 0.38, offset: 1 }], { duration: T, fill: 'forwards' });
    const dust = (x, y) => { for (let n = 0; n < 6; n++) { const d = document.createElement('i'); d.className = 'hopdust'; d.style.left = x + 'px'; d.style.top = (y - 18) + 'px'; map.appendChild(d); const ax = (n < 3 ? -1 : 1) * (10 + Math.random() * 24), ay = -4 - Math.random() * 12;
      const q = d.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0.85 }, { transform: 'translate(calc(-50% + ' + ax + 'px),calc(-50% + ' + ay + 'px)) scale(1.5)', opacity: 0 }], { duration: 420 + Math.random() * 160, easing: out, fill: 'both' }); q.onfinish = () => d.remove(); } };
    setTimeout(() => dust(a.x, a.y), T * A0); setTimeout(() => { dust(b.x, b.y); buzz(12); }, T * (A1 + 0.02));
    { // the camera pans with the bear
      const mapTop = map.getBoundingClientRect().top + window.scrollY, y0 = window.scrollY, y1 = Math.max(0, mapTop + b.y - window.innerHeight * 0.55), t0 = performance.now();
      const pan = (now) => { const u = Math.min(1, (now - t0) / T), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; window.scrollTo(0, y0 + (y1 - y0) * e); if (u < 1) requestAnimationFrame(pan); };
      if (Math.abs(y1 - y0) > 2) requestAnimationFrame(pan);
    }
    await anim.finished.catch(() => {});
    S.candy((to - 1) % 10, 3); buzz(15);
    const node = map.querySelector('.node[data-lv="' + to + '"]');
    if (node) {
      node.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 400 });
      const ring = document.createElement('i'); ring.className = 'unlockring'; ring.style.left = b.x + 'px'; ring.style.top = b.y + 'px'; map.appendChild(ring); setTimeout(() => ring.remove(), 900); S.unlock2();
    }
    // the resting bear now stands at the NEW level (it was drawn at the old one while the hop played)
    if (still) { still.style.left = b.x + 'px'; still.style.top = (b.y - 30) + 'px'; still.style.visibility = ''; }
    else map.insertAdjacentHTML('beforeend', '<div class="mascot" style="left:' + b.x + 'px;top:' + (b.y - 30) + 'px"><svg><use href="#gumi"/></svg><svg class="blink"><use href="#gumiblink"/></svg></div>');
    h.remove(); { const hs = map.querySelector('.hopshadow'); if (hs) hs.remove(); }
    mascotAt = 0; await sleep(260);
  }

  /* ---------- boards ---------- */
  // every Hard / Very Hard / Extreme level (and the mixed-in hard 9x9 / 8x8 boards) takes its own board from the pool: no level repeats an earlier one
  const POOL_KEY = (lv) => (lv >= ULTRA_FROM ? 'ultra' : lv % 50 === 0 ? 'extreme' : lv % 10 === 0 ? 'veryhard' : lv % 5 === 0 || varietySize(lv) ? 'hard' : null);
  const POOL_IDX = (() => { const c = {}, o = {}; for (let lv = 1; lv <= LAST_LEVEL; lv++) { const k = POOL_KEY(lv); if (!k) continue; const id = k + sizeFor(lv); o[lv] = c[id] || 0; c[id] = o[lv] + 1; } return o; })();
  function boardFor(lv) {
    const n = sizeFor(lv), key = POOL_KEY(lv);
    if (key) {
      const pool = (SEEDS[key] || {})[n];
      if (pool && pool.length) return E.generate(n, pool[POOL_IDX[lv] % pool.length]);
    }
    // normal levels: skip boards that would need guessing
    let b = null;
    for (let k = 0, tries = n >= 9 ? 2 : 6; k < tries; k++) {
      b = E.generate(n, n * 100000 + lv * 7919 + k * 13);
      if (H.rate(n, b.regions, b.solution).max <= 2) break;
    }
    return b;
  }

  /* ---------- game ---------- */
  // which candy sits in which colour region is shuffled per board (stable for the same board), so a colour no longer always has the same candy
  function candyMapFor(board) {
    let h = 2166136261; const str = board.regions.map((r) => r.join('')).join('');
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0; const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    return ids;
  }
  function makeGame(board, label, meta, tier) {
    const n = board.n;
    cur = { n, regions: board.regions, solution: board.solution, state: [], history: [], hearts: MAX_HEARTS, done: false, hints: 0, label, meta, tier, maybeMode: false, foundPrev: new Set(), wrongMarks: new Set(), penalized: new Set() };
    cur.cmap = candyMapFor(board);
    updateHintUi();
    for (let y = 0; y < n; y++) cur.state.push(new Array(n).fill(0)); // 0 empty, 1 X, 2 candy, 3 ?
    $('gTitle').textContent = label;
    const t = $('tier');
    t.hidden = tier === 'normal'; t.className = 'tier ' + tier; t.textContent = tierLabel[tier] || '';
    const bd = $('board'); bd.className = 'board ' + (tier === 'normal' ? '' : tier);
    bd.style.setProperty('--n', n);
    bd.classList.toggle('n10', n >= 9); bd.parentElement.classList.toggle('n10', n >= 9); $('game').classList.toggle('n10', n >= 9);
    $('maybeBtn').setAttribute('aria-pressed', 'false');
    $('lose').hidden = true; $('win').hidden = true; $('toast').classList.remove('show');
    buildBoard(); drawHearts(); drawFound();
  }
  const worldIdx = (lv) => Math.floor((lv - 1) / 10) % ZONES.length;
  function sparkField(box, n) {
    if (!box || box.querySelector('.sparkfield')) return;
    const f = document.createElement('div'); f.className = 'sparkfield';
    for (let k = 0; k < n; k++) { const e = document.createElement('i'); e.style.cssText = '--x:' + Math.round(Math.random() * 100) + '%;--d:' + (9 + Math.random() * 11).toFixed(1) + 's;--dx:' + Math.round(Math.random() * 80 - 40) + 'px;--s:' + (3 + Math.random() * 5).toFixed(1) + 'px;animation-delay:-' + (Math.random() * 18).toFixed(1) + 's'; f.appendChild(e); }
    box.appendChild(f);
  }
  function setScene(i, tier) {
    const box = $('scene');
    const bd = $('board'); if (bd) bd.classList.toggle('blk', !!tier && tier !== 'normal');   // special levels: only the board itself is black
    if (box) {
      box.style.setProperty('--bgimg', 'url(art/bg_' + i + '.jpg)'); box.dataset.world = i;
      sparkField(box, 22);
    }
    if (M) M.world(i);
  }
  /* ---------- keep the game in progress: leaving at any moment returns to the exact same board ---------- */
  function saveGame() {
    try {
      if (!cur || cur.done || !cur.meta) { store.set('game', null); return; }
      store.set('game', { shield: !!cur.shield, double: !!cur.double, meta: cur.meta, tier: cur.tier, label: cur.label, n: cur.n, state: cur.state, hearts: cur.hearts, hints: cur.hints,
        wrong: [...cur.wrongMarks], pen: [...cur.penalized], saved: Date.now() });
    } catch (e) {}
  }
  function applySaved(g) {
    if (!g || g.n !== cur.n || !Array.isArray(g.state) || g.state.length !== cur.n) return false;
    cur.shield = !!g.shield; cur.double = !!g.double;
    cur.state = g.state.map((r) => r.slice()); cur.hearts = g.hearts; cur.hints = g.hints || 0;
    cur.wrongMarks = new Set(g.wrong || []); cur.penalized = new Set(g.pen || []);
    cur.foundPrev = new Set(); for (let y = 0; y < cur.n; y++) for (let x = 0; x < cur.n; x++) if (cur.state[y][x] === 2) cur.foundPrev.add(cur.regions[y][x]);
    drawHearts(); paint(); drawFound();
    return true;
  }
  const savedFor = (meta) => { const g = store.get('game', null); if (!g || !g.meta || g.meta.kind !== meta.kind) return null; return (meta.kind === 'level' ? g.meta.level === meta.level : g.meta.date === meta.date) ? g : null; };
  /* ---------- the card shown before a level ---------- */
  let pendingBoost = null, preSpoken = false;
  function openPrelevel(lv, after) {
    const n = sizeFor(lv), tier = tierOf(lv), best = stars[lv] || 0, resume = !!savedFor({ kind: 'level', level: lv });
    $('plTitle').textContent = 'Level ' + lv;
    const t = $('plTier'), boss = lv % 10 === 0; t.hidden = tier === 'normal' && !boss; t.className = 'pl-tier ' + (boss ? 'extreme boss' : tier); t.textContent = tierLabel[tier] || '';
    $('plBoss').hidden = !boss;
    $('plStars').innerHTML = [1, 2, 3].map((i) => '<span class="slot"><img class="star ' + (i <= best ? '' : 'off') + '" src="art/star_' + (i <= best ? 'gold' : 'grey') + '.webp" alt="" draggable="false"></span>').join('');
    $('plInfo').textContent = n + '×' + n + ' board · ' + n + ' candies to find' + (best ? '' : ' · first time!');
    $('plRow').innerHTML = '<span class="chip"><img src="art/ic_heart.webp" alt="" draggable="false"><b>' + MAX_HEARTS + '</b></span><span class="chip"><img src="art/ic_hint.webp" alt="" draggable="false"><b>' + hintsLeft + '</b></span><span class="chip"><img src="art/ic_wand.webp" alt="" draggable="false"><b>' + wands + '</b></span>';
    $('plPlay').textContent = resume ? 'Continue' : 'Play';
    const pick = { shield: false, double: false }, bx = $('plBoost');
    const drawBoost = () => { bx.innerHTML = resume ? '' : ['shield', 'double'].map((k) => '<button type="button" class="bst' + (pick[k] ? ' on' : '') + (items[k] > 0 ? '' : ' none') + '" data-k="' + k + '"><img src="art/ic_' + k + '.webp" alt="" draggable="false"><span>' + (k === 'shield' ? 'Shield' : 'x2 Points') + '</span><i>' + items[k] + '</i></button>').join('');
      bx.querySelectorAll('.bst').forEach((b) => { b.onclick = () => { const k = b.dataset.k; if (items[k] <= 0) { toast('You have none. Buy one in the shop!'); return; } pick[k] = !pick[k]; S.tap(); drawBoost(); }; }); };
    drawBoost();
    $('plPlay').onclick = () => { S.unlock(); S.tap(); if (!resume && !canPlay()) { $('prelevel').hidden = true; openLives(); return; } $('prelevel').hidden = true; preSpoken = true; pendingBoost = { shield: pick.shield && items.shield > 0, double: pick.double && items.double > 0 }; if (after) after(); else transition(() => startLevel(lv)); };
    $('prelevel').hidden = false;
  }
  function startLevel(lv) {
    setScene(worldIdx(lv), tierOf(lv));
    const b = boardFor(lv);
    makeGame(b, 'Level ' + lv, { kind: 'level', level: lv }, tierOf(lv));
    const resumed = applySaved(savedFor(cur.meta));
    if (!resumed && pendingBoost) { if (pendingBoost.shield) { items.shield--; cur.shield = true; } if (pendingBoost.double) { items.double--; cur.double = true; } saveWallet(); updateHintUi(); }
    pendingBoost = null;
    show('game');
    preSpoken = false;
    if (lv % 10 === 0 && !resumed) setTimeout(bossEnter, 1000);
    clearTimeout(mischiefT); clearTimeout(blowT); clearFog();
    if (foeKind()) blowT = setTimeout(foeBlow, 26000 + Math.random() * 14000);
    if (!resumed) {
      stealCheck(lv);
      if (foeKind() === 'minion') setTimeout(() => { if (foeKind() === 'minion' && !cur.done) bossSay('start'); }, 1300);
      if (!foeKind() && lv >= 12 && lv % 10 !== 1 && (Math.imul(lv, 2654435761) >>> 9) % 4 === 0) mischiefT = setTimeout(mischief, 22000 + Math.random() * 20000);
    }
    if (lv === 1 && (forceCoach || !store.get('seenCoach', false))) setTimeout(openTutorial, 900);
    if (lv > 1 && sizeFor(lv) === baseSize(lv) && baseSize(lv) > baseSize(lv - 1)) {
      const id = sizeFor(lv) - 1;
      $('unlockIcon').innerHTML = '<use href="#c' + id + '"/>'; $('unlockName').textContent = NAMES[id];
      const u = $('unlock'); u.hidden = true; void u.offsetWidth; u.hidden = false;
      setTimeout(() => { u.hidden = true; }, 3300);
    }
  }
  function startDaily() {
    const t = today(), n = dailySize();
    setScene(new Date().getDate() % ZONES.length, 'normal');
    makeGame(E.generate(n, hash('candoku-' + t)), 'Daily Candy', { kind: 'daily', date: t }, 'normal');
    const resumed = applySaved(savedFor(cur.meta));
    show('game');
  }
  function drawHearts() {
    const h = $('hearts'); h.innerHTML = '';
    for (let i = 0; i < MAX_HEARTS; i++) h.insertAdjacentHTML('beforeend', '<img class="' + (i < cur.hearts ? '' : 'off') + '" src="art/ic_' + (i < cur.hearts ? 'heart' : 'heart_off') + '.webp" alt="" draggable="false">');
  }
  function drawFound() {
    const f = $('found'), have = new Set();
    for (let y = 0; y < cur.n; y++) for (let x = 0; x < cur.n; x++) if (cur.state[y][x] === 2) have.add(cur.regions[y][x]);
    f.innerHTML = '';
    for (let g = 0; g < cur.n; g++) {
      const on = have.has(g), isNew = on && !cur.foundPrev.has(g);
      f.insertAdjacentHTML('beforeend', '<svg class="' + (on ? 'on' : '') + (isNew ? ' new' : '') + '"><use href="#c' + cur.cmap[g] + '"/></svg>');
    }
    cur.foundPrev = have;
  }
  function buildBoard() {
    const n = cur.n, el = $('board'); el.innerHTML = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'cell';
      c.style.setProperty('--c', COLORS[cur.regions[y][x]]);
      c.style.setProperty('--d', Math.min(0.5, (y * n + x) * 0.012) + 's');
      c.setAttribute('aria-label', 'Row ' + (y + 1) + ' column ' + (x + 1));
      c.dataset.y = y; c.dataset.x = x;
      c.onclick = (e) => { if (e.detail === 0) tap(y, x, false); };   // keyboard only; touch and mouse go through the board handlers
      c.oncontextmenu = (e) => e.preventDefault();
      el.appendChild(c);
    }
    attachDrag(el);
    paint();
  }

  /* Drag across squares to mark X's. Start on an empty square to add X's, start on an X to wipe X's.
     A plain tap or a long press behaves as before. Candies are never touched by a drag. */
  let drag = null, lastDragSound = 0;
  function cellAt(px, py) {
    const t = document.elementFromPoint(px, py), c = t && t.closest ? t.closest('.cell') : null;
    return c && $('board').contains(c) ? c : null;
  }
  function dragApply(c) {
    if (!c) return false;
    const y = +c.dataset.y, x = +c.dataset.x, s = cur.state[y][x];
    let ns = s;
    if (drag.mode === 'add' && (s === 0 || s === 3)) ns = 1;
    else if (drag.mode === 'remove' && s === 1) ns = 0;
    if (ns === s) return false;
    if (!drag.snap) { snapshot(); drag.snap = true; }
    cur.state[y][x] = ns; cur.wrongMarks.delete(y + ',' + x); buzz(9);
    const now = performance.now();
    if (now - lastDragSound > 55) { lastDragSound = now; if (ns === 1) S.x(); else S.tap(); }
    return true;
  }
  let lastTap = null;
  function attachDrag(board) {
    board.onpointerdown = (e) => {
      if (cur.done) return;
      const c = cellAt(e.clientX, e.clientY);       // by finger position, not by event target
      if (!c) return;
      const y = +c.dataset.y, x = +c.dataset.x;
      drag = { y, x, start: c, mode: cur.state[y][x] === 1 ? 'remove' : 'add', moved: false, long: false, snap: false, px: e.clientX, py: e.clientY };
      try { board.setPointerCapture(e.pointerId); } catch (_) {}
      if (!cur.maybeMode) drag.timer = setTimeout(() => { if (drag && !drag.moved) { drag.long = true; buzz(10); tap(y, x, true); } }, 420);
      e.preventDefault();
    };
    board.onpointermove = (e) => {
      if (!drag || cur.maybeMode) return;
      const here = cellAt(e.clientX, e.clientY);
      if (!drag.moved) {
        if (!here || here === drag.start) return;     // still on the first square: not a drag yet
        drag.moved = true; clearTimeout(drag.timer);
        dragApply(drag.start);
      }
      // walk along the finger path so fast swipes skip no square
      const dx = e.clientX - drag.px, dy = e.clientY - drag.py, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
      let changed = false;
      for (let i = 1; i <= steps; i++) changed = dragApply(cellAt(drag.px + (dx * i) / steps, drag.py + (dy * i) / steps)) || changed;
      drag.px = e.clientX; drag.py = e.clientY;
      if (changed) paint();
    };
    const end = (e) => {
      if (!drag) return;
      clearTimeout(drag.timer);
      const d = drag; drag = null;
      if (e.type === 'pointerup' && !d.moved && !d.long) {
        const now = performance.now();
        if (lastTap && lastTap.y === d.y && lastTap.x === d.x && now - lastTap.t < 330 && cur.history.length) {
          cur.state = cur.history.pop(); lastTap = null;     // undo the first tap, then place the candy
          tap(d.y, d.x, false, true);
        } else { lastTap = { y: d.y, x: d.x, t: now }; tap(d.y, d.x, false); }
      }
      else if (d.moved) paint();
    };
    board.onpointerup = end; board.onpointercancel = end;
  }
  const cellEl = (y, x) => $('board').children[y * cur.n + x];

  // squares already ruled out by placed candies: same row, column, color, or touching
  function blocked() {
    const n = cur.n, b = new Set();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (cur.state[y][x] !== 2) continue;
      const g = cur.regions[y][x];
      for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
        if (yy === y && xx === x) continue;
        if (yy === y || xx === x || cur.regions[yy][xx] === g || (Math.abs(yy - y) <= 1 && Math.abs(xx - x) <= 1)) b.add(yy + ',' + xx);
      }
    }
    return b;
  }
  function placedCount() { let c = 0; for (const r of cur.state) for (const v of r) if (v === 2) c++; return c; }
  /* ---------- Vinegar: the storm king waits on every 10th level ---------- */
  const foeKind = () => (!(cur && cur.meta && cur.meta.kind === 'level') ? null : cur.meta.level % 10 === 0 ? 'boss' : cur.meta.level % 5 === 0 && cur.meta.level < ULTRA_FROM ? 'minion' : null);
  const isBoss = () => foeKind() === 'boss';
  const nervous = () => !!(cur && cur.meta && cur.meta.level > 300);   // near his castle the Baron is not so sure of himself any more
  const foeImg = (k) => (foeKind() === 'minion' ? 'art/minion_' + (k === 'laugh' ? 'idle' : k) + '.webp' : 'art/boss_' + (k === 'idle' && nervous() ? 'worried' : k) + '.webp');
  // what he says: cocky in the first 30 worlds, rattled on the road to his castle
  const SAY = {
    boss: { start: ["You'll never fix my mess!", 'Sweet things make me sick!', 'This board is mine!'], miss: ['Ha! Wrong!', "Sour, isn't it?", 'Hehehe!'], hit: ['Ouch!', 'Hey! Stop that!', 'Too sweet!'], lose: ["Noooo! I'll be back!"] },
    scared: { start: ['N-not you again!', 'Stay away from my castle!', 'You just got lucky before!'], miss: ['Phew... wrong!', 'Yes! Keep missing!'], hit: ['Eek!', 'Not again!', 'Stop, please!'], lose: ['Why are you so good at this?!'] },
    minion: { start: ['Vinegar sent me!', 'Bleh!'], miss: ['Nyah nyah!'], hit: ['Ow!'], lose: ['Waaah!'] }
  };
  let sayT = null;
  function bossSay(kind) {
    const k = foeKind(); if (!k) return; const set = SAY[k === 'minion' ? 'minion' : nervous() ? 'scared' : 'boss'][kind]; if (!set) return;
    const el = $('bossSay'); el.textContent = set[Math.floor(Math.random() * set.length)]; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(sayT); sayT = setTimeout(() => el.classList.remove('on'), 2400);
  }
  let bossT = null;
  function bossFace(k, ms) {
    const im = $('bossImg'), h = $('bossHud'); im.src = foeImg(k);
    h.classList.remove('hit', 'laugh'); void h.offsetWidth; if (k === 'hit' || k === 'laugh') h.classList.add(k);
    clearTimeout(bossT); if (ms) bossT = setTimeout(() => { if (foeKind() && !cur.done) { im.src = foeImg('idle'); h.classList.remove('hit', 'laugh'); } }, ms);
  }
  function bossUpdate() {
    const h = $('bossHud'), kind = foeKind(), on = !!kind; h.hidden = !on; $('game').classList.toggle('bossfight', on); if (!on) return;
    h.classList.toggle('minion', kind === 'minion'); $('bossName').textContent = kind === 'minion' ? 'Sour Cloud' : 'Vinegar';
    let c = 0; for (let y = 0; y < cur.n; y++) if (cur.state[y][cur.solution[y]] === 2) c++;
    const hp = cur.n - c; $('bossHp').style.width = (hp / cur.n * 100) + '%'; $('bossHpN').textContent = hp + ' / ' + cur.n;
    if (cur.bossC === undefined) { h.classList.remove('defeat'); $('bossImg').src = foeImg('idle'); $('bossSay').classList.remove('on'); }
    else if (c > cur.bossC && !cur.done) { bossFace('hit', 900); S.x(); if (Math.random() < 0.6) bossSay('hit'); }
    cur.bossC = c;
  }
  function bossCard(img, text, cls) {
    document.querySelectorAll('.boss-card').forEach((e) => e.remove());
    const d = document.createElement('div'); d.className = 'boss-card ' + cls; d.innerHTML = '<i class="bc-flash"></i><img src="art/boss_' + img + '.webp" alt="" draggable="false"><b>' + text + '</b>';
    document.body.appendChild(d); setTimeout(() => d.remove(), 2700);
  }
  function bossEnter() { if (!isBoss() || cur.done || $('game').hidden) return; bossCard(nervous() ? 'worried' : 'idle', 'Vinegar blocks the way!', 'in'); S.whoosh(); buzz([40, 60, 90]); if (V) setTimeout(() => V.say('boss1', true), 250); setTimeout(() => { if (isBoss() && !cur.done) bossSay('start'); }, 2800); }
  function bossMiss() { bossFace('laugh', 1400); bossSay('miss'); const b = $('board'); b.classList.remove('zap'); void b.offsetWidth; b.classList.add('zap'); setTimeout(() => b.classList.remove('zap'), 600); }
  function bossDefeat() { clearTimeout(bossT); const h = $('bossHud'), big = isBoss(); h.classList.remove('hit', 'laugh'); $('bossImg').src = foeImg('lose'); $('bossHp').style.width = '0%'; $('bossHpN').textContent = '0 / ' + cur.n; bossSay('lose'); h.classList.add('defeat'); if (big) { bossCard('lose', 'Vinegar is defeated!', 'out'); if (V) setTimeout(() => V.say('boss2', true), 300); } }

  /* on some ordinary levels the Baron peeks in and blows a little fog over a few empty squares. It only hides them for a moment: nothing on the board changes. */
  let mischiefT = null, fogT = null;
  function clearFog() { clearTimeout(fogT); document.querySelectorAll('.bfog,.boss-peek').forEach((e) => e.remove()); }
  function mischief() {
    if (!cur || cur.done || foeKind() || $('game').hidden || document.querySelector('.overlay:not([hidden])')) return;
    const wrap = document.querySelector('#game .boardwrap'), free = [];
    for (let y = 0; y < cur.n; y++) for (let x = 0; x < cur.n; x++) if (cur.state[y][x] === 0) free.push([y, x]);
    if (!wrap || free.length < 6) return;
    const wr = wrap.getBoundingClientRect();
    for (let k = 0; k < 4 && free.length; k++) {
      const [y, x] = free.splice(Math.floor(Math.random() * free.length), 1)[0], r = cellEl(y, x).getBoundingClientRect(), f = document.createElement('i');
      f.className = 'bfog'; f.style.cssText = 'left:' + (r.left - wr.left) + 'px;top:' + (r.top - wr.top) + 'px;width:' + r.width + 'px;height:' + r.height + 'px;animation-delay:' + (k * 0.12) + 's'; wrap.appendChild(f);
    }
    const p = document.createElement('div'); p.className = 'boss-peek'; p.innerHTML = '<img src="art/boss_laugh.webp" alt="" draggable="false"><b>' + ['Hehe! A little fog for you!', 'Can you see now? Hehe!', 'Boo! Miss me?'][Math.floor(Math.random() * 3)] + '</b>'; wrap.appendChild(p);
    S.whoosh(); buzz([15, 30, 15]);
    setTimeout(() => p.remove(), 3200); fogT = setTimeout(clearFog, 8000);
  }
  let blowT = null;
  function foeBlow() {
    clearTimeout(blowT); if (!cur || cur.done || cur.blown || !foeKind() || $('game').hidden) return;
    if (document.querySelector('.overlay:not([hidden])') || document.querySelector('.boss-card')) { blowT = setTimeout(foeBlow, 5000); return; }
    const xs = []; for (let y = 0; y < cur.n; y++) for (let x = 0; x < cur.n; x++) if (cur.state[y][x] === 1) xs.push([y, x]);
    if (xs.length < 6) { blowT = setTimeout(foeBlow, 7000); return; }   // wait until there is something to blow away
    cur.blown = true; snapshot();
    const wrap = document.querySelector('#game .boardwrap'), wr = wrap.getBoundingClientRect(), n = xs.length >= 14 ? 4 : 3, hit = [];
    for (let k = 0; k < n; k++) hit.push(xs.splice(Math.floor(Math.random() * xs.length), 1)[0]);
    bossFace('laugh', 2200); const el = $('bossSay'); el.textContent = T(foeKind() === 'minion' ? 'Pfff! Bye bye, X marks!' : 'One puff... and your X marks are gone!'); el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(sayT); sayT = setTimeout(() => el.classList.remove('on'), 2400);
    S.whoosh(); buzz([20, 40, 20]);
    hit.forEach(([y, x], k) => { const r = cellEl(y, x).getBoundingClientRect(), f = document.createElement('i'); f.className = 'bfog smoke'; f.style.cssText = 'left:' + (r.left - wr.left) + 'px;top:' + (r.top - wr.top) + 'px;width:' + r.width + 'px;height:' + r.height + 'px;animation-delay:' + (k * 0.15) + 's'; wrap.appendChild(f); setTimeout(() => f.remove(), 2600 + k * 150); });
    setTimeout(() => { if (!cur || cur.done) return; hit.forEach(([y, x]) => { if (cur.state[y][x] === 1) cur.state[y][x] = 0; }); paint(); }, 700);
  }
  // at the start of a new world he has run off with that world's sticker
  let stolen = store.get('stolen', {});
  function stealCheck(lv) {
    const w = Math.floor((lv - 1) / 10); if (lv < 11 || lv % 10 !== 1 || lv !== level || lv > LAST_LEVEL || stolen[w]) return;
    stolen[w] = 1; store.set('stolen', stolen);
    setTimeout(() => { if (cur && !cur.done && !$('game').hidden) { bossCard('laugh', "Vinegar stole this world's sticker! Beat him on level " + (lv + 9) + ' to win it back!', 'in steal'); S.whoosh(); buzz([30, 40, 30]); } }, 900);
  }

  function paint() {
    const n = cur.n; setTimeout(saveGame, 0); bossUpdate();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const el = cellEl(y, x), s = cur.state[y][x];
      const wrongX = s === 1 && cur.wrongMarks.has(y + ',' + x);   // black X: only after a wrong candy attempt
      const key = s === 2 ? 'c' + cur.regions[y][x] : s === 1 ? (wrongX ? 'xw' : 'x') : s === 3 ? 'q' : '';
      el.classList.toggle('has', s === 2);
      if (el.dataset.k === key) continue;      // leave unchanged squares alone so animations don't replay
      el.dataset.k = key;
      if (s === 2) el.innerHTML = '<svg class="candy" style="--idur:' + (3 + Math.random() * 2.5).toFixed(1) + 's;--idelay:' + (0.4 + Math.random() * 1.6).toFixed(1) + 's"><use href="#c' + cur.cmap[cur.regions[y][x]] + '"/></svg>';
      else if (s === 1) el.innerHTML = '<span class="x' + (wrongX ? ' bad' : '') + '"></span>';
      else if (s === 3) el.innerHTML = '<span class="q">?</span>';
      else el.innerHTML = '';
    }
    drawFound();
  }
  function snapshot() { cur.history.push(cur.state.map((r) => r.slice())); if (cur.history.length > 200) cur.history.shift(); }

  /* ---------- effects ---------- */
  const PRAISE = ['Sweet!', 'Yummy!', 'Tasty!', 'Nice!', 'Delicious!', 'Super!', 'Great!'];
  let praiseN = 0;
  function fxLayer() { let l = $('fx'); if (!l) { l = document.createElement('div'); l.id = 'fx'; document.body.appendChild(l); } return l; }
  function burstAt(el, strong) {
    if (!el) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, L = fxLayer();
    const col = getComputedStyle(el).backgroundColor || '#fff';
    const ring = document.createElement('i'); ring.className = 'fx-ring'; ring.style.cssText = 'left:' + cx + 'px;top:' + cy + 'px;border-color:' + col; L.appendChild(ring); setTimeout(() => ring.remove(), 700);
    const cols = ['#ffffff', '#ffe14d', col, '#ff8fd0', '#7fe3ff'], n = strong ? 22 : 12;
    for (let k = 0; k < n; k++) {
      const p = document.createElement('i'), ang = (k / n) * 6.283 + Math.random() * 0.5, dist = (strong ? 70 : 46) + Math.random() * 40, sz = 5 + Math.random() * 6;
      p.className = 'fx-p'; p.style.cssText = 'left:' + cx + 'px;top:' + cy + 'px;width:' + sz + 'px;height:' + sz + 'px;background:' + cols[k % cols.length] + ';--dx:' + Math.cos(ang) * dist + 'px;--dy:' + (Math.sin(ang) * dist - 10) + 'px';
      L.appendChild(p); setTimeout(() => p.remove(), 850);
    }
  }
  function praiseWord(text, big) {
    const bd = $('board'); if (!bd) return;
    const r = bd.getBoundingClientRect(), L = fxLayer(), w = document.createElement('div');
    w.className = 'fx-word' + (big ? ' big' : ''); w.textContent = text; w.style.left = (r.left + r.width / 2) + 'px'; w.style.top = (r.top + r.height * 0.42) + 'px';
    L.appendChild(w); setTimeout(() => w.remove(), 1200);
  }
  function bearReact(kind) {
    const g = $('hearts'), t = g && g.parentElement; if (!t) return;
    t.classList.remove('react-happy', 'react-sad'); void t.offsetWidth; t.classList.add(kind === 'sad' ? 'react-sad' : 'react-happy');
  }
  function placedFx(y, x, pc) {
    const el = cellEl(y, x), last = pc === cur.n;
    burstAt(el, last); S.place(pc); bearReact('happy');
    if (last) { praiseWord('Perfect!', true); S.praise(2); }
    else if (pc === 1 || pc % 2 === 0) { praiseWord(PRAISE[praiseN++ % PRAISE.length]); S.praise(Math.floor(pc / 3)); }
  }
  function tap(y, x, maybe, candy) {
    if (cur.done) return;
    if (cur.lensArmed) { lensPeek(y, x); return; }
    S.unlock();
    const s = cur.state[y][x];
    if (maybe || cur.maybeMode) {
      if (s === 2) return;
      snapshot(); cur.state[y][x] = s === 3 ? 0 : 3; S.tap(); paint(); return;
    }
    const k = y + ',' + x;
    let ns;
    if (candy) ns = s === 2 ? 0 : 2;               // double tap: candy (or remove it)
    else if (s === 2 || s === 1) ns = 0;           // single tap on a candy or any X (black too) clears it, never a penalty
    else ns = 1;                                   // empty or ? goes to X
    if (ns === 2 && cur.solution[y] !== x) {
      // wrong candy: the square gets a black X, and the heart is lost only the first time for that square
      snapshot();
      cur.state[y][x] = 1; cur.wrongMarks.add(k);
      paint();
      bearReact('sad');
      if (cur.penalized.has(k)) { S.wrong(); buzz([20, 20]); const el = cellEl(y, x); el.classList.remove('wrong'); void el.offsetWidth; el.classList.add('wrong'); }
      else { cur.penalized.add(k); mistake(y, x); }
      return;
    }
    cur.wrongMarks.delete(k);
    snapshot();
    cur.state[y][x] = ns;
    if (ns === 2) {
      buzz(14); const pc = placedCount(); S.candy(cur.regions[y][x], pc); placedFx(y, x, pc);
      if (V) { if (pc === 1) V.first(); else if (Math.random() < 0.22) V.praise(); }
    }
    else if (ns === 1) { buzz(5); S.x(); }
    else S.tap();
    paint();
    if (solved()) win();
  }
  function mistake(y, x) {
    if (infOn()) { toast('♾️ Unlimited hearts: no heart lost!'); S.x(); buzz(20); bearReact('happy'); return; }
    if (cur.shield) { cur.shield = false; toast('🛡 The shield saved your heart!'); S.hint(); buzz([20, 20]); bearReact('happy'); saveGame(); return; }
    cur.hearts--; buzz([40, 30, 40]); S.wrong(); if (foeKind()) bossMiss();
    const el = cellEl(y, x); el.classList.remove('wrong'); void el.offsetWidth; el.classList.add('wrong');
    const h = $('hearts'); h.classList.remove('hit'); void h.offsetWidth; h.classList.add('hit');
    drawHearts(); saveGame();
    if (cur.hearts <= 0) { cur.done = true; $('lose').classList.toggle('bossw', isBoss()); saveGame(); freshScore(); score.run = 0; store.set('score', score); { const c0 = climb.step; climbLose(); cur.climbDropped = climb.step < c0; } loseLife(); setTimeout(() => { S.lose(); if (V) V.lose(); $('loseLives').textContent = infOn() ? '' : 'Lives left: ' + livesNow() + ' / ' + MAX_LIVES; $('reviveBtn').hidden = !!cur.revived; $('lose').hidden = false; }, 500); }
  }
  function solved() {
    const n = cur.n, pos = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (cur.state[y][x] === 2) pos.push([y, x]);
    if (pos.length !== n) return false;
    if (new Set(pos.map((p) => p[0])).size !== n || new Set(pos.map((p) => p[1])).size !== n || new Set(pos.map((p) => cur.regions[p[0]][p[1]])).size !== n) return false;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(pos[i][0] - pos[j][0]) <= 1 && Math.abs(pos[i][1] - pos[j][1]) <= 1) return false;
    return true;
  }
  function undo() { if (cur.done || !cur.history.length) return; S.tap(); cur.state = cur.history.pop(); paint(); }

  let toastTimer = null;
  function toast(text) {
    const t = $('toast'); if (t.parentElement !== document.body) { const gap = document.createElement('div'); gap.className = 'toast-gap'; t.parentElement.insertBefore(gap, t); document.body.appendChild(t); t.classList.add('gtoast'); } t.textContent = text; { const tl = document.querySelector('#game .tools'), r = !$('game').hidden && tl ? tl.getBoundingClientRect() : null; if (r && r.width) { t.style.bottom = 'auto'; t.style.top = Math.max(r.bottom + 8, 0) + 'px'; const hh = t.offsetHeight; if (r.bottom + 8 + hh > innerHeight - 6) t.style.top = Math.max(innerHeight - hh - 6, r.bottom + 2) + 'px'; } else { t.style.top = ''; t.style.bottom = ''; } } t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
  }
  /* ---------- wallet: coins, hints, wands, helpers ---------- */
  const MAX_LIVES_FALLBACK = 5;
  let infUntil = store.get('infUntil', 0);
  const infOn = () => Date.now() < infUntil;
  const fmtMS = (ms) => { const t = Math.ceil(ms / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  function infTick() {
    const on = infOn(), e = $('heartN'); document.body.classList.toggle('inf-on', on);
    if (e) e.textContent = on ? '∞ ' + fmtMS(infUntil - Date.now()) : (typeof livesNow === 'function' ? livesNow() : MAX_LIVES_FALLBACK);
    if (typeof renderLives === 'function' && $('lives') && !$('lives').hidden) renderLives();
    const g = $('infTag'); if (g) { g.hidden = !on; if (on) g.textContent = '∞ ' + fmtMS(infUntil - Date.now()); }
  }
  setInterval(infTick, 1000);
  function give(p, noHold) { if (p.inf) { infUntil = Math.max(Date.now(), infUntil) + p.inf * 60000; store.set('infUntil', infUntil); setTimeout(infTick, 0); } coins += p.coins || 0; if (p.coins && !noHold) { coinHold += p.coins; } hintsLeft += p.hints || 0; wands += p.wands || 0; ['shield', 'double', 'sweeper', 'lens'].forEach((k) => { items[k] += p[k] || 0; }); saveWallet(); updateHintUi(); }
  const coinSvg = '<img class="ico" src="art/ic_coin.webp" alt="" draggable="false">';
  /* coins you win fly into the main wallet (the top chip, or a floating bank on the game screen) and the counter ticks up as each lands */
  let coinHold = 0, bankT = 0;
  // one prize object flies the way it does in the big games: it pops out of its source, hangs for a beat,
  // then accelerates along a curved path leaving sparkles behind, and lands with a flash.
  function flyThing(o) {
    return new Promise((done) => {
      const L = fxLayer(), p = document.createElement('img'); p.src = o.src; p.className = 'fx-coin'; p.draggable = false;
      const sz = o.size || 40; p.style.cssText = 'left:' + o.sx + 'px;top:' + o.sy + 'px;width:' + sz + 'px;height:' + sz + 'px;opacity:0'; L.appendChild(p);
      const hx = o.hx || 0, hy = o.hy || 0;                       // where it hangs, relative to the source
      const ex = o.tx - o.sx, ey = o.ty - o.sy;                   // the target, relative to the source
      const side = (ex - hx) >= 0 ? 1 : -1, len = Math.hypot(ex - hx, ey - hy);
      const cx = (hx + ex) / 2 - side * Math.min(110, len * 0.32) * (o.bow || 1), cy = (hy + ey) / 2 + Math.min(60, len * 0.12);   // control point: swing out sideways and dip a little first
      const POP = 0.2, HANG = 0.34, N = 12, kf = [], T = o.dur || 760;
      const tf = (x, y, sc, rot) => 'translate(calc(-50% + ' + x.toFixed(1) + 'px),calc(-50% + ' + y.toFixed(1) + 'px)) scale(' + sc.toFixed(3) + ') rotate(' + rot.toFixed(0) + 'deg)';
      kf.push({ transform: tf(0, 0, 0.3, -30), opacity: 0, offset: 0, easing: 'cubic-bezier(.23,1,.32,1)' });
      kf.push({ transform: tf(hx, hy - 6, 1.25, 0), opacity: 1, offset: POP * 0.75, easing: 'ease-in-out' });
      kf.push({ transform: tf(hx, hy, 1, 0), opacity: 1, offset: POP, easing: 'ease-in-out' });
      kf.push({ transform: tf(hx, hy + 4, 1.04, 0), opacity: 1, offset: HANG, easing: 'linear' });
      const pts = [];
      for (let n = 1; n <= N; n++) {
        const u = n / N, e = u * u * (0.55 + 0.45 * u);           // ease-in: slow start, fast finish
        const x = (1 - e) * (1 - e) * hx + 2 * (1 - e) * e * cx + e * e * ex, y = (1 - e) * (1 - e) * (hy + 4) + 2 * (1 - e) * e * cy + e * e * ey;
        pts.push([x, y, u]); kf.push({ transform: tf(x, y, 1.04 - 0.5 * e, 220 * e), opacity: 1, offset: HANG + (1 - HANG) * u, easing: 'linear' });
      }
      const an = p.animate(kf, { duration: T, delay: o.delay || 0, fill: 'both' });
      // sparkle trail: little stars left behind along the path
      if (!o.noTrail) pts.forEach((q, n) => {
        if (n % 2 || n >= N - 1) return;
        const sp = document.createElement('i'); sp.className = 'fx-trail'; sp.style.left = (o.sx + q[0]) + 'px'; sp.style.top = (o.sy + q[1]) + 'px'; L.appendChild(sp);
        const a2 = sp.animate([{ transform: 'translate(-50%,-50%) scale(1.1)', opacity: 0.95 }, { transform: 'translate(-50%,calc(-50% + 10px)) scale(.1)', opacity: 0 }], { duration: 380, delay: (o.delay || 0) + T * (HANG + (1 - HANG) * q[2]) + 20, easing: 'ease-out', fill: 'both' });
        a2.onfinish = () => sp.remove();
      });
      an.onfinish = () => {
        p.remove();
        const fl = document.createElement('i'); fl.className = 'fx-flash'; fl.style.left = o.tx + 'px'; fl.style.top = o.ty + 'px'; L.appendChild(fl); setTimeout(() => fl.remove(), 420);
        done();
      };
    });
  }
  function plusText(x, y, text) {
    const w = document.createElement('b'); w.className = 'fx-plus'; w.textContent = text; w.style.left = x + 'px'; w.style.top = y + 'px'; fxLayer().appendChild(w); setTimeout(() => w.remove(), 1000);
  }
  function flyCoins(fromEl, amount, delay, held) {
    if (!amount || amount <= 0) return;
    if (!held) { coinHold += amount; updateHintUi(); }
    const wal = $('walletCoins'), home = !!wal && wal.getBoundingClientRect().width > 0;
    const settle = () => { coinHold = Math.max(0, coinHold - amount); updateHintUi(); };
    if (!fromEl || !fromEl.getBoundingClientRect) { settle(); return; }
    const a = fromEl.getBoundingClientRect();   // measured now, so it still works if the card is closed this very moment
    setTimeout(() => {
      if (!a.width) { settle(); return; }
      const sx = a.left + a.width / 2, sy = a.top + a.height / 2;
      const t = home ? wal.getBoundingClientRect() : { left: innerWidth * 0.3, top: 6, width: 40, height: 30 }, tx = t.left + (home ? 19 : t.width / 2), ty = t.top + t.height / 2;
      const n = amount >= 40 ? 6 : amount >= 12 ? 5 : amount >= 5 ? 4 : Math.max(1, Math.min(3, amount)); let left = amount, done = 0;
      for (let k = 0; k < n; k++) {
        const ang = -Math.PI / 2 + (k - (n - 1) / 2) * 0.62 + (Math.random() - 0.5) * 0.25, rad = n === 1 ? 0 : 38 + Math.random() * 20;
        flyThing({ src: 'art/ic_coin.webp', size: 40, sx, sy, tx, ty, hx: Math.cos(ang) * rad, hy: Math.sin(ang) * rad * 0.8, delay: k * 55, dur: 700, bow: 0.7 + Math.random() * 0.6 }).then(() => {
          done++; const part = done === n ? left : Math.round(amount / n); left -= part; coinHold = Math.max(0, coinHold - part); updateHintUi();
          if (home) { wal.classList.remove('bump'); void wal.offsetWidth; wal.classList.add('bump'); }
          S.ui('coin'); buzz(8);
          if (done === n) plusText(tx + 14, ty + 30, '+' + amount);
        });
      }
    }, delay || 0);
  }
  if (location.search.includes('dbg')) setTimeout(() => {   // test hook: ?dbg=1&auto=hop|coins runs one animation by itself
    const m = location.search.match(/auto=(\w+)/); if (!m) return;
    document.querySelectorAll('.overlay,#intro').forEach((o) => { o.hidden = true; }); const it = $('intro'); if (it) it.style.display = 'none';
    if (m[1] === 'hop') window.CandokuDebug.hop(3, 4); else if (m[1] === 'coins') { show('home'); window.scrollTo(0, 0); window.CandokuDebug.flyCoins(40); }
    const at = location.search.match(/at=([\d.]+)/); if (at) setTimeout(() => document.getAnimations().forEach((x) => { const e = x.effect && x.effect.target; if (e && e.closest && e.closest('.hopper,.hopshadow,#fx')) { x.pause(); x.currentTime = +at[1]; } }), 80);
  }, 1500);
  if (location.search.includes('dbg')) window.CandokuDebug = { hop: (f, t) => { mascotAt = f; renderHome(); show('home'); scrollToLevel(f); return hopTo(f, t); }, flyCoins: (n) => { coins += n; saveWallet(); flyCoins([...document.querySelectorAll('.mascot,#board')].find((e) => e.getBoundingClientRect().width) || document.body, n, 0); } , fail: () => { let k = 9; while (cur && !cur.done && k--) mistake(0, 0); }, solve: () => { const n = cur.n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = cur.solution[y]; cur.state[y][x] = (Array.isArray(v) ? v[x] : v === x) ? 2 : 0; } paint(); if (solved()) win(); return solved(); }, state: () => ({ lives: livesNow(), next: nextLifeIn(), coins, level, hearts: cur && cur.hearts, done: cur && cur.done }), party: () => candyParty(), mischief: () => mischief(), blow: () => foeBlow(), ending: () => showEnding(), storm: (n) => { storm = { start: Date.now(), hits: n || 0, cl: [] }; store.set('storm', storm); }, bossEnter: () => bossEnter(), miss: () => mistake(0, 0), setLives: (n) => { lives.n = n; lives.t = Date.now(); store.set('lives', lives); } };
  function saveWallet() { store.set('coins', coins); store.set('wands', wands); store.set('hints', hintsLeft); store.set('items', items); }
  function updateHintUi() {
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set('heartN', infOn() ? '∞ ' + fmtMS(infUntil - Date.now()) : (typeof livesNow === 'function' ? livesNow() : 5)); set('hintBadge', hintsLeft); set('shieldN', items.shield || 0); set('wandBadge', wands); set('coinN', coins - coinHold); set('bankN', coins - coinHold); set('hintN', hintsLeft); set('wandN', wands);
    $('hintBtn').classList.toggle('empty', hintsLeft <= 0); $('wandBtn').classList.toggle('empty', wands <= 0);
    set('sweepBtnBadge', items.sweeper); set('lensBtnBadge', items.lens); $('sweepBtn').classList.toggle('empty', items.sweeper <= 0); $('lensBtn').classList.toggle('empty', items.lens <= 0);
  }
  const ITEMS = {
    hint: { name: 'Hint', icon: 'hint', price: 30,
      desc: 'A hint finds a square where an X surely belongs and marks it for you, and tells you why. It places a candy only when that is the last choice left.',
      count: () => hintsLeft, add: (n) => { hintsLeft += n; }, run: () => hint(),
      earn: () => { const t = HINT_EVERY - (cleared % HINT_EVERY); return 'You win 1 free hint for every ' + HINT_EVERY + ' levels you pass (' + t + ' more to go), and in the Daily Bonus.'; } },
    wand: { name: 'Magic Wand', icon: 'wand', price: 60,
      desc: 'The wand puts one correct candy on the board for you, with no risk. Use it when you are really stuck.',
      count: () => wands, add: (n) => { wands += n; }, run: () => useWand(),
      earn: () => { const t = WAND_EVERY - (cleared % WAND_EVERY); return 'You win a free wand every ' + WAND_EVERY + ' levels you pass (' + t + ' more to go), in the Daily Bonus, or buy one with coins.'; } }
  };
  ITEMS.shield = { name: 'Heart Shield', icon: 'shield', price: 45, count: () => items.shield, add: (n) => { items.shield += n; },
    desc: 'Pick it before a level starts. The first mistake of that level will not cost you a heart.', run: () => toast('Pick the shield on the screen before a level starts.'),
    earn: () => 'Won in the Daily Bonus, the lucky wheel, chests and boss levels, or buy one with coins.' };
  ITEMS.double = { name: 'Double Points', icon: 'double', price: 50, count: () => items.double, add: (n) => { items.double += n; },
    desc: 'Pick it before a level starts. That level gives you double points for the daily ranking.', run: () => toast('Pick the x2 on the screen before a level starts.'),
    earn: () => 'Won in the lucky wheel and chests, or buy one with coins.' };
  ITEMS.sweeper = { name: 'Sweeper', icon: 'sweeper', price: 40, count: () => items.sweeper, add: (n) => { items.sweeper += n; }, run: () => useSweeper(),
    desc: 'The sweeper marks an X on every square that cannot hold a candy because of the candies you already placed: same row, same column, same color and the squares around them.',
    earn: () => 'Won in the Daily Bonus, quests and chests, or buy one with coins.' };
  ITEMS.lens = { name: 'Magnifier', icon: 'lens', price: 35, count: () => items.lens, add: (n) => { items.lens += n; }, run: () => armLens(),
    desc: 'Tap the magnifier, then tap any square. It tells you the truth: a candy goes there, or it gets an X.',
    earn: () => 'Won in the Daily Bonus, the lucky wheel and boss levels, or buy one with coins.' };
  let itemKind = 'hint';
  function openItemInfo(kind) {
    if (!cur || cur.done) return;
    S.unlock(); S.tap(); itemKind = kind;
    const it = ITEMS[kind], n = it.count();
    $('itemIcon').src = 'art/ic_' + it.icon + '.webp';
    $('hintLeft').textContent = n; $('itemTitle').textContent = it.name; $('itemDesc').textContent = it.desc; $('hintEarn').textContent = it.earn();
    const b = $('hintUse');
    if (n > 0) { b.textContent = 'Use 1 ' + it.name.toLowerCase(); b.disabled = false; }
    else if (coins >= it.price) { b.innerHTML = 'Buy for ' + it.price + ' ' + coinSvg; b.disabled = false; }
    else { b.innerHTML = 'Need ' + it.price + ' ' + coinSvg; b.disabled = true; }
    $('hintInfo').hidden = false;
  }
  function onItemButton() {
    const it = ITEMS[itemKind];
    if (it.count() > 0) { $('hintInfo').hidden = true; it.run(); }
    else if (coins >= it.price) { coins -= it.price; it.add(1); saveWallet(); updateHintUi(); S.ui('buy', 1, 1); S.ui('coin', 1, 0.9); openItemInfo(itemKind); }
  }
  // a helper just changed the board: the rest of the board dims for a moment and only the squares it touched stay lit and pulse
  let spotT = null;
  function spotlight(cells, ms) {
    const b = $('board'); if (!b || !cells || !cells.length) return;
    b.querySelectorAll('.cell.lit').forEach((e) => e.classList.remove('lit'));
    cells.forEach(([y, x]) => { const el = cellEl(y, x); if (el) el.classList.add('lit'); });
    b.classList.add('spot'); clearTimeout(spotT);
    spotT = setTimeout(() => { b.classList.remove('spot'); b.querySelectorAll('.cell.lit').forEach((e) => e.classList.remove('lit')); }, ms || 2600);
  }
  function hint() {
    if (!cur || cur.done || hintsLeft <= 0) return;
    S.unlock();
    const h = H.next(cur.n, cur.regions, cur.state, cur.solution);
    if (!h) { toast("Nothing left to hint. You're almost there!"); return; }   // nothing is spent
    hintsLeft--; saveWallet(); updateHintUi();
    snapshot(); cur.hints++;
    for (const [y, x] of h.cells) { cur.state[y][x] = h.type === 'candy' ? 2 : 1; cur.wrongMarks.delete(y + ',' + x); }
    paint();
    for (const [y, x] of h.cells) { const el = cellEl(y, x); el.classList.remove('hinted'); void el.offsetWidth; el.classList.add('hinted'); }
    spotlight(h.cells, 3000); toast(h.text); buzz(15);
    if (h.type === 'candy') { const [y, x] = h.cells[0]; S.candy(cur.regions[y][x], placedCount()); placedFx(y, x, placedCount()); } else S.hint();
    if (solved()) win();
  }
  /* ---------- sweeper and magnifier ---------- */
  function useSweeper() {
    if (!cur || cur.done || items.sweeper <= 0) return;
    const n = cur.n, mark = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (cur.state[y][x] === 2) {
      const reg = cur.regions[y][x];
      for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
        if (cur.state[yy][xx] !== 0 && cur.state[yy][xx] !== 3) continue;
        if (yy === y || xx === x || cur.regions[yy][xx] === reg || (Math.abs(yy - y) <= 1 && Math.abs(xx - x) <= 1)) mark.push([yy, xx]);
      }
    }
    if (!mark.length) { toast('Place a candy first, then sweep!'); return; }   // nothing is spent
    items.sweeper--; saveWallet(); updateHintUi(); snapshot();
    mark.forEach(([yy, xx], k) => { cur.state[yy][xx] = 1; cur.wrongMarks.delete(yy + ',' + xx); setTimeout(() => { const el = cellEl(yy, xx); el.classList.remove('hinted'); void el.offsetWidth; el.classList.add('hinted'); }, Math.min(k * 14, 500)); });
    paint(); spotlight(mark, 3000); buzz(18); S.hint(); S.praise(1);
  }
  function armLens() {
    if (!cur || cur.done || items.lens <= 0) return;
    cur.lensArmed = true; $('board').classList.add('lens'); toast('🔍 Tap a square to peek at the truth');
  }
  function lensPeek(y, x) {
    cur.lensArmed = false; $('board').classList.remove('lens');
    items.lens--; saveWallet(); updateHintUi(); snapshot(); const k = y + ',' + x;
    if (cur.solution[y] === x) { cur.state[y][x] = 2; cur.wrongMarks.delete(k); paint(); toast('✅ Yes! A candy goes right here'); const pc = placedCount(); S.candy(cur.regions[y][x], pc); placedFx(y, x, pc); if (solved()) win(); }
    else { cur.state[y][x] = 1; cur.wrongMarks.delete(k); paint(); toast('❌ Not here. Marked with an X'); S.x(); }
    spotlight([[y, x]], 3000); buzz(16);
  }
  function useWand() {
    if (!cur || cur.done || wands <= 0) return;
    const rows = []; for (let y = 0; y < cur.n; y++) if (cur.state[y][cur.solution[y]] !== 2) rows.push(y);
    if (!rows.length) { toast('Every candy is already placed!'); return; }   // nothing is spent
    const y = rows[Math.floor(Math.random() * rows.length)], x = cur.solution[y];
    wands--; saveWallet(); updateHintUi();
    snapshot(); cur.hints++;
    cur.state[y][x] = 2; cur.wrongMarks.delete(y + ',' + x);
    paint();
    const el = cellEl(y, x); el.classList.remove('hinted'); void el.offsetWidth; el.classList.add('hinted');
    spotlight([[y, x]], 3000); buzz(20); S.candy(cur.regions[y][x], placedCount()); placedFx(y, x, placedCount());
    if (solved()) win();
  }
  /* ---------- daily bonus: pick one of nine cards ---------- */
  const PRIZES = [
    { id: 'c10', w: 34, coins: 2 }, { id: 'c25', w: 24, coins: 4 }, { id: 'c50', w: 8, coins: 8, rare: 1 }, { id: 'c100', w: 2, coins: 15, rare: 1 },
    { id: 'h1', w: 9, hints: 1 }, { id: 'i1', w: 5, inf: 15, rare: 1 }, { id: 'w1', w: 2, wands: 1, rare: 1 },
    { id: 's1', w: 6, shield: 1 }, { id: 'k1', w: 6, sweeper: 1 }, { id: 'l1', w: 6, lens: 1 }, { id: 'd1', w: 3, double: 1, rare: 1 }
  ];
  function rollPrize(streak, onlyRare) {
    const list = PRIZES.filter((p) => !onlyRare || p.rare);
    const wt = list.map((p) => p.w * (p.rare ? 1 + Math.min(streak, 10) * 0.12 : 1));
    let r = Math.random() * wt.reduce((x, y) => x + y, 0);
    for (let i = 0; i < list.length; i++) { r -= wt[i]; if (r <= 0) return list[i]; }
    return list[0];
  }
  const PICO = { inf: 'heart', coins: 'coin', hints: 'hint', wands: 'wand', shield: 'shield', double: 'double', sweeper: 'sweeper', lens: 'lens' };
  const PNAME = { inf: 'min of unlimited hearts', coins: 'coin', hints: 'hint', wands: 'magic wand', shield: 'heart shield', double: 'double-points booster', sweeper: 'sweeper', lens: 'magnifier' };
  const prizeKeys = (p) => Object.keys(PICO).filter((k) => p[k]);
  function prizeHtml(p) {
    return prizeKeys(p).map((k) => '<img class="pico" src="art/ic_' + PICO[k] + '.webp" alt="" draggable="false"><b>+' + p[k] + (k === 'inf' ? 'm ∞' : '') + '</b>').join('');
  }
  function prizeText(p) { return prizeKeys(p).map((k) => p[k] + ' ' + PNAME[k] + (p[k] > 1 && k !== 'coins' && k !== 'inf' ? 's' : '') + (k === 'coins' && p[k] > 1 ? 's' : '')).join(' and '); }
  /* every prize pops up with a message and the narrator, one after another */
  const rewardQueue = []; let rewardOpen = false, curReward = null;
  function announce(p, title, big, html) {
    rewardQueue.push({ p, title, big, html }); if (!rewardOpen) nextReward();
  }
  function nextReward() {
    const r = rewardQueue.shift(); curReward = r; if (!r) { rewardOpen = false; return; }
    rewardOpen = true;
    $('rwTitle').textContent = r.title || 'You got a prize!';
    const kk = prizeKeys(r.p);
    $('rwItems').innerHTML = (r.html || '') + kk.map((k, n) => '<div class="rw-it" style="animation-delay:' + (0.25 + n * 0.18) + 's"><img src="art/ic_' + PICO[k] + '.webp" alt="" draggable="false"><b>' + (k === 'inf' ? '∞ ' + r.p[k] + ' min' : '+' + r.p[k]) + '</b></div>').join('');
    $('rwText').textContent = kk.length ? 'Your ' + prizeText(r.p) + ' will be added to your bag.' : (r.html ? 'Find it in My Collection (Profile).' : '');
    $('reward').hidden = false; S.win(); buzz([25, 30, 45]);
    r.flown = false; if (r.p && r.p.coins) setTimeout(() => flyReward(r), 900); setTimeout(() => flyItems(r), 1000);
    if (V) setTimeout(() => V.say(r.big ? 'bigreward' : r.p.wands ? 'wandget' : ['reward1', 'reward2', 'reward3'][Math.floor(Math.random() * 3)], true), 350);
  }
  // the coins of a prize fly up into the top-bar wallet by themselves while the card is showing
  function flyReward(r) {
    if (!r || r.flown || !r.p || !r.p.coins) return; r.flown = true;
    const ci = $('rwItems').querySelector('img[src*="ic_coin"]'); flyCoins(ci || $('rwItems'), r.p.coins, 0, true);
  }
  function giveReward(p, title, big) { give(p); announce(p, title, big); }
  function openBonus() {
    const grid = $('bonusGrid'); grid.innerHTML = ''; $('bonusClaim').hidden = true; $('bonusStreak').textContent = '';
    $('bonusMsg').textContent = 'Pick a card to get your reward!';
    let picked = false;
    for (let i = 0; i < 9; i++) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'bcard'; b.innerHTML = '<span class="front">?</span><span class="back"></span>';
      b.onclick = () => {
        if (picked) return; picked = true; S.unlock();
        const t = today(), y = new Date(); y.setDate(y.getDate() - 1);
        const yd = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
        const streak = bonus.last === yd ? bonus.streak + 1 : 1;
        const prize = rollPrize(streak, streak % 7 === 0);
        bonus = { last: t, streak }; store.set('bonus', bonus);
        give(prize);
        b.querySelector('.back').innerHTML = prizeHtml(prize); b.classList.add('open', 'mine'); S.ui('flip', 1, 1); S.win(); buzz([20, 30, 40]);
        $('bonusMsg').textContent = 'You won ' + prizeText(prize) + '!';
        $('bonusStreak').textContent = '🔥 Day ' + streak + (streak % 7 === 0 ? ' · big prize day!' : ' · come back tomorrow for more');
        // the other cards show what they hid
        [...grid.children].forEach((c, k) => { if (c === b) return; setTimeout(() => { c.querySelector('.back').innerHTML = prizeHtml(rollPrize(streak, false)); c.classList.add('open', 'dim'); S.ui('flip', 0.9 + (k % 4) * 0.08, 0.7); }, 450 + k * 90); });
        setTimeout(() => { $('bonusClaim').hidden = false; announce(prize, streak % 7 === 0 ? 'Big prize day!' : 'Daily Bonus!', streak % 7 === 0); }, 1500);
      };
      grid.appendChild(b);
    }
    S.tap(); $('bonus').hidden = false;
  }
  function maybeBonus() { if (bonus.last !== today() && $('intro').hidden && $('bonus').hidden) setTimeout(openBonus, 600); }
  /* ---------- profile ---------- */
  function openProfile() {
    S.unlock(); S.tap(); freshScore();
    const best = Math.max(score.best || 0, score.points);
    let i = 0; for (let k = 0; k < RANKS.length; k++) if (best >= RANKS[k][0]) i = k;
    const next = RANKS[i + 1];
    $('pfName').value = pname; $('pfRank').textContent = RANKS[i][1];
    $('pfBar').style.width = (next ? Math.min(100, ((best - RANKS[i][0]) / (next[0] - RANKS[i][0])) * 100) : 100) + '%';
    $('pfNext').textContent = next ? (next[0] - best) + ' pts to ' + next[1] : 'Top rank reached!';
    const totalStars = Object.values(stars).reduce((x, y) => x + (y || 0), 0);
    const rows = [
      ['Levels passed', Math.max(0, level - 1)], ['Stars', totalStars], ['Best day', best + ' pts'],
      ['Today', score.points + ' pts'], ['Daily bonus streak', bonus.streak ? bonus.streak + ' days' : '-'], ['Daily Candy streak', daily.streak ? daily.streak + ' days' : '-']
    ];
    $('pfGrid').innerHTML = rows.map((r) => '<div><b>' + r[1] + '</b><small>' + r[0] + '</small></div>').join('')
      + '<div><b>' + coinSvg + ' ' + coins + '</b><small>Coins</small></div>'
      + '<div><b>' + hintsLeft + ' · ' + wands + '</b><small>Hints · Wands</small></div>';
    $('profile').hidden = false;
  }
  function saveProfileName() {
    const v = $('pfName').value.replace(/[<>&"'`]/g, '').trim().slice(0, 16);
    if (v && v !== pname) { pname = v; store.set('pname', pname); postScore(); }
  }
  /* ---------- shop ---------- */
  function openShop() {
    S.unlock(); S.tap();
    $('shopCoins').textContent = coins; renderPacks();
    const list = $('shopList'); list.innerHTML = '';
    for (const k of ['hint', 'wand', 'shield', 'double', 'sweeper', 'lens']) {
      const it = ITEMS[k], row = document.createElement('div'); row.className = 'shoprow';
      row.innerHTML = '<img class="pico" src="art/ic_' + it.icon + '.webp" alt="" draggable="false"><span><b>' + it.name + '</b><small>you have ' + it.count() + '</small></span>';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn main buy'; b.innerHTML = it.price + ' ' + coinSvg; b.disabled = coins < it.price;
      b.onclick = () => { if (coins < it.price) return; coins -= it.price; it.add(1); saveWallet(); updateHintUi(); S.ui('buy', 1, 1); S.ui('coin', 1, 0.9); openShop(); };
      row.appendChild(b); list.appendChild(row);
    }
    $('shop').hidden = false;
  }
  function restart() { if (cur.done) return; S.tap(); snapshot(); cur.state = cur.state.map((r) => r.map(() => 0)); cur.wrongMarks.clear(); cur.foundPrev = new Set(); paint(); }

  /* ---------- win ---------- */
  function win() {
    cur.done = true; saveGame(); buzz([30, 40, 60]); S.win();
    if (foeKind()) bossDefeat();
    clearTimeout(mischiefT); clearTimeout(blowT); clearFog();
    if (V) setTimeout(() => V.win(cur.hearts), isBoss() ? 4200 : 3100);   // after the three stars have landed
    const m = cur.meta, earned = Math.max(1, cur.hearts);
    let reward = false, wandReward = false;
    freshScore();
    score.run++;
    const pt = pointsFor(cur.n, score.run); if (cur.double) { pt.gain *= 2; pt.mult = pt.mult + '×2 booster'; }
    score.points += pt.gain; score.best = Math.max(score.best || 0, score.points);
    store.set('score', score); postScore();
    const earnedCoins = (1 + (cur.hearts >= 3 ? 1 : 0)) * (rushActive() ? 2 : 1);   // coins are scarce: 1 per win, 2 without losing a heart
    coins += earnedCoins; saveWallet(); updateHintUi();
    onSolved();
    setTimeout(() => flyCoins($('winCoins'), earnedCoins, 0), 1400);
    $('winCoins').hidden = false; $('winCoins').innerHTML = '+' + earnedCoins + ' ' + coinSvg + ' coins';
    $('winGain').innerHTML = '+' + pt.gain + ' pts<small>' + '×' + pt.mult + ' in a row · ' + score.points + ' today</small>';
    if (m.kind === 'level') {
      if (!stars[m.level] || stars[m.level] < earned) { stars[m.level] = earned; store.set('stars', stars); }
      if (level === m.level) {
        level = m.level + 1; store.set('level', level); pendingHop = level > LAST_LEVEL ? null : { from: m.level, to: level };
        cleared++; store.set('cleared', cleared);                       // only a first-time pass counts toward the reward
        if (cleared % HINT_EVERY === 0) { give({ hints: 1 }); reward = true; setTimeout(() => announce({ hints: 1 }, 'Level reward!'), 3600); }
        checkUnlocks(m);
        if (cleared % WAND_EVERY === 0) { give({ wands: 1 }); wandReward = true; setTimeout(() => announce({ wands: 1 }, 'Big level reward!', true), 4200); }
      }
    } else if (m.kind === 'daily' && daily.last !== m.date) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yd = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
      daily = { last: m.date, streak: daily.last === yd ? daily.streak + 1 : 1 }; store.set('daily', daily);
    }
    let st = ''; for (let i = 1; i <= 3; i++) st += starSvg(i <= earned);
    $('winStars').innerHTML = st;
    $('winInfo').textContent = cur.n + '×' + cur.n + (cur.tier !== 'normal' ? ' ' + tierLabel[cur.tier] : '') + ' solved' + (cur.hints ? ' · ' + cur.hints + ' hint' + (cur.hints > 1 ? 's' : '') : ' · no hints');
    const wr = $('winReward');
    if (wandReward) { wr.hidden = false; wr.innerHTML = '🪄 Big reward! <b>+1 magic wand</b> for passing ' + WAND_EVERY + ' levels' + (reward ? '<br>🎁 and +1 hint' : ''); }
    else if (reward) { wr.hidden = false; wr.innerHTML = '🎁 Reward! <b>+1 hint</b> for passing ' + HINT_EVERY + ' levels · wand in ' + (WAND_EVERY - (cleared % WAND_EVERY)) + ' more'; }
    else if (m.kind === 'level') { wr.hidden = false; wr.textContent = (cleared % HINT_EVERY) + ' / ' + HINT_EVERY + ' levels to a free hint · wand in ' + (WAND_EVERY - (cleared % WAND_EVERY)) + ' more'; }
    else wr.hidden = true;
    if (m.kind === 'level' && m.level % 10 === 0) {
      const flawless = cur.hearts >= MAX_HEARTS, bp = { coins: flawless ? 10 : 5, hints: flawless ? 1 : 0, shield: flawless ? 1 : 0 };
      give(bp); setTimeout(() => announce(bp, '👑 Vinegar defeated!', true, '<div class="rw-it"><img class="rw-boss" src="art/boss_lose.webp" alt="" draggable="false"></div>'), 3600); wr.hidden = false;
      wr.innerHTML = '👑 Vinegar defeated! Prizes: ' + prizeText(bp) + (flawless ? '' : '<br><small>No hearts lost = an even bigger prize!</small>');
    }
    updateHintUi();
    $('nextBtn').textContent = m.kind === 'level' && m.level < LAST_LEVEL ? 'Next level' : 'Back to map';
    setTimeout(() => {
      $('win').hidden = false; celebrate(); candyParty();
      const els = $('winStars').querySelectorAll('img.star');
      const box = $('winStars'), card = document.querySelector('#win .card');
      const burst = (el, good) => {
        const r = el.getBoundingClientRect(), b = box.getBoundingClientRect(), cx = r.left - b.left + r.width / 2, cy = r.top - b.top + r.height / 2;
        const cols = ['#ffe14d', '#ffffff', '#ffb347', '#ff8fd0', '#7fe3ff'];
        for (let n = 0; n < (good ? 14 : 4); n++) {
          const p = document.createElement('i'), ang = Math.random() * 6.283, dist = 34 + Math.random() * 40;
          p.className = 'spark'; p.style.left = cx + 'px'; p.style.top = cy + 'px'; p.style.background = cols[n % cols.length];
          p.style.setProperty('--dx', Math.cos(ang) * dist + 'px'); p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
          box.appendChild(p); setTimeout(() => p.remove(), 800);
        }
      };
      els.forEach((el, k) => {
        const t0 = 500 + k * 640, good = k + 1 <= earned;
        setTimeout(() => { el.classList.add('show'); S.starIn(); }, t0);
        setTimeout(() => {
          S.star(k + 1, good); buzz(good ? 18 : 8); burst(el, good);
          if (card && card.animate) card.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(6px)' }, { transform: 'translateY(0)' }], { duration: 190, easing: 'ease-out' });
          if (k === 2 && earned === 3) setTimeout(() => S.fanfare(), 160);
        }, t0 + 420);
      });
    }, 450);
  }

  /* ---------- win celebration: the bear moves like a character, not a loop. Each cycle is a little different:
     he sways while cheering, crouches (anticipation), springs up, hangs for a beat in the tucked pose, falls faster than he
     rose, squashes on landing, rebounds, and sometimes adds a small second hop. Poses cross-fade instead of snapping. ---------- */
  let celebRun = 0;
  async function celebrate() {
    const run = ++celebRun, body = document.querySelector('#win .gbody'), gnd = document.querySelector('#win .g-ground'), air = document.querySelector('#win .g-air'), sh = document.querySelector('#win .gshadow');
    if (!body || !body.animate) return; const live = () => run === celebRun && !$('win').hidden;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { air.style.opacity = 0; gnd.style.opacity = 1; return; }
    const out = 'cubic-bezier(.23,1,.32,1)', inn = 'cubic-bezier(.5,0,.9,.4)', soft = 'cubic-bezier(.45,.05,.55,.95)';
    const A = (el, kf, ms, ease) => { const an = el.animate(kf, { duration: ms, easing: ease || 'linear', fill: 'forwards' }); return an.finished.catch(() => {}); };
    const tf = (y, sx, sy, r) => 'translateY(' + y + 'px) scale(' + sx + ',' + sy + ') rotate(' + (r || 0) + 'deg)';
    if (body.classList.contains('frames')) {
      // real drawn poses: cheer, crouch, take-off, peak, fall, landing. The picture changes with the motion, the way a hand-animated character does.
      const F = [...body.querySelectorAll('.gf')], show = (k) => F.forEach((im, i) => { im.style.opacity = i === k - 1 ? 1 : 0; });
      const shadowF = (s, o, ms, ease) => { if (sh) sh.animate([{}, { transform: 'scale(' + s + ')', opacity: o }], { duration: ms, easing: ease || 'linear', fill: 'forwards' }); };
      body.style.animation = 'none'; if (sh) sh.style.animation = 'none'; show(1);
      await A(body, [{ transform: tf(-60, 0.7, 0.7, 0), opacity: 0 }, { transform: tf(3, 1.06, 0.94, 0), opacity: 1, offset: 0.7 }, { transform: tf(0, 1, 1, 0), opacity: 1 }], 480, out);
      let side = 1;
      while (live()) {
        const H = 40 + Math.random() * 14, lean = (2 + Math.random() * 3) * side; side = -side;
        show(1);
        await A(body, [{ transform: tf(0, 1, 1, 0) }, { transform: tf(-3, 0.99, 1.02, lean) }, { transform: tf(0, 1.01, 0.99, -lean * 0.6) }, { transform: tf(-2, 0.99, 1.01, lean * 0.4) }, { transform: tf(0, 1, 1, 0) }], 760 + Math.random() * 380, soft); if (!live()) break;
        show(2); await A(body, [{ transform: tf(0, 0.97, 1.04, 0) }, { transform: tf(0, 1.05, 0.93, 0) }], 150, out); if (!live()) break;
        show(3); shadowF(0.6, 0.5, 300, out);
        await A(body, [{ transform: tf(0, 1.02, 0.97, 0) }, { transform: tf(-H * 0.34, 0.97, 1.05, lean * 0.3) }], 85, 'linear'); if (!live()) break;
        show(4);
        await A(body, [{ transform: tf(-H * 0.34, 0.98, 1.04, lean * 0.3) }, { transform: tf(-H, 1, 1, lean) }], 240, out); if (!live()) break;
        await A(body, [{ transform: tf(-H, 1, 1, lean) }, { transform: tf(-H - 2, 1.01, 0.99, lean * 0.5) }, { transform: tf(-H + 1, 1, 1, 0) }], 130, soft); if (!live()) break;
        show(5); shadowF(1, 1, 220, inn);
        await A(body, [{ transform: tf(-H + 1, 1, 1, 0) }, { transform: tf(-3, 0.97, 1.05, -lean * 0.3) }], 220, inn); if (!live()) break;
        show(6); buzz(10);
        await A(body, [{ transform: tf(0, 0.98, 1.03, 0) }, { transform: tf(0, 1.07, 0.92, 0) }, { transform: tf(0, 1.02, 0.98, 0) }], 170, out); if (!live()) break;
        show(1);
        await A(body, [{ transform: tf(0, 0.97, 1.04, 0) }, { transform: tf(-5, 0.99, 1.02, 0) }, { transform: tf(0, 1.02, 0.98, 0) }, { transform: tf(0, 1, 1, 0) }], 300, soft);
      }
      return;
    }
    const pose = (up) => { air.animate([{ opacity: up ? 0 : 1 }, { opacity: up ? 1 : 0 }], { duration: 90, fill: 'forwards' }); gnd.animate([{ opacity: up ? 1 : 0 }, { opacity: up ? 0 : 1 }], { duration: 90, fill: 'forwards' }); };
    const shadow = (s, o, ms, ease) => { if (sh) sh.animate([{}, { transform: 'scale(' + s + ')', opacity: o }], { duration: ms, easing: ease || 'linear', fill: 'forwards' }); };
    air.style.animation = gnd.style.animation = body.style.animation = 'none'; if (sh) sh.style.animation = 'none'; pose(false);
    await A(body, [{ transform: tf(-70, 0.6, 0.6, -20), opacity: 0 }, { transform: tf(4, 1.1, 0.9, 4), opacity: 1, offset: 0.7 }, { transform: tf(0, 1, 1, 0), opacity: 1 }], 520, out);
    let dir = 1;
    while (live()) {
      const H = 38 + Math.random() * 16, lean = (3 + Math.random() * 4) * dir; dir = -dir;
      // cheer and sway
      await A(body, [{ transform: tf(0, 1, 1, 0) }, { transform: tf(-2, 0.99, 1.02, lean * 0.8) }, { transform: tf(0, 1.01, 0.99, -lean * 0.5) }, { transform: tf(0, 1, 1, 0) }], 620 + Math.random() * 260, soft); if (!live()) break;
      // anticipation
      await A(body, [{ transform: tf(0, 1, 1, 0) }, { transform: tf(0, 1.13, 0.82, 0) }], 190, out); if (!live()) break;
      // spring up
      pose(true); shadow(0.55, 0.45, 300, out);
      await A(body, [{ transform: tf(0, 1.13, 0.82, 0) }, { transform: tf(-H * 0.3, 0.9, 1.14, lean * 0.4), offset: 0.25 }, { transform: tf(-H, 1, 1, lean) }], 300, out); if (!live()) break;
      // hang
      await A(body, [{ transform: tf(-H, 1, 1, lean) }, { transform: tf(-H - 2, 1.02, 0.99, lean * 0.6) }, { transform: tf(-H, 1, 1, 0) }], 150, soft); if (!live()) break;
      // fall
      shadow(1, 1, 250, inn); setTimeout(() => { if (live()) pose(false); }, 190);
      await A(body, [{ transform: tf(-H, 1, 1, 0) }, { transform: tf(0, 0.94, 1.1, -lean * 0.3) }], 250, inn); if (!live()) break;
      // land, rebound, settle
      buzz(10);
      await A(body, [{ transform: tf(0, 0.94, 1.1, 0) }, { transform: tf(0, 1.18, 0.78, 0) }], 90, out);
      await A(body, [{ transform: tf(0, 1.18, 0.78, 0) }, { transform: tf(-7, 0.96, 1.06, 0) }, { transform: tf(0, 1.05, 0.95, 0) }, { transform: tf(0, 1, 1, 0) }], 360, soft); if (!live()) break;
      if (Math.random() < 0.5) {   // a small extra hop, arms still up
        shadow(0.8, 0.7, 150, out);
        await A(body, [{ transform: tf(0, 1.08, 0.9, 0) }, { transform: tf(-H * 0.35, 0.97, 1.05, -lean * 0.5) }], 170, out); shadow(1, 1, 150, inn);
        await A(body, [{ transform: tf(-H * 0.35, 0.97, 1.05, -lean * 0.5) }, { transform: tf(0, 1.1, 0.88, 0) }, { transform: tf(0, 1, 1, 0) }], 240, inn);
      }
    }
  }
  /* sweets confetti: two cannons at the bottom corners fire a burst of sweets up over the win card; they spread, tumble, flutter down and it is over in a few seconds */
  const partyArt = []; let partyRun = 0;
  function candyParty() {
    const cv = $('winParty'); if (!cv || !cv.getContext) return; const run = ++partyRun;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!partyArt.length) for (let k = 1; k <= 21; k++) { const im = new Image(); im.src = 'art/sw_' + k + '.webp'; partyArt.push(im); }
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight, g = cv.getContext('2d');
    cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); cv.style.opacity = 1;
    const P = [], G = 620;
    const shoot = (left, delay) => {
      const ang = (left ? -62 : -118) + (Math.random() - 0.5) * 46, sp = H * (1.05 + Math.random() * 0.75), a = ang * Math.PI / 180;
      P.push({ x: left ? -10 : W + 10, y: H * 0.86, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sz: 30 + Math.random() * 30, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 9, flip: 2 + Math.random() * 5, fp: Math.random() * 6.28,
        sway: 10 + Math.random() * 22, sf: 1.5 + Math.random() * 2, i: (P.length * 5 + Math.floor(Math.random() * 3)) % 21, t: -delay, life: 0 });
    };
    for (let k = 0; k < 44; k++) shoot(k % 2 === 0, Math.random() * 0.35);
    for (let k = 0; k < 30; k++) shoot(k % 2 === 0, 0.55 + Math.random() * 0.45);
    let last = performance.now(), clock = 0;
    const tick = (now) => {
      if (run !== partyRun) return;
      if ($('win').hidden || !P.length || clock > 7) { g.clearRect(0, 0, W, H); return; }
      const dt = Math.min(0.033, (now - last) / 1000); last = now; clock += dt;
      g.clearRect(0, 0, W, H);
      for (let n = P.length - 1; n >= 0; n--) {
        const p = P[n]; p.t += dt; if (p.t < 0) continue; p.life += dt;
        // strong air drag: the shot slows fast, then the sweet flutters down at its own gentle speed
        const drag = Math.pow(0.16, dt); p.vx *= drag; p.vy = p.vy * drag + G * dt; if (p.vy > 240) p.vy = 240;
        p.x += p.vx * dt + Math.sin(p.fp + p.life * p.sf) * p.sway * dt * (p.vy > 0 ? 1 : 0.2); p.y += p.vy * dt; p.r += p.vr * dt; p.vr *= Math.pow(0.6, dt);
        if (p.y - p.sz > H && p.vy > 0) { P.splice(n, 1); continue; }
        const im = partyArt[p.i]; if (!im.complete || !im.naturalWidth) continue;
        const sx = Math.cos(p.fp + p.life * p.flip), fade = clock > 5.4 ? Math.max(0, 1 - (clock - 5.4) / 1.4) : 1;
        g.globalAlpha = fade; g.save(); g.translate(p.x, p.y); g.rotate(p.r); const pu = 1 + sx * 0.06; g.scale(pu, pu); g.drawImage(im, -p.sz / 2, -p.sz / 2, p.sz, p.sz); g.restore();   // solid 3D sweets spin, they do not flip like paper
      }
      g.globalAlpha = 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame((t) => { last = t; tick(t); });
  }
  function confetti() {
    const box = $('confetti'); box.innerHTML = '';
    for (let i = 0; i < 80; i++) {
      const b = document.createElement('b');
      b.style.cssText = 'left:' + Math.random() * 100 + '%;background:' + COLORS[i % COLORS.length] + ';animation-duration:' + (2.2 + Math.random() * 2.2) + 's;animation-delay:' + Math.random() * .6 + 's';
      box.appendChild(b);
    }
    setTimeout(() => { box.innerHTML = ''; }, 5200);
  }

  /* ---------- opening story ---------- */
  const STORY = [
    { text: 'In Candy Land, every sweet lived in the great Bonbox, each one in its own perfect spot.', img: 'story1', fx: 'calm' },
    { text: 'But up in the clouds lived Vinegar, the grumpy storm king. He could not stand all that sweetness!', img: 'story2p', fx: 'dark' },
    { text: 'He took a giant breath and... ACHOO! A wild candy storm blew every candy out of the Bonbox!', img: 'story3', fx: 'storm' },
    { text: 'Only Gumi can fix it! Help him put the candies back in the box: one in every color, and no two candies touching!', img: 'story4', fx: 'hero' }
  ];
  const ENDING = [
    { text: 'At the top of the storm, Gumi did not fight. He held out one sweet lollipop and said: try it, just once.', img: 'end1', fx: 'flash' },
    { text: 'Vinegar took one tiny taste... and his sour face melted into the biggest smile Candy Land had ever seen!', img: 'end2', fx: 'calm' },
    { text: 'From that day on, Vinegar was the sweetest cloud in Candy Land, and the Bonbox was full again. Thank you for playing!', img: 'end3', fx: 'hero' }
  ];
  let PANELS = STORY;
  // what moves on top of each story picture
  function storyFx(kind) {
    let h = '';
    if (kind === 'calm') for (let i = 0; i < 12; i++) h += '<i class="st-spk" style="left:' + (6 + Math.random() * 88) + '%;top:' + (8 + Math.random() * 60) + '%;animation-delay:-' + (Math.random() * 3).toFixed(2) + 's"></i>';
    if (kind === 'dark') h += '<i class="st-flash"></i><i class="st-flash b"></i>';
    if (kind === 'storm') {
      h += '<i class="st-flash"></i>';
      for (let i = 0; i < 10; i++) h += '<span class="st-gust" style="--y:' + (5 + Math.random() * 46) + '%;--s:' + (34 + Math.random() * 34) + 'px;--d:' + (1.1 + Math.random() * 1.3).toFixed(2) + 's;--w:' + (Math.random() * 30 - 15).toFixed(0) + 'vh;animation-delay:-' + (Math.random() * 2.4).toFixed(2) + 's"><svg><use href="#c' + (i % 10) + '"/></svg></span>';
      for (let i = 0; i < 7; i++) h += '<i class="st-wind" style="top:' + (8 + i * 11) + '%;animation-delay:-' + (i * 0.23).toFixed(2) + 's"></i>';
      h += '<div class="st-achoo">ACHOO!</div>';
    }
    if (kind === 'hero') h += '<i class="st-rays"></i>';
    return h;
  }
  function preloadStory() { STORY.map((p) => p.img + '.jpg').concat(['boss_idle_l.webp', 'boss_laugh_l.webp']).forEach((f) => { const im = new Image(); im.src = 'art/' + f; }); }
  let introStep = 0, rainTimer = null;
  const logoHtml = () => '<div class="logo big" aria-label="Candoku"><img src="art/logo.webp" alt="Candoku" draggable="false"></div>';
  function sceneHtml(kind) {
    if (kind === 'happy') {
      let o = ''; for (let i = 0; i < 6; i++) o += '<span class="oc" style="--a:' + i * 60 + 'deg"><svg><use href="#c' + i + '"/></svg></span>';
      return '<div class="scene"><div class="orbit">' + o + '</div><svg class="hero-gumi bounce"><use href="#gumi"/></svg></div>';
    }
    if (kind === 'sneeze') {
      let f = ''; const vec = [[-130, -90], [120, -100], [-150, 20], [140, 30], [-70, -130], [70, -125], [-100, 110], [100, 105]];
      vec.forEach((v, i) => { f += '<span class="fly" style="--x:' + v[0] + 'px;--y:' + v[1] + 'px;--r:' + (i % 2 ? 300 : -300) + 'deg;animation-delay:' + (i * 0.12) + 's"><svg><use href="#c' + i + '"/></svg></span>'; });
      return '<div class="scene">' + f + '<svg class="hero-gumi shake"><use href="#gumi"/></svg><div class="bubble">ACHOO!</div></div>';
    }
    const reg = ['AABB', 'AABB', 'CCDD', 'CCDD'], cols = { A: 0, B: 1, C: 2, D: 3 }, cand = { '0,1': 0, '1,3': 1, '2,0': 2, '3,2': 3 };
    let t = '';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const k = y + ',' + x, inner = k in cand ? '<svg><use href="#c' + cand[k] + '"/></svg>' : '<b></b>';
      t += '<span class="tile" style="--c:' + COLORS[cols[reg[y][x]]] + ';animation-delay:' + (y * 4 + x) * 0.05 + 's">' + inner + '</span>';
    }
    return '<div class="scene row"><div class="mini">' + t + '</div><svg class="hero-gumi wave"><use href="#gumi"/></svg></div>';
  }
  function startRain() {
    const box = $('introRain'); box.innerHTML = '';
    for (let i = 0; i < 16; i++) {
      const d = document.createElement('span'); d.className = 'drop';
      d.style.cssText = 'left:' + Math.random() * 100 + '%;--s:' + (28 + Math.random() * 30) + 'px;animation-duration:' + (5 + Math.random() * 5) + 's;animation-delay:-' + Math.random() * 8 + 's';
      d.innerHTML = '<svg><use href="#c' + (i % 10) + '"/></svg>'; box.appendChild(d);
    }
  }
  function renderIntro() {
    const body = $('introBody'), ctl = $('introCtl');
    if (introStep === 0) {
      body.innerHTML = '<div class="st-panel st-open"><div class="st-img" style="background-image:url(art/splash_tall.jpg)"></div></div><div class="st-splash"><img class="st-logo" src="art/logo_bonbox.webp" alt="Bonbox" draggable="false"><button id="introStart" class="play" type="button">Tap to start</button></div>';
      preloadStory();
      ctl.hidden = true;
      $('introStart').onclick = () => {
        S.unlock(); S.tap(); if (M) M.start('menu');
        if (V) V.say('Welcome to Bonbox!', true);
        setTimeout(() => { introStep = 1; renderIntro(); }, 2700);   // let the narrator finish the welcome before the story starts
        $('introStart').disabled = true;
      };
      return;
    }
    const p = PANELS[introStep - 1];
    const pic = '<div class="st-img" style="background-image:url(art/' + p.img + '.jpg)"></div>', bolt = (c) => '<svg class="st-bolt ' + c + '" viewBox="0 0 40 70"><path d="M24 0 6 38h12L10 70 36 26H22z"/></svg>';
    // the villain is his own layer over an empty sky, so he can drop in, float, laugh and throw lightning
    const stage = p.fx === 'dark' ? '<div class="st-stage">' + pic + bolt('b1') + bolt('b2') + bolt('b3') + '<div class="st-boss"><img class="bi" src="art/boss_idle_l.webp" alt="" draggable="false"><img class="bl" src="art/boss_laugh_l.webp" alt="" draggable="false"></div></div>' : pic;
    body.innerHTML = '<div class="st-panel st-' + p.fx + '">' + stage + storyFx(p.fx) + '</div><p class="st-cap">' + p.text + '</p>';
    if (p.fx === 'storm') {
      // the sneeze lands on the narrator's "ACHOO": until then the Baron only breathes in, then the storm breaks
      const panel = body.querySelector('.st-storm'), at = V && V.isEnabled() && S.isOn() ? (window.LANG === 'es' ? 2350 : 3050) : 1400, step = introStep;
      setTimeout(() => { if (introStep !== step || $('intro').hidden || !panel.isConnected) return; panel.classList.add('go'); S.whoosh(); buzz([60, 40, 120, 40, 60]); setTimeout(() => { if (introStep === step && !$('intro').hidden) S.whoosh(); }, 700); }, at);
    }
    else if (p.fx === 'dark') buzz([30, 60, 30]);
    ctl.hidden = false;
    $('introNext').textContent = introStep === PANELS.length ? (PANELS === ENDING ? 'Back to map' : "Let's play!") : 'Next';
    $('introDots').innerHTML = PANELS.map((_, i) => '<i class="' + (i === introStep - 1 ? 'on' : '') + '"></i>').join('');
    if (V) V.say(p.text, true);
  }
  function showEnding() { store.set('seenEnd', true); PANELS = ENDING; ENDING.forEach((p) => { const im = new Image(); im.src = 'art/' + p.img + '.jpg'; }); introStep = 1; $('intro').hidden = false; document.body.classList.add('in-game'); $('introRain').innerHTML = ''; if (M) M.start('menu'); renderIntro(); const rb = $('replayEnd'); if (rb) rb.hidden = false; }
  function maybeEnding() { if (level > LAST_LEVEL && !store.get('seenEnd', false)) setTimeout(showEnding, 700); }
  function showIntro() { PANELS = STORY; introStep = 0; $('intro').hidden = false; document.body.classList.add('in-game'); $('introRain').innerHTML = ''; renderIntro(); }
  function endIntro() {
    const wasEnd = PANELS === ENDING; PANELS = STORY;
    store.set('seenIntro', true); store.set('seenHow', true);
    if (V) V.cancel();
    $('intro').hidden = true; $('introRain').innerHTML = '';
    document.body.classList.toggle('in-game', !$('game').hidden);
    if (M) M.start('menu');
    scrollToLevel(level);
    setTimeout(() => scrollToLevel(level), 80);
    maybeBonus();
  }
  function syncOpts() {
    const set = (id, on) => $(id).setAttribute('aria-checked', String(!!on));
    set('optHaptic', hapticOn); set('optMusic', M && M.isEnabled()); set('optVoice', V && V.isEnabled()); set('optAll', S.isOn());
  }

  /* ---------- navigation ---------- */
  async function toMap() {
    const p = pendingHop; pendingHop = null;
    if (p) mascotAt = p.from;
    await transition(() => { renderHome(); show('home'); scrollToLevel(p ? p.from : level); });
    if (p) { await sleep(120); await hopTo(p.from, p.to); }
  }
  async function nextLevel() {
    $('win').hidden = true;
    if (cur.meta.kind !== 'level' || cur.meta.level >= LAST_LEVEL) { await toMap(); maybeEnding(); return; }
    const from = cur.meta.level, to = level; pendingHop = null;
    try {
      mascotAt = from;
      await transition(() => { renderHome(); show('home'); scrollToLevel(from); });
      await sleep(100);
      await Promise.race([hopTo(from, to), sleep(2500)]); mascotAt = 0;
      if (V && to > 1 && (to - 1) % 10 === 0) V.say('Welcome to ' + zoneOf(to).name + '!', true);
      await sleep(120);
      await new Promise((res) => openPrelevel(to, () => transition(() => startLevel(to)).then(res)));
    } catch (e) {
      console.error(e);
      try { $('wipe').hidden = true; startLevel(to); } catch (e2) { renderHome(); show('home'); }
    }
  }

  /* ---------- wiring ---------- */
  $('daily').onclick = () => { S.unlock(); S.tap(); if (!canPlay()) { openLives(); return; } transition(() => startDaily()); };
  $('backBtn').onclick = () => { S.ui('back', 1, 1); toMap(); };
  $('undoBtn').onclick = undo;
  document.querySelectorAll('.card').forEach((card) => {
    const x = document.createElement('button'); x.type = 'button'; x.className = 'xclose'; x.setAttribute('aria-label', 'Close');
    x.onclick = (e) => {
      e.stopPropagation(); S.tap();
      const ov = card.closest('.overlay'); if (!ov) return;
      const ids = ['#rwOk', '#howClose', '#wheelClose', '#chestClose', '#questClose', '#giftClose', '#gamesClose', '#memClose', '#tossClose', '#passClose', '#quickClose', '#eventsClose', '#climbClose', '#livesClose', '#rankClose', '#hintCancel', '#shopClose', '#colClose', '#pfClose', '#homeBtn', '#loseHome', '#bonusClaim'];
      for (const id of ids) { const b = card.querySelector(id); if (b) { b.click(); if (ov.hidden) return; break; } }
      ov.hidden = true;                                   // any popup without its own button just closes
    };
    card.appendChild(x);
  });
  $('rankBtn').onclick = openRanking;
  $('pfCollection').onclick = openCollection;
  $('colClose').onclick = () => { S.tap(); $('collection').hidden = true; };
  document.querySelectorAll('#colTabs button').forEach((b) => { b.onclick = () => { colTab = b.dataset.t; S.tap(); renderCollection(); }; });
  document.querySelectorAll('#qTabs button').forEach((b) => { b.onclick = () => { qTab = b.dataset.t; S.tap(); renderQuests(); }; });
  $('gearMap').onclick = () => { S.tap(); syncOpts(); $('how').hidden = false; };
  $('pfClose').onclick = () => { saveProfileName(); S.tap(); $('profile').hidden = true; };
  $('pfName').onchange = saveProfileName;
  $('rankClose').onclick = () => { saveName(); S.tap(); $('ranking').hidden = true; };
  $('rankName2').onchange = saveName;
  $('hintBtn').onclick = () => openItemInfo('hint');
  $('wandBtn').onclick = () => openItemInfo('wand');
  $('sweepBtn').onclick = () => openItemInfo('sweeper');
  $('lensBtn').onclick = () => openItemInfo('lens');
  $('rwOk').onclick = () => { S.tap(); flyReward(curReward); $('reward').hidden = true; setTimeout(nextReward, 220); };
  $('hintUse').onclick = onItemButton;
  $('walletCoins').onclick = openShop;
  $('shopClose').onclick = () => { S.tap(); $('shop').hidden = true; };
  $('bonusClaim').onclick = () => { S.tap(); $('bonus').hidden = true; updateHintUi(); };
  $('hintCancel').onclick = () => { S.tap(); $('hintInfo').hidden = true; };
  $('clearBtn').onclick = restart;
  $('maybeBtn').onclick = () => { cur.maybeMode = !cur.maybeMode; $('maybeBtn').setAttribute('aria-pressed', String(cur.maybeMode)); S.tap(); };
  const openHow = () => { S.tap(); syncOpts(); $('how').hidden = false; };
  $('gearBtn').onclick = openHow; $('howBtn').onclick = openHow;
  $('howClose').onclick = () => { S.tap(); $('how').hidden = true; store.set('seenHow', true); };
  const toggleSound = () => { S.toggle(); syncSound(); if (M) M.sync(); if (!S.isOn() && V) V.cancel(); syncOpts(); };
  $('optMusic').onclick = () => { S.unlock(); M.setEnabled(!M.isEnabled()); syncOpts(); };
  $('optVoice').onclick = () => { V.setEnabled(!V.isEnabled()); syncOpts(); if (V.isEnabled()) V.say('Sweet!', true); };
  $('optAll').onclick = toggleSound;
  $('optHaptic').onclick = () => { hapticOn = !hapticOn; store.set('haptic', hapticOn); syncOpts(); if (hapticOn) { try { navigator.vibrate && navigator.vibrate(25); } catch (_) {} } };
  $('replayIntro').onclick = () => { $('how').hidden = true; showIntro(); };
  { const rb = $('replayEnd'); rb.hidden = !store.get('seenEnd', false); rb.onclick = () => { $('how').hidden = true; showEnding(); }; }
  $('introNext').onclick = () => { S.tap(); if (introStep >= PANELS.length) { if (V && PANELS !== ENDING) V.say("Let's play!", true); endIntro(); } else { introStep++; renderIntro(); } };
  $('introSkip').onclick = () => { S.tap(); endIntro(); };
  document.addEventListener('pointerdown', () => { S.unlock(); if (M && $('intro').hidden) M.sync(); }, { once: true });
  $('sndHome').onclick = toggleSound; $('sndGame').onclick = toggleSound;
  $('homeBtn').onclick = () => { $('win').hidden = true; toMap().then(maybeEnding); };
  $('loseHome').onclick = () => { $('lose').hidden = true; toMap(); };
  $('reviveBtn').onclick = () => { S.tap(); watchAd(() => {
    cur.revived = true; cur.done = false; cur.hearts = 1; addLives(1); if (cur.climbDropped && climbOn()) { climb.step++; climb.moved = 0; store.set('climb', climb); }
    $('lose').hidden = true; drawHearts(); saveGame(); toast('❤️ One more heart. Keep going!');
  }); };
  $('retryBtn').onclick = () => { S.tap(); if (!canPlay()) { $('lose').hidden = true; toMap(); setTimeout(openLives, 900); return; } $('lose').hidden = true; const m = cur.meta; transition(() => (m.kind === 'level' ? startLevel(m.level) : startDaily())); };
  $('nextBtn').onclick = () => { S.tap(); nextLevel(); };
  $('shareBtn').onclick = async () => {
    const text = T('Bonbox 🍬 ' + cur.label + ' ' + cur.n + '×' + cur.n + ' solved' + (cur.hints ? '' : ' with no hints'));
    try {
      if (navigator.share) await navigator.share({ text, url: location.href });
      else { await navigator.clipboard.writeText(text + ' ' + location.href); $('shareBtn').textContent = 'Copied!'; setTimeout(() => { $('shareBtn').textContent = 'Share'; }, 1500); }
    } catch (e) {}
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) return; });

  /* ---------- tutorial coach (first level) ---------- */
  let forceCoach = false, coachStep = 0;
  const COACH = [
    { sel: 'found', text: 'Welcome! Your goal: put exactly ONE candy in every color. The row up here shows which candies you still need.', at: 'bottom' },
    { sel: 'board', text: 'Tap a square to mark an X, a square that cannot hold a candy. Tap the X again to remove it. Drag across squares to mark many.', at: 'bottom' },
    { sel: 'board', text: 'Double-tap a square to place a candy. Only ONE candy in each row and each column, and candies can never touch, not even diagonally.', at: 'bottom' },
    { sel: 'board', text: '✅ Do: one candy in every row, column and color.  ❌ Never: two candies in the same row, column or color, or touching each other, even diagonally.', at: 'bottom' },
    { sel: 'hearts', text: 'Careful! A wrong candy costs a heart. Lose all three hearts and you try the level again.', at: 'bottom' },
    { sel: 'hintBtn', text: 'Stuck? The light bulb gives a hint, and the wand places a correct candy for you. You start with a few of each.', at: 'top' },
    { sel: 'found', text: 'Place all the candies to win! You earn stars, coins and prizes. Good luck!', at: 'bottom' }
  ];
  function coachPlace() {
    const st = COACH[coachStep], el = $(st.sel), r = el.getBoundingClientRect(), ring = $('coachRing'), b = $('coachBubble');
    ring.style.left = (r.left - 6) + 'px'; ring.style.top = (r.top - 6) + 'px'; ring.style.width = (r.width + 12) + 'px'; ring.style.height = (r.height + 12) + 'px';
    b.style.top = st.at === 'top' ? '84px' : 'auto'; b.style.bottom = st.at === 'top' ? 'auto' : '14px';
    $('coachText').textContent = st.text; $('coachStep').textContent = 'Tutorial ' + (coachStep + 1) + ' / ' + COACH.length;
    $('coachNext').textContent = coachStep === COACH.length - 1 ? "Let's play!" : 'Next';
  }

  /* ---------- visual tutorial: every rule is SHOWN on a small animated board, right vs wrong ---------- */
  const TREG = [[0, 0, 0, 1], [2, 2, 1, 1], [2, 3, 3, 1], [2, 3, 3, 3]], TSOL = [[0, 1], [1, 3], [2, 0], [3, 2]], TCOL = ['#22b8ff', '#ffd400', '#ff52c8', '#7ee21f'];
  function tutBoard(o) {
    const has = (l, y, x) => (l || []).some((c) => c[0] === y && c[1] === x); let hh = '<div class="tb' + (o.bad ? ' isbad' : o.good ? ' isgood' : '') + '">';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const k = (o.candies || []).findIndex((c) => c[0] === y && c[1] === x);
      hh += '<i class="tc' + (has(o.hi, y, x) ? ' hi' : '') + (has(o.red, y, x) ? ' red' : '') + '" data-p="' + y + x + '" style="--c:' + TCOL[TREG[y][x]] + '">' + (k >= 0 ? '<svg style="animation-delay:' + (0.15 + k * 0.18) + 's"><use href="#c' + ((o.ids || [0, 2, 3, 6])[k]) + '"/></svg>' : has(o.xs, y, x) ? '<u></u>' : '') + '</i>';
    }
    return hh + '</div>' + (o.bad ? '<b class="tmark bad">✗</b>' : o.good ? '<b class="tmark good">✓</b>' : '');
  }
  const pair = (good, bad) => '<div class="tpair"><div class="tside">' + tutBoard(Object.assign({ good: 1 }, good)) + '</div><div class="tside">' + tutBoard(Object.assign({ bad: 1 }, bad)) + '</div></div>';
  const rowOf = (y) => [0, 1, 2, 3].map((x) => [y, x]), colOf = (x) => [0, 1, 2, 3].map((y) => [y, x]), regOf = (r) => { const o = []; TREG.forEach((rw, y) => rw.forEach((v, x) => { if (v === r) o.push([y, x]); })); return o; };
  const TUT = [
    { t: 'How to mark', d: 'Tap a square for an X (no candy here). Double-tap to place a candy.', h: () => '<div class="tsolo">' + tutBoard({}) + '<span class="thand" id="tHand">👆</span></div>', run: tutHand },
    { t: 'Rows and columns', d: 'Two candies can never share a row or a column.', h: () => pair({ candies: TSOL, hi: rowOf(0).concat(colOf(1)) }, { candies: [[0, 0], [0, 3]], red: rowOf(0), ids: [0, 2] }) },
    { t: 'One per colour', d: 'Each colour area holds exactly one candy.', h: () => pair({ candies: TSOL, hi: regOf(2) }, { candies: [[1, 1], [3, 0]], red: regOf(2), ids: [3, 6] }) },
    { t: 'No touching!', d: 'Not side by side, and not even corner to corner.', h: () => pair({ candies: TSOL }, { candies: [[1, 1], [2, 2]], red: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2], [1, 1]], ids: [0, 3] }) },
    { t: 'Hearts & helpers', d: 'A wrong candy costs a heart. Stuck? The light bulb gives a hint and the wand places a candy for you.', h: () => '<div class="thelp"><span class="thearts"><img src="art/ic_heart.webp" alt=""><img src="art/ic_heart.webp" alt=""><img class="brk" src="art/ic_heart.webp" alt=""></span><span class="ttools"><img src="art/ic_hint.webp" alt=""><img src="art/ic_wand.webp" alt=""></span></div>' }
  ];
  let tutI = 0, tutT = [];
  function tutHand() {
    const box = $('tutStage'), hand = $('tHand'); if (!hand) return; const cell = (p) => box.querySelector('.tc[data-p="' + p + '"]');
    const go = (p) => { const c = cell(p), b = box.querySelector('.tsolo').getBoundingClientRect(), r = c.getBoundingClientRect(); hand.style.left = (r.left - b.left + r.width / 2) + 'px'; hand.style.top = (r.top - b.top + r.height / 2) + 'px'; };
    const tap = () => { hand.classList.remove('tap'); void hand.offsetWidth; hand.classList.add('tap'); S.tap(); };
    const loop = () => {
      box.querySelectorAll('.tc').forEach((c) => { c.innerHTML = ''; });
      const seq = [[300, () => go('11')], [1000, () => { tap(); cell('11').innerHTML = '<u></u>'; }], [1900, () => go('22')], [2600, () => { tap(); cell('22').innerHTML = '<u></u>'; }],
        [3500, () => go('01')], [4200, tap], [4450, () => { tap(); cell('01').innerHTML = '<svg><use href="#c0"/></svg>'; S.candy(0, 3); }], [6200, loop]];
      seq.forEach((q) => tutT.push(setTimeout(q[1], q[0])));
    };
    loop();
  }
  function tutShow() {
    tutT.forEach(clearTimeout); tutT = []; const s = TUT[tutI];
    $('tutTitle').textContent = s.t; $('tutText').textContent = s.d; $('tutStage').innerHTML = s.h(); $('tutDots').innerHTML = TUT.map((x, i) => '<i class="' + (i === tutI ? 'on' : '') + '"></i>').join('');
    $('tutNext').textContent = tutI === TUT.length - 1 ? "Let's play!" : 'Next'; $('tutBack').hidden = tutI === 0; if (s.run) setTimeout(s.run, 60);
  }
  function openTutorial() { forceCoach = false; tutI = 0; $('tutorial').hidden = false; tutShow(); }
  function closeTutorial() { tutT.forEach(clearTimeout); tutT = []; store.set('seenCoach', true); $('tutorial').hidden = true; }
  $('tutNext').onclick = () => { if (tutI >= TUT.length - 1) closeTutorial(); else { tutI++; tutShow(); } };
  $('tutBack').onclick = () => { if (tutI > 0) { tutI--; tutShow(); } };
  $('tutSkip').onclick = closeTutorial;

  function startCoachOld() { if (!cur || $('game').hidden) return; forceCoach = false; coachStep = 0; $('coach').hidden = false; coachPlace(); }
  function endCoach() { store.set('seenCoach', true); $('coach').hidden = true; S.tap(); }
  $('coachNext').onclick = () => { S.tap(); if (coachStep >= COACH.length - 1) endCoach(); else { coachStep++; coachPlace(); } };
  $('coachSkip').onclick = endCoach;
  window.addEventListener('resize', () => { if (!$('coach').hidden) coachPlace(); });
  $('replayCoach').onclick = () => { $('how').hidden = true; openTutorial(); };

  /* ---------- collection: outfits, board frames, stickers ---------- */
  // two outfits at the start, then a new one every 15 levels passed; each has a standing pose (map, collection) and an arms-up pose (win screen, the in-air jump)
  const OUTFITS = [{ id: 'hero', name: 'Varsity Gumi', img: 'gumi_hero', win: 'gumi_win', air: 'gumi_jump', at: 0 },
    { id: 'chef', name: 'Chef Gumi', img: 'gumi_chef_stand', win: 'gumi_chef_win', air: 'gumi_chef_win', at: 0 },
    { id: 'fire', name: 'Firefighter Gumi', img: 'gumi_fire_stand', win: 'gumi_fire_win', air: 'gumi_fire_win', at: 15 },
    { id: 'pirate', name: 'Pirate Gumi', img: 'gumi_pirate_stand', win: 'gumi_pirate_win', air: 'gumi_pirate_win', at: 30 },
    { id: 'cowboy', name: 'Cowboy Gumi', img: 'gumi_cowboy_stand', win: 'gumi_cowboy_win', air: 'gumi_cowboy_win', at: 45 },
    { id: 'wizard', name: 'Wizard Gumi', img: 'gumi_wizard_stand', win: 'gumi_wizard_win', air: 'gumi_wizard_win', at: 60 },
    { id: 'king', name: 'King Gumi', img: 'gumi_king_stand', win: 'gumi_king_win', air: 'gumi_king_win', at: 75 },
    { id: 'ninja', name: 'Ninja Gumi', img: 'gumi_ninja_stand', win: 'gumi_ninja_win', air: 'gumi_ninja_win', at: 90 }];
  // bear colours: the pink jelly is recoloured on the fly (clothes stay as they are); a new colour at 10, 30, 50, 70 and 90 levels
  const BEARCOLORS = [{ id: 'pink', name: 'Pink', hue: 0, at: 0, css: '#ff3d9a' }, { id: 'blue', name: 'Blue', hue: -125, at: 10, css: '#3d8bff' }, { id: 'green', name: 'Green', hue: 150, at: 30, css: '#2fd16b' },
    { id: 'orange', name: 'Orange', hue: 50, at: 50, css: '#ff8a1f' }, { id: 'purple', name: 'Purple', hue: -60, at: 70, css: '#9a4dff' }, { id: 'yellow', name: 'Yellow', hue: 80, at: 90, css: '#ffcf1f' }];
  const colorCache = {};
  function recolor(name, hue) {
    const url = 'art/' + name + '.webp'; if (!hue) return Promise.resolve(url);
    const key = name + hue; if (colorCache[key]) return colorCache[key];
    colorCache[key] = new Promise((res) => {
      const im = new Image(); im.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
          const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
          for (let i = 0; i < p.length; i += 4) {
            if (p[i + 3] < 8) continue;
            const r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dl = mx - mn;
            if (dl < 0.18 || mx < 0.3) continue;
            let h = mx === r ? ((gg - b) / dl) % 6 : mx === gg ? (b - r) / dl + 2 : (r - gg) / dl + 4; h = (h * 60 + 360) % 360;
            if (h < 312 || h > 349) continue;            // only the pink jelly; reds, whites, teal and gold are left alone
            const s = mx === 0 ? 0 : dl / mx; let nh = (h + hue + 360) % 360, f = nh / 60, ii = Math.floor(f) % 6, ff = f - Math.floor(f);
            const v = mx, pp = v * (1 - s), q = v * (1 - ff * s), t = v * (1 - (1 - ff) * s); const o = [[v, t, pp], [q, v, pp], [pp, v, t], [pp, q, v], [t, pp, v], [v, pp, q]][ii];
            p[i] = o[0] * 255; p[i + 1] = o[1] * 255; p[i + 2] = o[2] * 255;
          }
          g.putImageData(d, 0, 0); res(c.toDataURL('image/webp', 0.9));
        } catch (e) { res(url); }
      }; im.onerror = () => res(url); im.src = url;
    });
    return colorCache[key];
  }
  let bearColor = store.get('bearColor', 'pink');
  const bearColorOf = (id) => BEARCOLORS.find((c) => c.id === id) || BEARCOLORS[0];
  let look = { stand: 'art/gumi_hero.webp', win: 'art/gumi_win.webp', air: 'art/gumi_jump.webp' };
  const FRAMES = [{ id: 'cream', name: 'Cream', bg: '#f7f1e5', at: 0 }, { id: 'mint', name: 'Mint', bg: 'linear-gradient(160deg,#e6fff0,#b9f0d2)', at: 10 }, { id: 'sky', name: 'Sky', bg: 'linear-gradient(160deg,#e6f4ff,#bcdcfb)', at: 25 },
    { id: 'rose', name: 'Rose', bg: 'linear-gradient(160deg,#fff0f6,#ffcfe0)', at: 40 }, { id: 'gold', name: 'Gold', bg: 'linear-gradient(160deg,#fff7c9,#ffd96a)', at: 70 }, { id: 'night', name: 'Night', bg: 'linear-gradient(160deg,#5c4fd0,#2a2470)', at: 100 }];
  const WORLD_NAMES = ['Lollipop Meadow', 'Chocolate River', 'Frosting Mountains', 'Cotton Candy Sky', 'Ice Cream Beach', 'Gingerbread Winter', 'Donut Lake', 'Cookie Canyon', 'Crystal Caves', 'Jelly Jungle', 'Cupcake Village', 'Candy Cane Forest', 'Caramel Falls', 'Carnival Fairground', 'Macaron Mesa', 'Waffle Castle', 'Soda Springs', 'Honey Hive Hills', 'Berry Bog', 'Mint Mountain', 'Licorice Night Market', 'Sugar Dunes Oasis', 'Pudding Pools', 'Cinnamon Autumn Forest', 'Starlight Sprinkle Galaxy', 'Toffee Treehouse Village', 'Gumdrop Garden', 'Royal Cake Palace', 'Rainbow Sherbet Glacier', 'Sweet Kingdom Gate', 'Sour Lemon Grove', 'Bubblegum Swamp', 'Marshmallow Clouds', 'Popcorn Peaks', 'Jellybean Harbor', 'Peppermint Blizzard', 'Fudge Volcano', 'Taffy Twister Plains', 'Sprinkle Desert', 'Gummy Bear Woods', 'Candy Carnival Night', 'Blueberry Moon Lagoon', 'Maple Syrup Marsh', 'Rock Candy Cliffs', 'Churro Canyon', 'Strawberry Storm Fields', 'Licorice Ruins', 'Thundercloud Citadel', 'Sour Storm Summit', "Vinegar's Castle"];
  const passed = () => Math.max(0, level - 1);
  let outfit = store.get('outfit', 'hero'), frame = store.get('frame', 'cream');
  const outfitOf = (id) => OUTFITS.find((o) => o.id === id) || OUTFITS[0], frameOf = (id) => FRAMES.find((f) => f.id === id) || FRAMES[0];
  // outfits that have a hand-drawn six-pose victory jump (art/jump_<id>_1..6.webp)
  const JUMPSETS = ['hero', 'chef', 'fire', 'pirate', 'cowboy', 'wizard', 'king', 'ninja'];
  function applyLook() {
    if (passed() < outfitOf(outfit).at) outfit = 'hero'; if (passed() < frameOf(frame).at) frame = 'cream';
    if (passed() < bearColorOf(bearColor).at) bearColor = 'pink';
    const o = outfitOf(outfit), hue = bearColorOf(bearColor).hue;
    Promise.all([recolor(o.img, hue), recolor(o.win, hue), recolor(o.air, hue), recolor('gumi_blink', hue), recolor('gumi_sad', hue)]).then(([st, wn, ar, bl, sd]) => {
      look = { stand: st, win: wn, air: ar };
      const im = document.querySelector('#gumi image'); if (im) im.setAttribute('href', st);
      const iw = document.querySelector('#gumiwin image'); if (iw) iw.setAttribute('href', wn);
      const ib = document.querySelector('#gumiblink image'); if (ib) ib.setAttribute('href', bl);
      const gg = document.querySelector('#win .g-ground'), ga = document.querySelector('#win .g-air'); if (gg) gg.src = wn; if (ga) ga.src = ar;
      const gb = document.querySelector('#win .gbody');
      if (gb) {
        gb.querySelectorAll('.gf').forEach((e) => e.remove()); gb.classList.remove('frames');
        if (JUMPSETS.includes(o.id)) Promise.all([1, 2, 3, 4, 5, 6].map((k) => recolor('jump_' + o.id + '_' + k, hue))).then((fr) => {
          if (outfitOf(outfit).id !== o.id || bearColorOf(bearColor).hue !== hue) return;
          gb.querySelectorAll('.gf').forEach((e) => e.remove());
          fr.forEach((src, k) => { const im = new Image(); im.className = 'gf'; im.alt = ''; im.draggable = false; im.decoding = 'sync'; im.src = src; im.style.opacity = k ? 0 : 1; gb.appendChild(im); });
          gb.classList.add('frames');
        });
      }
      const ls = document.querySelector('.lose-gumi img'); if (ls) ls.src = sd;
    });
    document.body.dataset.outfit = o.id;
    const g = $('game'); if (g) g.style.setProperty('--fbg', frameOf(frame).bg);
    document.documentElement.style.setProperty('--fbg', frameOf(frame).bg);
  }
  const STK_PRIZES = { 5: { coins: 15 }, 10: { coins: 30, shield: 1 }, 20: { coins: 60, wands: 1 }, 30: { coins: 100, wands: 1, lens: 1 } };
  const prizeChipsHtml = (p) => Object.keys(p).map((k) => '<em>' + p[k] + '× ' + (PNAME[k] || k) + '</em>').join(' ');
  const stkPrize = (n) => STK_PRIZES[n] || (n % 5 === 0 ? { coins: 15 } : null);
  let stkClaimed = store.get('stkClaimed', {});
  const stickerCount = () => Math.min(WORLD_NAMES.length, Math.floor(passed() / 10));
  let colTab = 'outfits';
  function openCollection() {
    S.unlock(); S.tap(); $('profile').hidden = true; renderCollection(); $('collection').hidden = false;
  }
  function renderCollection() {
    const grid = $('colGrid'), note = $('colNote'); grid.innerHTML = '';
    document.querySelectorAll('#colTabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === colTab));
    if (colTab === 'outfits') {
      OUTFITS.forEach((o) => {
        const open = passed() >= o.at, b = document.createElement('button'); b.type = 'button'; b.className = 'colcell' + (outfit === o.id ? ' sel' : '') + (open ? '' : ' lock');
        b.innerHTML = '<img src="art/' + o.img + '.webp" alt="" draggable="false"><span>' + o.name + '</span>' + (open ? '' : '<i>Level ' + o.at + '</i>');
        { const th = b.querySelector('img'), hh = bearColorOf(bearColor).hue; if (hh) recolor(o.img, hh).then((u) => { th.src = u; }); }
        b.onclick = () => { if (!open) { toast('Pass ' + o.at + ' levels to unlock ' + o.name); return; } outfit = o.id; store.set('outfit', outfit); applyLook(); S.tap(); renderCollection(); };
        grid.appendChild(b);
      });
      const cr = document.createElement('div'); cr.className = 'colrow'; cr.innerHTML = '<b>Bear colour · tap one, then pick an outfit</b>';
      BEARCOLORS.forEach((c) => {
        const open = passed() >= c.at, w = document.createElement('div'); w.className = 'cwrap'; const d = document.createElement('button'); d.type = 'button'; d.className = 'cdot' + (bearColor === c.id ? ' sel' : '') + (open ? '' : ' lock'); d.style.setProperty('--cc', c.css); d.setAttribute('aria-label', c.name);
        w.appendChild(d); const lb = document.createElement('small'); lb.textContent = open ? c.name : '🔒 Lv ' + c.at; w.appendChild(lb);
        d.onclick = () => { if (!open) { toast('Pass ' + c.at + ' levels to unlock the ' + c.name + ' bear (you are at ' + passed() + ')'); return; } bearColor = c.id; store.set('bearColor', bearColor); applyLook(); S.tap(); renderCollection(); };
        cr.appendChild(w);
      });
      grid.appendChild(cr);
      note.textContent = 'Start with two bears, and win a new outfit every 15 levels. A new colour comes every 20 levels, from level 10.';
    } else if (colTab === 'frames') {
      FRAMES.forEach((f) => {
        const open = passed() >= f.at, b = document.createElement('button'); b.type = 'button'; b.className = 'colcell frm' + (frame === f.id ? ' sel' : '') + (open ? '' : ' lock');
        b.innerHTML = '<div class="swatch" style="background:' + f.bg + '"><u></u><u></u><u></u><u></u></div><span>' + f.name + '</span>' + (open ? '' : '<i>Level ' + f.at + '</i>');
        b.onclick = () => { if (!open) { toast('Pass ' + f.at + ' levels to unlock the ' + f.name + ' frame'); return; } frame = f.id; store.set('frame', frame); applyLook(); S.tap(); renderCollection(); };
        grid.appendChild(b);
      });
      note.textContent = 'Your board frame, used in every level.';
    } else {
      WORLD_NAMES.forEach((w, i) => {
        const open = i < stickerCount(), b = document.createElement('div'); b.className = 'colcell stk' + (open ? '' : ' lock');
        b.innerHTML = '<div class="sticker" style="background-image:url(art/bg_' + i + '.jpg)"></div><span>' + (open ? w : '?') + '</span>';
        grid.appendChild(b);
      });
      for (let n = 5; n <= WORLD_NAMES.length; n += 5) {
        const pz = stkPrize(n), got = stickerCount() >= n, done = !!stkClaimed[n], r = document.createElement('div'); r.className = 'stkrow' + (got ? '' : ' lock');
        r.innerHTML = '<span><b>' + n + ' stickers</b> ' + prizeChipsHtml(pz) + '</span>';
        const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn main stkbtn'; bt.textContent = done ? 'Claimed ✓' : got ? 'Claim' : stickerCount() + '/' + n; bt.disabled = done || !got;
        bt.onclick = () => { stkClaimed[n] = true; store.set('stkClaimed', stkClaimed); giveReward(pz, 'Album prize!', true); renderCollection(); };
        r.appendChild(bt); grid.appendChild(r);
      }
      note.textContent = stickerCount() + ' / ' + WORLD_NAMES.length + ' stickers · claim a prize every 5 stickers';
    }
  }
  /* unlocks and sticker prizes announced the moment you earn them */
  function checkUnlocks(m) {
    const lv = m.level, extra = [];
    OUTFITS.filter((o) => o.at === lv && o.at > 0).forEach((o) => extra.push({ t: 'New outfit!', html: '<div class="rw-it"><img src="art/' + o.img + '.webp" alt="" draggable="false"><b>' + o.name + '</b></div>', big: true }));
    if (lv % 50 === 0) { const n = lv / 50; extra.push({ t: 'Rare sticker!', html: '<div class="rw-it"><div class="sticker big rare">💀</div><b>Extreme Champion ' + n + '</b></div>', p: { coins: 20 }, big: true }); give({ coins: 20 }); }
    FRAMES.filter((f) => f.at === lv && f.at > 0).forEach((f) => extra.push({ t: 'New board frame!', html: '<div class="rw-it"><div class="swatch big" style="background:' + f.bg + '"><u></u><u></u><u></u><u></u></div><b>' + f.name + '</b></div>' }));
    if (lv % 10 === 0 && lv / 10 <= WORLD_NAMES.length) {
      const i = lv / 10 - 1; extra.push({ t: lv >= 20 ? 'Sticker won back!' : 'New sticker!', html: '<div class="rw-it"><div class="sticker big" style="background-image:url(art/bg_' + i + '.jpg)"></div><b>' + WORLD_NAMES[i] + '</b></div>' });
      const n = lv / 10; if (stkPrize(n)) extra.push({ p: {}, t: 'Album prize ready! ' + n + ' stickers', html: '<div class="rw-it"><b>Open My Collection → Stickers to claim it</b></div>', big: false });
    }
    extra.forEach((e, k) => setTimeout(() => announce(e.p || {}, e.t, e.big, e.html), 5200 + k * 100));
  }

  /* ---------- challenges: daily, weekly, trophies ---------- */
  const weekKey = () => { const d = new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + Math.ceil(((t - y0) / 864e5 + 1) / 7); };
  let stats = Object.assign({ solved: 0, flawless: 0, nohint: 0, bosses: 0, run: 0, maxRun: 0 }, store.get('stats', {}));
  let weekly = store.get('weekly', null), achClaimed = store.get('achClaimed', {});
  const WDEF = [{ id: 'w1', text: 'Solve 15 levels this week', goal: 15, key: 'solved', prize: { coins: 10 } },
    { id: 'w2', text: 'Win 3 Hard (or harder) levels', goal: 3, key: 'hard', prize: { lens: 1 } },
    { id: 'w3', text: 'Win 5 levels without losing a heart', goal: 5, key: 'flawless', prize: { hints: 1, coins: 6 } }];
  const ADEF = [{ id: 'a1', text: 'Pass 10 levels', goal: 10, get: () => stats.solved, prize: { coins: 5 } },
    { id: 'a2', text: 'Pass 50 levels', goal: 50, get: () => stats.solved, prize: { coins: 12 } },
    { id: 'a3', text: 'Pass 100 levels', goal: 100, get: () => stats.solved, prize: { coins: 25, lens: 1 } },
    { id: 'a4', text: 'Pass 200 levels', goal: 200, get: () => stats.solved, prize: { coins: 50, wands: 1 } },
    { id: 'a5', text: 'Win 10 levels without losing a heart', goal: 10, get: () => stats.flawless, prize: { sweeper: 1 } },
    { id: 'a6', text: 'Win 50 levels without losing a heart', goal: 50, get: () => stats.flawless, prize: { coins: 20, shield: 1 } },
    { id: 'a7', text: 'Win 10 levels with no hints', goal: 10, get: () => stats.nohint, prize: { coins: 8 } },
    { id: 'a8', text: 'Defeat 3 bosses', goal: 3, get: () => stats.bosses, prize: { hints: 1, coins: 10 } },
    { id: 'a9', text: 'Sky Path: 5 flawless levels in a row', goal: 5, get: () => stats.maxRun, prize: { coins: 10 } },
    { id: 'a10', text: 'Daily Bonus streak of 7 days', goal: 7, get: () => Math.max(bonus.streak || 0, 0), prize: { hints: 1, coins: 10 } }];
  function freshWeek() { const k = weekKey(); if (!weekly || weekly.week !== k) { weekly = { week: k, solved: 0, hard: 0, flawless: 0, claimed: {} }; store.set('weekly', weekly); } }
  function trackSolved() {
    freshWeek(); const flawless = cur.hearts >= MAX_HEARTS; climbWin(); stormWin();
    stats.solved++; if (flawless) { passAdvance(); stats.flawless++; stats.run++; stats.maxRun = Math.max(stats.maxRun, stats.run); } else stats.run = 0; if (!cur.hints) stats.nohint++;
    if (cur.meta && cur.meta.kind === 'level' && cur.meta.level % 10 === 0) stats.bosses++;
    weekly.solved++; if (cur.tier !== 'normal') weekly.hard++; if (flawless) weekly.flawless++;
    store.set('stats', stats); store.set('weekly', weekly);
  }
  const ready = (cur0, goal, claimed) => cur0 >= goal && !claimed;
  const anyChallengeReady = () => { freshWeek(); return WDEF.some((w) => ready(weekly[w.key], w.goal, weekly.claimed[w.id])) || ADEF.some((x) => ready(x.get(), x.goal, achClaimed[x.id])); };
  let qTab = 'daily';
  function prizeChips(p) { return prizeKeys(p).map((k) => '<img src="art/ic_' + PICO[k] + '.webp" alt="" draggable="false"><em>' + p[k] + '</em>').join(''); }
  const tabReady = () => ({ daily: QDEF.some((q) => quests.p[q.id] >= q.goal && !quests.claimed[q.id]), weekly: WDEF.some((w) => ready(weekly[w.key], w.goal, weekly.claimed[w.id])), trophies: ADEF.some((x) => ready(x.get(), x.goal, achClaimed[x.id])) });
  function renderQuests() {
    const list = $('questList'); list.innerHTML = ''; freshDay(); freshWeek();
    const tr = tabReady();
    document.querySelectorAll('#qTabs button').forEach((b) => { b.classList.toggle('on', b.dataset.t === qTab); b.classList.toggle('dot', !!tr[b.dataset.t]); });
    const row = (text, v, goal, claimed, prizeHtmlStr, claim) => {
      const val = Math.min(goal, v), done = val >= goal, d = document.createElement('div'); d.className = 'shoprow quest';
      d.innerHTML = '<span><b>' + text + '</b><small>' + val + ' / ' + goal + '</small><i class="qbar"><u style="width:' + (val / goal) * 100 + '%"></u></i></span>';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn main buy chips'; b.disabled = !done || claimed; b.innerHTML = claimed ? '✓' : prizeHtmlStr;
      b.onclick = () => { if (!done || claimed) return; claim(); }; d.appendChild(b); list.appendChild(d);
    };
    if (qTab === 'daily') {
      QDEF.forEach((q) => row(q.text, quests.p[q.id], q.goal, quests.claimed[q.id], q.coins + ' ' + coinSvg, () => {
        quests.claimed[q.id] = true; giveReward({ coins: q.coins }, 'Quest complete!');
        if (QDEF.every((x) => quests.claimed[x.id]) && !quests.bonus) { quests.bonus = true; wheel.extra++; store.set('wheel', wheel); }
        store.set('quests', quests); updateSides(); renderQuests();
      }));
      $('questBonus').textContent = quests.bonus ? '🎡 Bonus won: 1 extra wheel spin!' : 'Finish all three for a free wheel spin';
    } else if (qTab === 'weekly') {
      WDEF.forEach((w) => row(w.text, weekly[w.key], w.goal, weekly.claimed[w.id], prizeChips(w.prize), () => { weekly.claimed[w.id] = true; store.set('weekly', weekly); giveReward(w.prize, 'Weekly challenge!', true); updateSides(); renderQuests(); }));
      $('questBonus').textContent = 'Weekly challenges restart every Monday';
    } else {
      ADEF.forEach((x) => row(x.text, x.get(), x.goal, achClaimed[x.id], prizeChips(x.prize), () => { achClaimed[x.id] = true; store.set('achClaimed', achClaimed); giveReward(x.prize, 'Trophy won!', true); updateSides(); renderQuests(); }));
      $('questBonus').textContent = 'Trophies are earned once, for good';
    }
  }
  /* ---------- extras: gifts, daily quests, chest, lucky wheel, mini-games ---------- */
  const HOUR = 3600e3, MAX_PLAYS = 2, CHEST_AT = 10;
  let quests = store.get('quests', null), chest = store.get('chest', { n: 0 }), wheel = store.get('wheel', { date: '', extra: 0 });
  let gifts = store.get('gifts', { daily: '', free: 0 }), plays = store.get('plays', { date: '', memory: 0, toss: 0, odd: 0, jars: 0, shoot: 0, hoop: 0, cart: 0 });

  const closeAll = () => { ['wheel', 'chest', 'quests', 'gifts', 'games', 'memory', 'toss', 'pass', 'quick', 'events', 'climb', 'storm'].forEach((id) => { $(id).hidden = true; }); };
  const QDEF = [
    { id: 'solved', text: 'Solve 3 levels', goal: 3, coins: 3 },
    { id: 'nohint', text: 'Solve a level with no hints', goal: 1, coins: 3 },
    { id: 'flawless', text: 'Solve a level without losing a heart', goal: 1, coins: 4 }
  ];
  function freshDay() {
    const t = today();
    if (!quests || quests.date !== t) { quests = { date: t, p: { solved: 0, nohint: 0, flawless: 0 }, claimed: {}, bonus: false }; store.set('quests', quests); }
    if (plays.date !== t) { plays = { date: t, memory: 0, toss: 0, odd: 0, jars: 0, shoot: 0, hoop: 0, cart: 0 }; store.set('plays', plays); }
  }
  const dailyGiftReady = () => gifts.daily !== today();
  const freeGiftReady = () => Date.now() - gifts.free >= 24 * HOUR;
  const questReady = () => QDEF.some((q) => quests.p[q.id] >= q.goal && !quests.claimed[q.id]) || anyChallengeReady();
  function onSolved() {
    freshDay(); trackSolved();
    quests.p.solved++; if (!cur.hints) quests.p.nohint++; if (cur.hearts >= MAX_HEARTS) quests.p.flawless++;
    store.set('quests', quests);
    chest.n = Math.min(CHEST_AT, chest.n + 1); if (cur.hearts >= MAX_HEARTS) chest.fl = (chest.fl || 0) + 1; store.set('chest', chest);
    updateSides();
  }
  function updateSides() {
    freshDay();
    const set = (id, t) => { const e = $(id); if (e) e.textContent = t; };
    set('medDailyTag', daily.last === today() ? '✓' : 'Play');
    const free = wheel.date !== today() || wheel.extra > 0;
    set('medWheelTag', free ? 'FREE' : 'Soon'); $('medWheel').classList.toggle('ready', free);
    { const q = chest.q, rd = q ? chestLeft() <= 0 : chest.n >= CHEST_AT;
      set('medChestTag', q ? (chestLeft() <= 0 ? 'OPEN' : fmtWait(chestLeft())) : chest.n >= CHEST_AT ? 'START' : chest.n + '/' + CHEST_AT); $('medChest').classList.toggle('ready', rd);
      const ci = document.querySelector('#medChest .disc img'); if (ci) ci.src = chestImg(q ? q.tier : chestTier()); }
    const left = (MAX_PLAYS - plays.memory) + (MAX_PLAYS - plays.toss) + (MAX_PLAYS - (plays.odd || 0)) + (MAX_PLAYS - (plays.jars || 0)) + (MAX_PLAYS - (plays.shoot || 0)) + (MAX_PLAYS - (plays.hoop || 0)) + (MAX_PLAYS - (plays.cart || 0));
    set('medGamesTag', left + '/' + MAX_PLAYS * 7);
    const pc = PASS.filter((x, i) => i < pass.step && !pass.cl[i]).length;
    set('medPassTag', pc ? 'CLAIM' : pass.step + '/' + PASS.length); $('medPass').classList.toggle('ready', pc > 0);
    updateRushTag();
    { const n = eventsHot(); set('medEventsTag', n ? n + ' NEW' : 'EVENTS'); $('medEvents').classList.toggle('ready', n > 0); } $('medGames').classList.toggle('ready', left > 0);
    $('navQuests').classList.toggle('dot', questReady()); $('navGifts').classList.toggle('dot', dailyGiftReady() || freeGiftReady());
  }
  function rewardRow(p) { return '<div class="rwd">' + prizeHtml(p) + '</div>'; }

  /* gifts */
  function openGifts() {
    S.unlock(); S.tap(); closeAll();
    const list = $('giftList'); list.innerHTML = '';
    const rows = [
      { name: 'Daily gift', sub: dailyGiftReady() ? 'Ready to collect!' : 'Come back tomorrow', ready: dailyGiftReady(), prize: { coins: 3 }, claim: () => { gifts.daily = today(); } },
      { name: 'Free hint', sub: freeGiftReady() ? 'Ready to collect!' : 'Ready in ' + (() => { const ms = 24 * HOUR - (Date.now() - gifts.free), h = Math.floor(ms / HOUR), m = Math.ceil((ms % HOUR) / 60000); return h + 'h ' + m + 'm'; })(), ready: freeGiftReady(), prize: { hints: 1 }, claim: () => { gifts.free = Date.now(); } }
    ];
    rows.forEach((r) => {
      const d = document.createElement('div'); d.className = 'shoprow';
      d.innerHTML = '<span><b>' + r.name + '</b><small>' + r.sub + '</small></span>' + rewardRow(r.prize);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn main buy'; b.textContent = 'Get'; b.disabled = !r.ready;
      b.onclick = () => { if (!r.ready) return; r.claim(); store.set('gifts', gifts); giveReward(r.prize, 'A gift for you!'); updateSides(); openGifts(); };
      d.appendChild(b); list.appendChild(d);
    });
    $('gifts').hidden = false;
  }
  /* quests */
  function openQuests() {
    S.unlock(); S.tap(); closeAll(); freshDay(); freshWeek(); { const tr = tabReady(); if (!tr[qTab]) qTab = tr.daily ? 'daily' : tr.weekly ? 'weekly' : tr.trophies ? 'trophies' : qTab; } renderQuests(); $('quests').hidden = false;
  }
  /* chest: fills up as you solve levels; the better you played (hearts kept), the bigger the chest.
     It then needs time to open: small 15 min, medium 1 h, large 3 h. Coins can speed it up. */
  const CHEST_T = { small: 15 * 60e3, med: 60 * 60e3, large: 3 * 3600e3 }, CHEST_NAME = { small: 'Small chest', med: 'Medium chest', large: 'Large chest' };
  const chestTier = () => ((chest.fl || 0) >= 8 ? 'large' : (chest.fl || 0) >= 4 ? 'med' : 'small');
  const chestImg = (t) => 'art/3d_chest_' + (t === 'med' ? 'med' : t) + '.webp';
  const chestLeft = () => (chest.q ? Math.max(0, chest.q.ready - Date.now()) : 0);
  const speedCost = () => Math.max(3, Math.ceil(chestLeft() / 60000 / 5));
  function mergePrize(a, b) { const o = Object.assign({}, a); Object.keys(b).forEach((k) => { o[k] = (o[k] || 0) + b[k]; }); return o; }
  function chestLoot(tier) {
    const common = () => { let p; do { p = rollPrize(0, false); } while (p.rare); return p; };
    if (tier === 'small') return common();
    if (tier === 'med') return mergePrize({ coins: 4 }, common());
    return mergePrize(mergePrize({ coins: 8, inf: 15 }, common()), rollPrize(6, true));
  }
  function renderChest() {
    const art = document.querySelector('#chest .chest-art'), full = chest.n >= CHEST_AT, b = $('chestOpen'), q = chest.q;
    const tier = q ? q.tier : chestTier(); art.src = chestImg(tier); art.classList.remove('opening', 'opened'); $('chestPrize').innerHTML = '';
    $('chestBar').style.width = (q ? 100 - chestLeft() / CHEST_T[q.tier] * 100 : (chest.n / CHEST_AT) * 100) + '%';
    b.hidden = false; b.disabled = false; $('chestSpeed').hidden = true;
    if (q) {
      if (chestLeft() <= 0) { $('chestMsg').textContent = CHEST_NAME[q.tier] + ' is ready!'; b.textContent = 'Open chest'; }
      else {
        $('chestMsg').textContent = CHEST_NAME[q.tier] + ' opens in ' + fmtWait(chestLeft()); b.hidden = true;
        const sp = $('chestSpeed'); sp.hidden = false; sp.innerHTML = 'Open now · ' + speedCost() + ' ' + coinSvg; sp.disabled = coins < speedCost();
      }
    } else if (full) { $('chestMsg').textContent = 'Full! It will be a ' + CHEST_NAME[chestTier()].toLowerCase() + '.'; b.textContent = 'Start opening · ' + fmtWait(CHEST_T[chestTier()]); }
    else { $('chestMsg').textContent = 'Solve ' + (CHEST_AT - chest.n) + ' more level' + (CHEST_AT - chest.n > 1 ? 's' : '') + ' · ' + CHEST_NAME[chestTier()] + ' so far (keep your hearts for a bigger one)'; b.disabled = true; b.textContent = 'Start opening'; }
  }
  function openChest() {
    S.unlock(); S.tap(); closeAll(); renderChest(); $('chest').hidden = false;
  }
  function coinBurst(el) {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * 0.35, L = fxLayer();
    for (let k = 0; k < 22; k++) {
      const p = document.createElement('img'); p.src = k % 4 === 0 ? 'art/ic_double.webp' : 'art/ic_coin.webp'; p.className = 'fx-coin'; p.draggable = false;
      p.style.left = cx + 'px'; p.style.top = cy + 'px'; L.appendChild(p);
      const dx = (Math.random() - 0.5) * 260, up = 120 + Math.random() * 150, fall = 160 + Math.random() * 120;
      const an = p.animate([{ transform: 'translate(-50%,-50%) scale(.3) rotate(0)', opacity: 1 }, { transform: 'translate(calc(-50% + ' + dx * 0.6 + 'px),' + (-up) + 'px) scale(1) rotate(200deg)', opacity: 1, offset: 0.45 }, { transform: 'translate(calc(-50% + ' + dx + 'px),' + fall + 'px) scale(.8) rotate(420deg)', opacity: 0 }], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'forwards' });
      an.onfinish = () => p.remove();
    }
  }
  function openChestNow() {
    if (!chest.q) {                                                   // start the timer
      if (chest.n < CHEST_AT) return;
      const tier = chestTier(); chest.q = { tier, ready: Date.now() + CHEST_T[tier] }; chest.n -= CHEST_AT; chest.fl = 0; store.set('chest', chest);
      S.tap(); buzz(14); renderChest(); updateSides(); return;
    }
    if (chestLeft() > 0) return;
    const tier = chest.q.tier, p = chestLoot(tier); chest.q = null; store.set('chest', chest);
    give(p);
    const art = document.querySelector('#chest .chest-art'), btn = $('chestOpen'); btn.hidden = true; $('chestMsg').textContent = 'Opening…';
    art.classList.remove('opened'); void art.offsetWidth; art.classList.add('opening'); S.tap();
    [0, 220, 440, 660].forEach((t) => setTimeout(() => { S.tap(); buzz(14); }, t));
    setTimeout(() => {
      art.classList.remove('opening'); art.classList.add('opened'); coinBurst(art); S.win(); buzz([30, 40, 60]);
      $('chestPrize').innerHTML = '<div class="rwd big">' + prizeHtml(p) + '</div>';
      $('chestMsg').textContent = CHEST_NAME[tier] + ': ' + prizeText(p);
      $('chestBar').style.width = (chest.n / CHEST_AT) * 100 + '%'; updateSides();
      setTimeout(() => announce(p, CHEST_NAME[tier] + '!', tier !== 'small'), 1300);
    }, 950);
  }
  function renderChestTick() { if (chest.q && !$('chest').hidden && !$('chestPrize').innerHTML) renderChest(); }
  function speedChest() {
    if (!chest.q || chestLeft() <= 0) return; const c = speedCost(); if (coins < c) { toast('Not enough coins'); return; }
    coins -= c; saveWallet(); updateHintUi(); chest.q.ready = Date.now() - 1; store.set('chest', chest); S.ui('buy', 1, 1); renderChest(); updateSides();
  }
  /* lucky wheel */
  const WSEG = [{ c: 2 }, { h: 1 }, { s: 1 }, { k: 1 }, { w: 1 }, { l: 1 }, { d: 1 }, { c: 8 }], WW = [46, 9, 8, 8, 2, 8, 3, 16], WCOL = ['#ff5fa8', '#ffb347', '#7be37a', '#45d0ff', '#b07bff', '#ffe14d', '#ff7a5c', '#5fd8ff'];
  let wheelRot = 0, spinning = false;
  function buildWheel() {
    const ICON = (g) => (g.c ? 'ic_coin' : g.h ? 'ic_hint' : g.w ? 'ic_wand' : g.s ? 'ic_shield' : g.k ? 'ic_sweeper' : g.l ? 'ic_lens' : 'ic_double');
    // glossy 3D wheel: every slice is a lit dome of candy colour (bright toward the hub, deep at the rim), with bevelled dividers, a rim shadow and a glass highlight on top
    const COL = [['#ff9bd0', '#ff2f93', '#b4005c'], ['#ffd68a', '#ff9a1f', '#b85a00'], ['#b9f58a', '#3fcf3a', '#12801a'], ['#9be6ff', '#1fb0ff', '#0066b8'], ['#d9b8ff', '#9a4dff', '#5516b8'], ['#fff3a0', '#ffd21f', '#b88a00'], ['#ffb3a0', '#ff5a3a', '#b01e08'], ['#a8f0ff', '#27c9e8', '#0a7f9c']];
    let defs = '<defs>';
    COL.forEach((c, k) => { defs += '<radialGradient id="wg' + k + '" gradientUnits="userSpaceOnUse" cx="110" cy="110" r="92"><stop offset="0" stop-color="' + c[0] + '"/><stop offset=".55" stop-color="' + c[1] + '"/><stop offset="1" stop-color="' + c[2] + '"/></radialGradient>'; });
    defs += '<radialGradient id="wrim" gradientUnits="userSpaceOnUse" cx="110" cy="110" r="92"><stop offset=".78" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>'
      + '<radialGradient id="whubsh" gradientUnits="userSpaceOnUse" cx="110" cy="110" r="34"><stop offset=".5" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'
      + '<linearGradient id="wglass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset=".55" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
      + '<filter id="wsh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.1" flood-color="#2a0040" flood-opacity=".6"/></filter></defs>';
    let s = defs + '<g id="wheelRot">';
    const R = 90, P = (r, a) => (110 + r * Math.cos(a)).toFixed(1) + ' ' + (110 + r * Math.sin(a)).toFixed(1);
    for (let i = 0; i < 8; i++) {
      const a0 = (i * 45 - 90) * Math.PI / 180, a1 = ((i + 1) * 45 - 90) * Math.PI / 180;
      s += '<path d="M110 110 L' + P(R, a0) + ' A' + R + ' ' + R + ' 0 0 1 ' + P(R, a1) + ' Z" fill="url(#wg' + i + ')"/>';
    }
    for (let i = 0; i < 8; i++) {   // bevelled dividers: a dark groove with a bright edge beside it
      const a = (i * 45 - 90) * Math.PI / 180, b = a + 0.018;
      s += '<path d="M110 110 L' + P(R, a) + '" stroke="rgba(60,0,70,.55)" stroke-width="2.6" stroke-linecap="round"/><path d="M110 110 L' + P(R, b) + '" stroke="rgba(255,255,255,.75)" stroke-width="1.1" stroke-linecap="round"/>';
    }
    s += '<circle cx="110" cy="110" r="' + R + '" fill="url(#wrim)"/><circle cx="110" cy="110" r="34" fill="url(#whubsh)"/>';
    for (let i = 0; i < 8; i++) {
      const am = (i * 45 + 22.5 - 90) * Math.PI / 180, g = WSEG[i], rr = 61, x = 110 + rr * Math.cos(am), y = 110 + rr * Math.sin(am), rot = i * 45 + 22.5;
      s += '<g filter="url(#wsh)" transform="rotate(' + rot + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"><image href="art/' + ICON(g) + '.webp" x="' + (x - 16).toFixed(1) + '" y="' + (y - 23).toFixed(1) + '" width="32" height="32"/>' +
        (g.c ? '<text x="' + x.toFixed(1) + '" y="' + (y + 17).toFixed(1) + '" text-anchor="middle" font-size="15" font-weight="900" fill="#fff" stroke="#3a0a4a" stroke-width="3" paint-order="stroke" style="font-family:Nunito,sans-serif">' + g.c + '</text>' : '') + '</g>';
    }
    s += '</g>';
    // the glass highlight does not turn with the wheel: the light stays where it is
    s += '<path d="M' + P(R - 3, Math.PI * 1.06) + ' A' + (R - 3) + ' ' + (R - 3) + ' 0 0 1 ' + P(R - 3, Math.PI * 1.94) + ' Q110 96 ' + P(R - 3, Math.PI * 1.06) + ' Z" fill="url(#wglass)" pointer-events="none"/>';
    $('wheelSvg').innerHTML = s;
  }
  function openWheel() {
    S.unlock(); S.tap(); closeAll(); if (!$('wheelRot')) buildWheel();
    const free = wheel.date !== today(), extra = wheel.extra;
    $('wheelBtn').disabled = spinning || !(free || extra > 0);
    $('wheelBtn').textContent = free ? 'Spin (free!)' : extra > 0 ? 'Spin (' + extra + ' bonus)' : 'Come back tomorrow';
    $('wheelMsg').textContent = free || extra > 0 ? 'Spin the wheel for a prize!' : 'Finish the daily quests for an extra spin.';
    $('wheel').hidden = false;
  }
  function spinWheel() {
    freshDay();
    const free = wheel.date !== today();
    if (spinning || !(free || wheel.extra > 0)) return;
    if (free) wheel.date = today(); else wheel.extra--;
    store.set('wheel', wheel);
    let r = Math.random() * WW.reduce((x, y) => x + y, 0), idx = 0;
    for (let i = 0; i < 8; i++) { r -= WW[i]; if (r <= 0) { idx = i; break; } }
    const g = WSEG[idx], prize = { coins: g.c, hints: g.h, wands: g.w, shield: g.s, sweeper: g.k, lens: g.l, double: g.d };
    give(prize); updateSides();
    const target = (360 - (idx * 45 + 22.5) + 360) % 360, cur0 = wheelRot % 360;
    wheelRot += 360 * 5 + ((target - cur0 + 360) % 360);
    spinning = true; $('wheelBtn').disabled = true; $('wheelMsg').textContent = 'Good luck…';
    const el = $('wheelRot'); el.style.transition = 'transform 4s cubic-bezier(.15,.7,.1,1)'; el.style.transformOrigin = '110px 110px'; el.style.transformBox = 'view-box'; el.style.transform = 'rotate(' + wheelRot + 'deg)';
    let ticks = 0; const tick = setInterval(() => { S.tap(); if (++ticks > 16) clearInterval(tick); }, 220);
    setTimeout(() => { spinning = false; $('wheelMsg').textContent = 'You won ' + prizeText(prize) + '!'; buzz([30, 40, 60]); openWheelState(); announce(prize, 'Lucky Wheel!', !!(prize.wands || prize.double || prize.coins >= 50)); }, 4200);
  }
  function openWheelState() {
    const free = wheel.date !== today(), extra = wheel.extra;
    $('wheelBtn').disabled = !(free || extra > 0);
    $('wheelBtn').textContent = free ? 'Spin (free!)' : extra > 0 ? 'Spin (' + extra + ' bonus)' : 'Come back tomorrow';
  }
  /* mini-games hub */
  const GAME_CD = 2 * 3600e3;
  const fmtWait = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm'; };
  function openGames() {
    S.unlock(); S.tap(); closeAll(); freshDay();
    const list = $('gameList'); list.innerHTML = '';
    [['memory', 'Memory Match', 'Find all the pairs in 14 moves', 'games'], ['toss', 'Candy Toss', 'Toss 5 candies into the jar', 'games'], ['odd', 'Odd One Out', 'Spot the different candy before time runs out', 'games'], ['jars', 'Sugar Jars', 'Tap the jar that matches the drop', 'games']].forEach((g) => {
      const left = MAX_PLAYS - (plays[g[0]] || 0), wait = Math.max(0, GAME_CD - (Date.now() - ((plays.t || {})[g[0]] || 0))), d = document.createElement('div'); d.className = 'shoprow';
      d.innerHTML = '<img class="pico" src="art/ic_' + g[3] + '.webp" alt="" draggable="false"><span><b>' + g[1] + '</b><small>' + g[2] + ' · ' + left + '/' + MAX_PLAYS + ' today' + (wait > 0 && left > 0 ? ' · ready in ' + fmtWait(wait) : '') + '</small></span>';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn main buy'; b.textContent = wait > 0 && left > 0 ? '⏳' : 'Play'; b.disabled = left <= 0 || wait > 0;
      b.onclick = () => { plays.t = plays.t || {}; plays.t[g[0]] = Date.now(); store.set('plays', plays); if (g[0] === 'memory') startMemory(); else if (g[0] === 'toss') startToss(); else if (g[0] === 'odd') startOdd(); else startJars(); };
      d.appendChild(b); list.appendChild(d);
    });
    $('games').hidden = false;
  }

  /* ---------- Candy Pass: a vertical track of prizes; every level won without losing a heart climbs one step ---------- */
  const PASS = [{ coins: 2 }, { coins: 3 }, { hints: 1 }, { coins: 4 }, { shield: 1 }, { coins: 5 }, { inf: 15 }, { coins: 6 }, { lens: 1 }, { coins: 15, wands: 1 }];
  let pass = Object.assign({ step: 0, cl: [], round: 1 }, store.get('pass', {}));
  function passAdvance() {
    if (pass.step >= PASS.length) return;
    pass.step++; store.set('pass', pass); updateSides();
  }
  function openPass() {
    S.unlock(); S.tap(); closeAll(); renderPass(); $('pass').hidden = false;
  }
  function renderPass() {
    const list = $('passList'); list.innerHTML = '';
    for (let i = PASS.length - 1; i >= 0; i--) {
      const reached = i < pass.step, done = !!pass.cl[i], r = document.createElement('div');
      r.className = 'stkrow passrow' + (reached ? '' : ' lock') + (i === pass.step - 1 ? ' now' : '');
      r.innerHTML = '<i class="pnum' + (reached ? ' on' : '') + '">' + (i + 1) + '</i><span>' + prizeChipsHtml(PASS[i]) + '</span>';
      const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn main stkbtn';
      bt.textContent = done ? '✓' : reached ? 'Claim' : '🔒'; bt.disabled = done || !reached;
      bt.onclick = () => { pass.cl[i] = true; store.set('pass', pass); giveReward(PASS[i], 'Candy Pass!', i === PASS.length - 1); renderPass(); updateSides(); };
      r.appendChild(bt); list.appendChild(r);
    }
    const all = pass.step >= PASS.length && PASS.every((x, i) => pass.cl[i]);
    $('passInfo').textContent = all ? 'Pass complete! Start a fresh one.' : 'Win levels without losing a heart to climb · ' + pass.step + ' / ' + PASS.length;
    if (all) {
      const nb = document.createElement('button'); nb.type = 'button'; nb.className = 'btn main wide'; nb.textContent = 'Start a new pass';
      nb.onclick = () => { pass = { step: 0, cl: [], round: pass.round + 1 }; store.set('pass', pass); renderPass(); updateSides(); };
      list.prepend(nb);
    }
  }



  /* ====================== LIVES, VIDEO REWARDS AND THE REAL-MONEY STORE ======================
     Lives: 5 at most. Failing a level costs one. One comes back every 30 minutes. With none left you wait,
     watch a video, or refill with coins.
     Videos and purchases go through window.CandokuNative, which the Android app provides (AdMob + Play Billing).
     In the browser there is no such bridge, so those buttons explain that they arrive with the app
     (with ?dbg=1 they are simulated so the flows can be tested). */
  const MAX_LIVES = 5, LIFE_MS = 30 * 60e3, DBG = location.search.includes('dbg');
  let lives = Object.assign({ n: MAX_LIVES, t: 0 }, store.get('lives', {}));
  function livesNow() {
    if (lives.n >= MAX_LIVES) { lives.n = MAX_LIVES; lives.t = 0; return lives.n; }
    if (!lives.t) lives.t = Date.now();
    const k = Math.floor((Date.now() - lives.t) / LIFE_MS);
    if (k > 0) { lives.n = Math.min(MAX_LIVES, lives.n + k); lives.t = lives.n >= MAX_LIVES ? 0 : lives.t + k * LIFE_MS; store.set('lives', lives); }
    return lives.n;
  }
  const nextLifeIn = () => (livesNow() >= MAX_LIVES ? 0 : Math.max(0, lives.t + LIFE_MS - Date.now()));
  function addLives(n) { livesNow(); lives.n = Math.min(MAX_LIVES, lives.n + n); if (lives.n >= MAX_LIVES) lives.t = 0; store.set('lives', lives); infTick(); }
  function loseLife() { if (infOn()) return; livesNow(); if (lives.n <= 0) return; if (lives.n >= MAX_LIVES) lives.t = Date.now(); lives.n--; store.set('lives', lives); infTick(); }
  const canPlay = () => infOn() || livesNow() > 0;

  const NATIVE = () => window.CandokuNative || null;
  let adsOff = store.get('adsOff', false), adDay = store.get('adDay', { d: '', n: 0 });
  const AD_CAP = 12;
  const adsLeft = () => { if (adDay.d !== today()) { adDay = { d: today(), n: 0 }; } return AD_CAP - adDay.n; };
  const adAvailable = () => !!(NATIVE() && NATIVE().showRewarded) || DBG;
  // show a rewarded video; `grant` runs only when the video was watched to the end
  function watchAd(grant) {
    if (adsLeft() <= 0) { toast('No more videos today. Come back tomorrow!'); return; }
    const ok = () => { adDay.n++; store.set('adDay', adDay); grant(); };
    const nat = NATIVE();
    if (nat && nat.showRewarded) { Promise.resolve(nat.showRewarded()).then((done) => { if (done) ok(); else toast('Watch the whole video to get the reward'); }).catch(() => toast('No video available right now')); return; }
    if (DBG) { toast('▶ (test) video playing…'); setTimeout(ok, 1500); return; }
    toast('Video rewards arrive with the Bonbox app on Google Play');
  }
  /* products sold for real money; ids match the ones to create in Google Play Console */
  const PACKS = [
    { id: 'starter', name: 'Starter Pack', price: '$0.99', img: 'ev_pass', once: true, tag: 'ONE TIME · BEST DEAL', give: { coins: 100, hints: 3, wands: 1, inf: 60 } },
    { id: 'coins_s', name: 'Bag of Coins', price: '$1.99', img: '3d_chest_small', give: { coins: 150 } },
    { id: 'coins_m', name: 'Jar of Coins', price: '$4.99', img: '3d_chest_med', tag: 'POPULAR', give: { coins: 500 } },
    { id: 'coins_l', name: 'Chest of Coins', price: '$9.99', img: '3d_chest_large', tag: 'BEST VALUE', give: { coins: 1500 } },
    { id: 'lives', name: 'Full Lives', price: '$0.99', img: 'ic_heart', lives: true, give: {} },
    { id: 'inf2h', name: 'Unlimited Lives', price: '$1.99', img: 'ic_heart', tag: '2 HOURS', give: { inf: 120 } },
    { id: 'helpers', name: 'Helper Pack', price: '$3.99', img: 'ic_wand', give: { hints: 10, wands: 5, shield: 3, sweeper: 3, lens: 3, double: 3 } },
    { id: 'noads', name: 'No Ads', price: '$9.99', img: 'ic_shield', once: true, give: {}, noads: true }
  ];
  let owned = store.get('owned', {});
  // called after a purchase is confirmed (by the native app, or by the test mode)
  function grantPack(id) {
    const p = PACKS.find((x) => x.id === id); if (!p) return false;
    if (p.once) { if (owned[id]) return false; owned[id] = true; store.set('owned', owned); }
    if (p.lives) { addLives(MAX_LIVES); toast('❤️ Lives refilled!'); if (!$('lives').hidden) renderLives(); }
    if (p.noads) { adsOff = true; store.set('adsOff', true); toast('Ads removed. Thank you!'); }
    if (prizeKeys(p.give).length) giveReward(p.give, p.name + '!', true);
    updateHintUi(); if (!$('shop').hidden) openShop();
    return true;
  }
  window.CandokuGrant = grantPack;
  function buyPack(id) {
    const p = PACKS.find((x) => x.id === id); if (!p) return; if (p.once && owned[id]) { toast('You already have this'); return; }
    if (p.lives && (infOn() || livesNow() >= MAX_LIVES)) { toast('You are full of lives. Go play!'); return; }
    const nat = NATIVE();
    if (nat && nat.purchase) { Promise.resolve(nat.purchase(id)).then((done) => { if (done) grantPack(id); }).catch(() => toast('The purchase did not go through')); return; }
    if (DBG) { toast('(test) purchase approved'); setTimeout(() => grantPack(id), 600); return; }
    toast('Purchases open with the Bonbox app on Google Play');
  }
  function renderPacks() {
    const box = $('shopPacks'); if (!box) return; box.innerHTML = '';
    PACKS.forEach((p) => {
      const gone = p.once && owned[p.id], d = document.createElement('div'); d.className = 'pack' + (p.tag ? ' tagged' : '') + (gone ? ' gone' : '');
      d.innerHTML = (p.tag ? '<i class="ptag">' + p.tag + '</i>' : '') + '<img src="art/' + p.img + '.webp" alt="" draggable="false"><b>' + p.name + '</b><small>' + (p.noads ? 'Remove the ads forever' : p.lives ? 'Refill all 5 lives' : prizeChipsHtml(p.give)) + '</small>';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn main pbuy'; b.textContent = gone ? 'Owned ✓' : p.price; b.disabled = !!gone; b.onclick = () => { S.tap(); buyPack(p.id); }; d.appendChild(b); box.appendChild(d);
    });
    const fr = $('shopFree'); fr.innerHTML = '';
    [['+1 life', 'ic_heart', () => addLives(1), () => livesNow() < MAX_LIVES], ['+1 hint', 'ic_hint', () => giveReward({ hints: 1 }, 'Free hint!'), () => true], ['+3 coins', 'ic_coin', () => giveReward({ coins: 3 }, 'Free coins!'), () => true]].forEach((f) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'freeb'; b.innerHTML = '<img src="art/' + f[1] + '.webp" alt="" draggable="false"><b>' + f[0] + '</b><span>▶ Watch</span>'; b.disabled = !f[3]();
      b.onclick = () => { S.tap(); watchAd(() => { f[2](); renderPacks(); }); }; fr.appendChild(b);
    });
    $('shopAds').textContent = adAvailable() ? adsLeft() + ' videos left today' : 'Video rewards arrive with the app';
  }
  function openLives() {
    S.unlock(); S.tap(); renderLives(); $('lives').hidden = false;
  }
  function renderLives() {
    const n = livesNow(), full = n >= MAX_LIVES;
    $('livesRow').innerHTML = Array.from({ length: MAX_LIVES }, (x, i) => '<img src="art/ic_heart' + (i < n ? '' : '_off') + '.webp" alt="" draggable="false">').join('');
    $('livesMsg').textContent = infOn() ? 'Unlimited hearts are on!' : full ? 'You are full of lives. Go play!' : n === 0 ? 'No lives left. Next life in ' + fmtMS(nextLifeIn()) : 'Next life in ' + fmtMS(nextLifeIn());
    $('livesBuy').disabled = full || infOn(); $('livesAd').disabled = full; $('livesCoins').disabled = full || coins < 30; $('livesCoins').innerHTML = 'Refill all · 30 ' + coinSvg;
  }

  /* ---------- Candy Climb: a timed challenge. Press Start and you have 24 hours: every level you win lifts the bear one
     platform, every level you lose drops him one. Each platform holds a bigger prize; a golden chest waits on top. Once a day. ---------- */
  const CLIMB = [{ coins: 2 }, { inf: 15 }, { coins: 4 }, { hints: 1 }, { coins: 6 }, { inf: 30 }, { coins: 15, wands: 1 }], CLIMB_MS = 24 * 3600e3;
  let climb = Object.assign({ start: 0, step: 0, cl: [], day: '' }, store.get('climb', {}));
  const climbOn = () => climb.start > 0 && Date.now() < climb.start + CLIMB_MS;
  const climbLeft = () => Math.max(0, climb.start + CLIMB_MS - Date.now());
  const climbClaim = () => CLIMB.filter((x, i) => i < climb.step && !climb.cl[i]).length;
  const fmtClock = (ms) => { const t = Math.floor(ms / 1000), hh = Math.floor(t / 3600), mm = Math.floor((t % 3600) / 60), ss = t % 60; return hh + ':' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); };
  function climbWin() { if (!climbOn() || climb.step >= CLIMB.length) return; climb.step++; climb.moved = 1; store.set('climb', climb); }
  function climbLose() { if (!climbOn() || climb.step <= 0) return; climb.step--; climb.moved = -1; store.set('climb', climb); }
  function climbStart() {
    if (climbOn()) return; if (climb.day === today()) { toast('Candy Climb is back tomorrow'); return; }
    climb = { start: Date.now(), step: 0, cl: [], day: today(), moved: 0 }; store.set('climb', climb); S.unlock2(); buzz([20, 30, 40]); renderClimb(); updateSides();
  }
  function renderClimb() {
    const box = $('climbTrack'), on = climbOn(), n = CLIMB.length; box.innerHTML = '';
    const H = 74, top = 96, W = box.clientWidth || 270, px = (i) => W / 2 + (i % 2 ? 1 : -1) * W * 0.17, py = (i) => top + (n - 1 - i) * H + 40;
    box.style.height = (top + n * H + 60) + 'px';
    box.insertAdjacentHTML('beforeend', '<img class="cl-chest" src="art/3d_chest_large.webp" alt="" draggable="false" style="left:' + W / 2 + 'px;top:8px">');
    for (let i = 0; i < n; i++) {
      const reached = i < climb.step, done = !!climb.cl[i], d = document.createElement('div'); d.className = 'cl-plat' + (reached ? ' on' : '') + (done ? ' done' : ''); d.style.left = px(i) + 'px'; d.style.top = py(i) + 'px'; d.style.setProperty('--d', (i * 0.37 % 1.6).toFixed(2) + 's');
      d.innerHTML = '<img src="art/climb_plat.webp" alt="" draggable="false"><i>' + (i + 1) + '</i><span class="cl-prize">' + (done ? '✓' : prizeChipsHtml(CLIMB[i])) + '</span>';
      if (reached && !done) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn main cl-claim'; b.textContent = 'Claim'; b.onclick = () => { climb.cl[i] = true; store.set('climb', climb); giveReward(CLIMB[i], i === n - 1 ? 'Top of the climb!' : 'Candy Climb!', i === n - 1); renderClimb(); updateSides(); }; d.appendChild(b); }
      box.appendChild(d);
    }
    // the bear stands on the platform he reached (on the ground before the first one)
    const st = climb.step, bx = st ? px(st - 1) : W / 2, by = st ? py(st - 1) - 26 : top + n * H + 28, bear = document.createElement('img');
    bear.className = 'cl-bear'; bear.src = look.stand; bear.alt = ''; bear.draggable = false; bear.style.left = bx + 'px'; bear.style.top = by + 'px'; box.appendChild(bear);
    if (climb.moved && on) {                      // he hops in from the platform he came from
      const from = st - climb.moved, fx = from > 0 ? px(from - 1) : W / 2, fy = from > 0 ? py(from - 1) - 26 : top + n * H + 28, dx = fx - bx, dy = fy - by, kf = [];
      for (let k = 0; k <= 10; k++) { const u = k / 10; kf.push({ transform: 'translate(calc(-50% + ' + (dx * (1 - u)).toFixed(1) + 'px),calc(-100% + ' + (dy * (1 - u) - 60 * 4 * u * (1 - u)).toFixed(1) + 'px))', offset: u * 0.85 }); }
      kf.push({ transform: 'translate(-50%,-100%) scale(1.15,.82)', offset: 0.92 }, { transform: 'translate(-50%,-100%)', offset: 1 });
      bear.animate(kf, { duration: 800, delay: 350, fill: 'backwards' }); setTimeout(() => { if (climb.moved > 0) S.hop(); else S.wrong(); }, 350);
      climb.moved = 0; store.set('climb', climb);
    }
    $('climbInfo').innerHTML = on ? 'Play the normal levels on the map. <b>Every level you win</b> lifts the bear one platform, <b>every level you lose</b> drops him one. Come back here to claim the prizes. <b>' + st + ' / ' + n + '</b>'
      : climb.day === today() ? 'Today is over. A new climb opens tomorrow.' : 'A 24-hour challenge. Press Start, then play the normal levels: every win lifts the bear one platform to a bigger prize!';
    { const pb = $('climbPlay'); pb.hidden = !on; pb.textContent = 'Play level ' + level; }
    const b = $('climbStart'); b.hidden = on || climb.day === today(); $('climbTimer').hidden = !on; if (on) $('climbTimer').textContent = '⏱ ' + fmtClock(climbLeft());
    const sc = $('climbScroll'); if (sc) sc.scrollTop = Math.max(0, by - sc.clientHeight * 0.6);
  }
  function openClimb() { S.unlock(); S.tap(); closeAll(); $('climb').hidden = false; renderClimb(); }

  /* ---------- Sour Storm: every few days the Baron attacks for 24 hours; each level you win is a hit on him ---------- */
  const STORM_GOAL = 12, STORM_MS = 24 * 3600e3, STORM_REST = 72 * 3600e3, STORM_PRIZE = [[4, { coins: 5 }], [8, { coins: 5, hints: 1 }], [12, { coins: 10, wands: 1, inf: 15 }]];
  let storm = Object.assign({ start: 0, hits: 0, cl: [] }, store.get('storm', {})), stormTick = null;
  const stormOn = () => storm.start > 0 && Date.now() < storm.start + STORM_MS;
  const stormFree = () => !stormOn() && Date.now() > storm.start + STORM_REST;
  const stormClaim = () => (storm.start ? STORM_PRIZE.filter((p, i) => storm.hits >= p[0] && !storm.cl[i]).length : 0);
  function stormWin() { if (!stormOn() || storm.hits >= STORM_GOAL) return; storm.hits++; store.set('storm', storm); }
  function stormStart() { if (!stormFree()) return; storm = { start: Date.now(), hits: 0, cl: [] }; store.set('storm', storm); S.unlock2(); buzz([20, 30, 40]); renderStorm(); updateSides(); }
  function renderStorm() {
    const on = stormOn(), free = stormFree(), hp = STORM_GOAL - storm.hits, shown = on || stormClaim() > 0;
    $('stormBoss').src = 'art/boss_' + (!shown ? 'idle' : hp <= 0 ? 'lose' : hp <= 4 ? 'worried' : hp <= 8 ? 'hit' : 'idle') + '.webp';
    $('stormHp').style.width = (shown ? hp / STORM_GOAL * 100 : 100) + '%'; $('stormHpN').textContent = (shown ? hp : STORM_GOAL) + ' / ' + STORM_GOAL;
    $('stormInfo').textContent = shown && hp <= 0 ? 'You knocked him out! Claim your prizes.' : on ? 'Vinegar is storming Candy Land! Every level you win on the map is one hit. Knock him out before the time ends!'
      : free ? 'A 24-hour battle. Press Start, then win levels on the map: every win is one hit on Vinegar!' : 'Vinegar is hiding. He will be back in a few days.';
    const box = $('stormRows'); box.innerHTML = '';
    STORM_PRIZE.forEach((p, i) => {
      const d = document.createElement('div'), got = shown && storm.hits >= p[0], done = !!storm.cl[i]; d.className = 'stormrow' + (got ? ' got' : '');
      d.innerHTML = '<b>' + p[0] + ' hits</b><span class="rwd">' + prizeChips(p[1]) + '</span>';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn main buy'; b.textContent = done ? 'Claimed ✓' : 'Claim'; b.disabled = !got || done;
      b.onclick = () => { storm.cl[i] = true; store.set('storm', storm); giveReward(p[1], i === STORM_PRIZE.length - 1 ? 'Vinegar is defeated!' : 'Sour Storm!', i === STORM_PRIZE.length - 1); renderStorm(); updateSides(); };
      d.appendChild(b); box.appendChild(d);
    });
    $('stormStart').hidden = !free; $('stormPlay').hidden = !on || hp <= 0; $('stormPlay').textContent = 'Play level ' + Math.min(level, LAST_LEVEL);
    const t = $('stormTimer'); t.hidden = !on; if (on) t.textContent = '⏱ ' + fmtClock(STORM_MS - (Date.now() - storm.start));
  }
  function openStorm() { S.unlock(); S.tap(); closeAll(); $('storm').hidden = false; renderStorm(); clearInterval(stormTick); stormTick = setInterval(() => { if ($('storm').hidden) { clearInterval(stormTick); return; } const t = $('stormTimer'); if (stormOn()) t.textContent = '⏱ ' + fmtClock(STORM_MS - (Date.now() - storm.start)); else if (!t.hidden) renderStorm(); }, 1000); }

  /* ---------- Coin Rush: once a day, 30 minutes of double coins on level wins ---------- */
  let rush = store.get('rush', { until: 0, day: '' }), rushWas = false;
  const rushActive = () => Date.now() < rush.until;
  function updateRushTag() {
    const e = $('medRushTag'); if (!e) return;
    if (rushActive()) {
      const t = Math.ceil((rush.until - Date.now()) / 1000); e.textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); rushWas = true; $('medRush').classList.add('ready', 'live');
    } else { rushWas = false; $('medRush').classList.remove('live'); e.textContent = rush.day === today() ? 'Soon' : 'START'; $('medRush').classList.toggle('ready', rush.day !== today()); }
  }
  function startRush() {
    S.unlock(); S.tap();
    if (rushActive()) { toast('⚡ Coin Rush is on: double coins from every level you win!'); return; }
    if (rush.day === today()) { toast('Coin Rush is back tomorrow'); return; }
    rush = { until: Date.now() + 30 * 60e3, day: today() }; store.set('rush', rush); S.win(); buzz([20, 30, 40]);
    toast('⚡ Coin Rush! Double coins from level wins for 30 minutes'); updateRushTag();
  }

  /* ---------- prize items fly into the matching counter at the top ---------- */
  function flyItems(r) {
    if (!r || !r.p) return;
    const tgt = { hints: 'hintN', wands: 'wandN', inf: 'heartN', shield: 'shieldN', sweeper: 'walletMe', lens: 'walletMe', double: 'walletMe' }, keys = prizeKeys(r.p).filter((x) => x !== 'coins');
    keys.forEach((k, n) => {
      const from = [...$('rwItems').querySelectorAll('.rw-it')].filter((e) => e.querySelector('img[src*="ic_"]') && !e.querySelector('img[src*="ic_coin"]'))[n], img = from && from.querySelector('img'); if (!img) return;
      const a = img.getBoundingClientRect(); if (!a.width) return;
      const chip = $(tgt[k] || 'coinN'), tb = chip && chip.getBoundingClientRect(), ok = tb && tb.width > 0;
      const tx = ok ? tb.left + tb.width / 2 - 12 : innerWidth * 0.62, ty = ok ? tb.top + tb.height / 2 : 20;
      flyThing({ src: img.src, size: 46, sx: a.left + a.width / 2, sy: a.top + a.height / 2, tx, ty, hx: 0, hy: -34, delay: 80 + n * 140, dur: 820 }).then(() => {
        const c = chip && (chip.closest('.chip') || chip); if (c && ok) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
        S.ui('coin'); buzz(8); if (ok) plusText(tx + 12, ty + 30, '+' + r.p[k]);
      });
    });
  }

  /* ---------- two more mini-games ---------- */
  let quickT = 0, quickRaf = 0;
  function stopQuick() { clearInterval(quickT); cancelAnimationFrame(quickRaf); quickT = 0; }
  function quickOpen(title, info) {
    closeAll(); stopQuick(); $('quickTitle').textContent = title; $('quickInfo').textContent = info; $('quickMsg').textContent = ''; $('quickBody').innerHTML = ''; $('quickClose').textContent = 'Give up'; $('quickBar').style.width = '100%'; $('quick').hidden = false;
  }
  function quickEnd(msg, reward, extra) {
    // side-game prizes are half of what they were
    if (reward > 0) reward = Math.max(1, Math.floor(reward / 2)); if (extra && extra.inf) extra = Object.assign({}, extra, { inf: Math.ceil(extra.inf / 2) });
    stopQuick(); if (reward) { coinHold += reward; } if (reward) give({ coins: reward }, true); if (extra) give(extra);
    S.win(); buzz([20, 30, 50]); updateSides(); $('quickMsg').innerHTML = msg + ' +' + reward + ' ' + coinSvg + (extra ? ' · ' + prizeText(extra) : ''); $('quickClose').textContent = 'Done';
    if (reward) { updateHintUi(); setTimeout(() => flyCoins($('quickMsg'), reward, 0, true), 400); }
  }
  // Odd One Out: one candy is different, tap it. 6 boards, 30 seconds, a wrong tap costs 3 seconds.
  function startOdd() {
    freshDay(); if ((plays.odd || 0) >= MAX_PLAYS) return; plays.odd = (plays.odd || 0) + 1; store.set('plays', plays); updateSides();
    quickOpen('Odd One Out', 'Tap the candy that is different. Wrong taps cost 3 seconds.');
    const sizes = [3, 3, 4, 4, 5, 5]; let round = 0, score = 0, penalty = 0, over = false; const t0 = performance.now(), TOTAL = 30000;
    const fin = (win) => { if (over) return; over = true; quickEnd(win ? 'All found!' : 'Time! ' + score + ' / ' + sizes.length, Math.floor(score / 2), null); };
    const board = () => {
      const n = sizes[round], a = Math.floor(Math.random() * 10); let b = Math.floor(Math.random() * 9); if (b >= a) b++;
      const odd = Math.floor(Math.random() * n * n), g = document.createElement('div'); g.className = 'oddgrid'; g.style.gridTemplateColumns = 'repeat(' + n + ',1fr)';
      for (let i = 0; i < n * n; i++) {
        const c = document.createElement('button'); c.type = 'button'; c.className = 'oddc'; c.innerHTML = '<svg><use href="#c' + (i === odd ? b : a) + '"/></svg>';
        c.onclick = () => {
          if (over) return;
          if (i === odd) { score++; S.candy(round + 2, round + 2); buzz(10); round++; if (round >= sizes.length) return fin(true); show(); }
          else { penalty += 3000; S.wrong(); buzz(25); c.classList.add('shake'); }
        };
        g.appendChild(c);
      }
      return g;
    };
    const show = () => { $('quickBody').innerHTML = ''; $('quickBody').appendChild(board()); $('quickInfo').textContent = 'Board ' + (round + 1) + ' / ' + sizes.length; };
    show();
    const tick = () => { if (over) return; const left = TOTAL - (performance.now() - t0) - penalty; $('quickBar').style.width = Math.max(0, left / TOTAL * 100) + '%'; if (left <= 0) fin(false); else quickRaf = requestAnimationFrame(tick); };
    quickRaf = requestAnimationFrame(tick);
  }
  // Sugar Jars: a gumdrop drops in, tap the jar of the same colour before the bar runs out. 14 drops, 3 mistakes allowed.
  function startJars() {
    freshDay(); if ((plays.jars || 0) >= MAX_PLAYS) return; plays.jars = (plays.jars || 0) + 1; store.set('plays', plays); updateSides();
    quickOpen('Sugar Jars', 'Tap the jar with the same colour. 3 mistakes and it is over.');
    const cols = ['#22b8ff', '#ff52c8', '#ffd400', '#7ee21f'], JSW = [2, 6, 7, 4], body = $('quickBody'), TOT = 14; let n = 0, ok = 0, lives = 3, over = false, now = 0, tStart = 0, dur = 2400;
    body.innerHTML = '<div class="jdrop"><i id="jDrop"></i></div><div class="jars">' + cols.map((c, i) => '<button type="button" class="jar" data-i="' + i + '" style="--jc:' + c + '"><b></b><img src="art/sw_' + JSW[i] + '.webp" alt="" draggable="false"><u></u></button>').join('') + '</div>';
    const drop = $('jDrop');
    const fin = () => { if (over) return; over = true; quickEnd(ok >= TOT ? T('Perfect!') : ok + ' / ' + TOT + ' sorted', Math.floor(ok / 4), ok >= TOT ? { hints: 1 } : null); };
    const next = () => {
      if (over) return; if (n >= TOT) return fin();
      now = Math.floor(Math.random() * 4); drop.style.background = 'url(art/sw_' + JSW[now] + '.webp) center/contain no-repeat';
      dur = Math.max(1100, 2400 - n * 90); drop.classList.remove('fall'); void drop.offsetWidth; drop.style.animationDuration = dur + 'ms'; drop.classList.add('fall'); tStart = performance.now(); n++;
      $('quickInfo').textContent = 'Drop ' + n + ' / ' + TOT + ' · ❤️ ' + lives;
    };
    const miss = () => { lives--; S.wrong(); buzz(25); $('quickInfo').textContent = 'Drop ' + n + ' / ' + TOT + ' · ❤️ ' + lives; if (lives <= 0) return fin(); next(); };
    body.querySelectorAll('.jar').forEach((j) => {
      j.onclick = () => { if (over) return; if (+j.dataset.i === now) { ok++; S.candy(ok % 9, Math.min(8, ok)); buzz(10); j.classList.remove('pop'); void j.offsetWidth; j.classList.add('pop'); next(); } else miss(); };
    });
    next();
    const tick = () => { if (over) return; const left = 1 - (performance.now() - tStart) / dur; $('quickBar').style.width = Math.max(0, left * 100) + '%'; if (left <= 0) miss(); quickRaf = requestAnimationFrame(tick); };
    quickRaf = requestAnimationFrame(tick);
  }


  /* ---------- Events screen: every event and mini-game as a big glossy card ---------- */
  const GAMES = [['memory', 'Memory Match', 'ev_memory', '#2fc3f0', '#0b6f9c'], ['toss', 'Candy Toss', 'ev_toss', '#4fd163', '#1e7d33'], ['odd', 'Odd One Out', 'ev_odd', '#f2697a', '#a02335'], ['jars', 'Sugar Jars', 'ev_jars', '#6b98ff', '#2a46b5'],
    ['shoot', 'Candy Shooter', 'ev_shooter', '#2fd0cb', '#0d7f86'], ['hoop', 'Hoop Shot', 'ev_hoop', '#ffa83a', '#c4540a'], ['cart', 'Cart Race', 'ev_cart', '#c98a4d', '#6b3e17']];
  const gameWait = (k) => Math.max(0, GAME_CD - (Date.now() - ((plays.t || {})[k] || 0)));
  function playGame(k) {
    freshDay(); const left = MAX_PLAYS - (plays[k] || 0), wait = gameWait(k);
    if (left <= 0) { toast('Come back tomorrow for more plays'); return; }
    if (wait > 0) { toast('Ready in ' + fmtWait(wait)); return; }
    plays.t = plays.t || {}; plays.t[k] = Date.now(); store.set('plays', plays);
    ({ memory: startMemory, toss: startToss, odd: startOdd, jars: startJars, shoot: startShoot, hoop: startHoop, cart: startCart })[k]();
  }
  let evItems = [];
  function buildEventItems() {
    const passClaim = () => PASS.filter((x, i) => i < pass.step && !pass.cl[i]).length;
    evItems = [
      { name: 'Candy Pass', img: 'ev_pass', a: '#ff6fb4', b: '#a02a8c', tag: () => passClaim() ? 'CLAIM ' + passClaim() : pass.step + ' / ' + PASS.length + ' steps', hot: () => passClaim() > 0, go: openPass },
      { name: 'Candy Chest', img: () => chestImg(chest.q ? chest.q.tier : chestTier()).replace('art/', '').replace('.webp', ''), a: '#c98a4d', b: '#6b3e17', tag: () => chest.q ? (chestLeft() <= 0 ? 'OPEN!' : '⏳ ' + fmtWait(chestLeft())) : chest.n >= CHEST_AT ? 'START' : chest.n + ' / ' + CHEST_AT, hot: () => chest.q ? chestLeft() <= 0 : chest.n >= CHEST_AT, go: openChest },
      { name: 'Lucky Wheel', img: 'ic_wheel', a: '#b58aff', b: '#5a2fb8', tag: () => (wheel.date !== today() || wheel.extra > 0) ? 'FREE SPIN' : 'Soon', hot: () => wheel.date !== today() || wheel.extra > 0, go: openWheel },
      { name: 'Candy Climb', img: 'ev_climb', a: '#ff7ac4', b: '#7a2bd0', tag: () => climbOn() ? (climbClaim() ? 'CLAIM ' + climbClaim() : '⏱ ' + fmtClock(climbLeft())) : climb.day === today() ? 'Back tomorrow' : 'START', hot: () => (climbOn() && climbClaim() > 0) || (!climbOn() && climb.day !== today()), go: openClimb },
      { name: 'Sour Storm', img: 'boss_idle', a: '#8a6cff', b: '#2a1458', tag: () => stormOn() ? (stormClaim() ? 'CLAIM ' + stormClaim() : '⏱ ' + fmtClock(STORM_MS - (Date.now() - storm.start))) : stormClaim() ? 'CLAIM ' + stormClaim() : stormFree() ? 'START' : 'Soon', hot: () => stormClaim() > 0 || stormFree(), go: openStorm },
      { name: 'Coin Rush', img: 'ev_rush', a: '#ffd23a', b: '#d9780a', tag: () => rushActive() ? '⚡ ' + Math.ceil((rush.until - Date.now()) / 60000) + ' min left' : rush.day === today() ? 'Back tomorrow' : 'START', hot: () => rushActive() || rush.day !== today(), go: () => { startRush(); refreshEvents(); } }
    ].concat(GAMES.map((g) => ({ name: g[1], img: g[2], a: g[3], b: g[4], key: g[0],
      tag: () => { const l = MAX_PLAYS - (plays[g[0]] || 0), w = gameWait(g[0]); return l <= 0 ? 'Back tomorrow' : w > 0 ? '⏳ ' + fmtWait(w) : 'PLAY · ' + l + ' left'; },
      hot: () => (MAX_PLAYS - (plays[g[0]] || 0)) > 0 && gameWait(g[0]) <= 0, dim: () => (MAX_PLAYS - (plays[g[0]] || 0)) <= 0 || gameWait(g[0]) > 0, go: () => playGame(g[0]) })));
  }
  function eventsHot() {
    const passClaim = PASS.filter((x, i) => i < pass.step && !pass.cl[i]).length;
    return (passClaim ? 1 : 0) + ((chest.q ? chestLeft() <= 0 : chest.n >= CHEST_AT) ? 1 : 0) + ((wheel.date !== today() || wheel.extra > 0) ? 1 : 0) + (!rushActive() && rush.day !== today() ? 1 : 0) + ((climbOn() && climbClaim() > 0) || (!climbOn() && climb.day !== today()) ? 1 : 0) + (stormClaim() > 0 || stormFree() ? 1 : 0);
  }
  function renderEvents() {
    freshDay(); buildEventItems(); const grid = $('evGrid'); grid.innerHTML = '';
    evItems.forEach((o) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'evcard'; b.style.setProperty('--a', o.a); b.style.setProperty('--b', o.b);
      b.innerHTML = '<span class="evart"><img alt="" draggable="false"></span><b>' + o.name + '</b><em></em>'; o.el = b; b.onclick = () => { S.unlock(); S.tap(); o.go(); }; grid.appendChild(b);
    });
    refreshEvents();
  }
  function refreshEvents() {
    evItems.forEach((o) => {
      if (!o.el) return; const im = o.el.querySelector('img'), src = 'art/' + (typeof o.img === 'function' ? o.img() : o.img) + '.webp'; if (im.getAttribute('src') !== src) im.src = src;
      o.el.querySelector('em').textContent = o.tag(); o.el.classList.toggle('hot', !!o.hot()); o.el.classList.toggle('dim', !!(o.dim && o.dim()));
    });
  }
  function openEvents() { setTimeout(() => { loadArc(); loadHoop(); }, 600); S.unlock(); S.tap(); closeAll(); renderEvents(); $('events').hidden = false; }

  /* ---------- canvas helpers shared by the new arcade mini-games ---------- */
  let quickKey = null;
  document.addEventListener('keydown', (e) => { if (quickKey && !$('quick').hidden) quickKey(e); });
  function quickCanvas() {
    const K = Math.max(2, Math.min(3, Math.ceil(window.devicePixelRatio || 1)));   // draw at 2-3x so nothing is blurry
    const body = $('quickBody'); body.innerHTML = '<canvas class="qcv" width="' + 300 * K + '" height="' + 360 * K + '"></canvas>'; const cv = body.firstChild;
    const xy = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 300 / r.width, (e.clientY - r.top) * 360 / r.height]; };
    const g = cv.getContext('2d'); g.setTransform(K, 0, 0, K, 0, 0); g.imageSmoothingQuality = 'high';
    return { cv, g, xy };
  }
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const glossBall = (g, x, y, r, c, dark) => {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r * 1.05); gr.addColorStop(0, '#fff'); gr.addColorStop(0.28, c); gr.addColorStop(1, dark);
    g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fillStyle = gr; g.fill(); g.lineWidth = 1.6; g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke();
    g.beginPath(); g.ellipse(x - r * 0.38, y - r * 0.42, r * 0.3, r * 0.18, -0.6, 0, 6.283); g.fillStyle = 'rgba(255,255,255,.85)'; g.fill();
  };

  // artwork for the arcade mini-games (made in Overchat)
  const arcArt = {};
  function loadArc() { if (arcArt.coin) return; [['shoot_bg', 'jpg'], ['shoot_cannon', 'webp'], ['shoot_ball', 'webp'], ['shoot_ball_y', 'webp'], ['shoot_ball_b', 'webp'], ['shoot_ball_g', 'webp'], ['shoot_hole', 'webp'], ['cart_bg', 'jpg'], ['cart_rock', 'webp'], ['cart_bear', 'webp'], ['cart_rival', 'webp']].forEach((f) => { const im = new Image(); im.src = 'art/' + f[0] + '.' + f[1]; arcArt[f[0]] = im; }); const im = new Image(); im.src = 'art/ic_coin.webp'; arcArt.coin = im; }
  /* ---------- Candy Shooter: a Zuma-style chain of gumdrops; shoot matching colours to pop them ---------- */
  function startShoot() {
    loadArc();
    freshDay(); if ((plays.shoot || 0) >= MAX_PLAYS) return; plays.shoot = (plays.shoot || 0) + 1; store.set('plays', plays); updateSides();
    quickOpen('Candy Shooter', 'Tap to shoot. Match 3 or more to pop them before they reach the hole!');
    const { cv, g, xy } = quickCanvas();
    const COLS = ['#ff3d6e', '#ffd21f', '#34a8ff', '#4fdc4a'], COLD = ['#a8123a', '#c28a00', '#0e5fb3', '#1f8f1c'], R = 10, D = 21, N = 26, CX = 122, CY = 182;
    let pts = [[-24, 48], [262, 48], [262, 322], [40, 322], [40, 96], [204, 96], [204, 272], [112, 272]];
    for (let it = 0; it < 4; it++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(pts[pts.length - 1]); pts = o; }
    const seg = []; let L = 0; for (let i = 0; i < pts.length - 1; i++) { const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy) || 0.001; seg.push({ x: pts[i][0], y: pts[i][1], dx, dy, l, s0: L }); L += l; }
    const at = (s) => { s = Math.max(0, Math.min(L - 0.01, s)); let k = 0; while (k < seg.length - 1 && seg[k + 1].s0 <= s) k++; const q = seg[k], t = (s - q.s0) / q.l; return { x: q.x + q.dx * t, y: q.y + q.dy * t, tx: q.dx / q.l, ty: q.dy / q.l }; };
    const chain = []; for (let i = 0; i < N; i++) { let c; do { c = Math.floor(Math.random() * COLS.length); } while (i >= 2 && chain[i - 1].c === c && chain[i - 2].c === c); chain.push({ c, off: 0, grow: 1 }); }
    let head = 10, shot = null, ang = -Math.PI / 2, over = false, popped = 0, cool = 0, combo = 0, last = performance.now(); const parts = [], texts = [];
    const pick = () => { const pr = [...new Set(chain.map((b) => b.c))]; return pr.length ? pr[Math.floor(Math.random() * pr.length)] : 0; };
    let nextC = pick();
    const sPos = (i) => head - i * D + chain[i].off;
    const burst = (x, y, c) => { for (let k = 0; k < 9; k++) { const a = Math.random() * 6.283, v = 50 + Math.random() * 110; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, l: 0.55, c }); } };
    const finish = (win) => { if (over) return; over = true; quickEnd(win ? 'Cleared!' : 'They got through! ' + popped + ' popped', win ? 4 : Math.min(2, Math.floor(popped / 12)), win ? { inf: 15 } : null); };
    const resolve = (k) => {
      combo = 0;
      for (;;) {
        const c = chain[k].c; let a = k, b = k; while (a > 0 && chain[a - 1].c === c) a--; while (b < chain.length - 1 && chain[b + 1].c === c) b++;
        const n = b - a + 1; if (n < 3) break;
        let mx = 0, my = 0; for (let j = a; j <= b; j++) { const p = at(sPos(j)); burst(p.x, p.y, COLS[c]); mx = p.x; my = p.y; }
        popped += n; combo++; S.candy(popped % 9, Math.min(8, 1 + combo * 2)); buzz(12); texts.push({ t: n >= 5 ? T('Amazing!') : combo > 1 ? T('Combo x') + combo + '!' : T('Pop!'), x: mx, y: my, a: 1 });
        chain.splice(a, n); for (let j = a; j < chain.length; j++) chain[j].off -= n * D;
        if (a > 0 && a < chain.length && chain[a - 1].c === chain[a].c) { k = a; continue; } break;
      }
    };
    const aim = (e) => { const [px, py] = xy(e); ang = Math.atan2(py - CY, px - CX); };
    cv.onpointermove = aim;
    cv.onpointerdown = (e) => { aim(e); if (over || shot || cool > 0 || !chain.length) return; const cs = Math.cos(ang), sn = Math.sin(ang); shot = { x: CX + cs * 30, y: CY + sn * 30, vx: cs * 560, vy: sn * 560, c: nextC }; nextC = pick(); cool = 0.12; S.tap(); buzz(6); };
    const draw = () => {
      const A = arcArt, ok = (im) => im && im.complete && im.naturalWidth;
      if (ok(A.shoot_bg)) g.drawImage(A.shoot_bg, -30, 0, 360, 360); else { g.fillStyle = '#d99a3a'; g.fillRect(0, 0, 300, 360); }
      // the groove the candies roll in
      g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.lineWidth = 30; g.strokeStyle = 'rgba(70,30,0,.55)'; g.stroke(); g.lineWidth = 25; g.strokeStyle = '#8a4a16'; g.stroke(); g.lineWidth = 19; g.strokeStyle = '#6b360c'; g.stroke();
      g.lineWidth = 2; g.strokeStyle = 'rgba(255,220,160,.35)'; g.setLineDash([3, 13]); g.stroke(); g.setLineDash([]);
      const hp = at(L), danger = chain.length && sPos(0) > L - 140, hs = 50 + (danger ? Math.sin(performance.now() / 90) * 4 : 0);
      if (ok(A.shoot_hole)) { g.save(); g.translate(hp.x, hp.y); g.rotate(performance.now() / 900); g.drawImage(A.shoot_hole, -hs / 2, -hs / 2, hs, hs); g.restore(); } else { g.beginPath(); g.arc(hp.x, hp.y, 20, 0, 6.283); g.fillStyle = '#1a1030'; g.fill(); }
      if (danger) { g.globalAlpha = 0.35 + 0.3 * Math.sin(performance.now() / 110); g.strokeStyle = '#ff3355'; g.lineWidth = 4; g.beginPath(); g.arc(hp.x, hp.y, 29, 0, 6.283); g.stroke(); g.globalAlpha = 1; }
      const BK = ['shoot_ball', 'shoot_ball_y', 'shoot_ball_b', 'shoot_ball_g'];
      const ballAt = (c, x, y, rad, rot) => { const im = A[BK[c]]; g.fillStyle = 'rgba(40,15,0,.3)'; g.beginPath(); g.ellipse(x + 2, y + rad * 0.75, rad * 0.9, rad * 0.4, 0, 0, 6.283); g.fill(); if (ok(im)) { g.save(); g.translate(x, y); g.rotate(rot || 0); g.drawImage(im, -rad, -rad, rad * 2, rad * 2); g.restore(); } else glossBall(g, x, y, rad, COLS[c], COLD[c]); };
      for (let i = chain.length - 1; i >= 0; i--) { const sp = sPos(i); if (sp < 4) continue; const p = at(sp); ballAt(chain[i].c, p.x, p.y, (R + 1) * (chain[i].grow < 1 ? 0.4 + chain[i].grow * 0.6 : 1), sp / 11); }
      // aim line and the cannon
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.setLineDash([4, 7]); g.beginPath(); g.moveTo(CX + Math.cos(ang) * 44, CY + Math.sin(ang) * 44); g.lineTo(CX + Math.cos(ang) * 120, CY + Math.sin(ang) * 120); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(40,15,0,.3)'; g.beginPath(); g.ellipse(CX + 3, CY + 8, 30, 26, 0, 0, 6.283); g.fill();
      const rec = cool > 0 ? cool / 0.12 * 5 : 0;
      if (ok(A.shoot_cannon)) { g.save(); g.translate(CX, CY); g.rotate(ang); g.drawImage(A.shoot_cannon, -29 - rec, -27, 78, 53.5); g.restore(); }
      { // the loaded candy: bigger, on a bright plate with a pulsing ring, so its colour is clear against the cannon
        const pu = 0.5 + 0.5 * Math.sin(performance.now() / 260);
        g.save(); g.shadowColor = '#fff'; g.shadowBlur = 14; g.fillStyle = '#fff'; g.beginPath(); g.arc(CX, CY, 15.5, 0, 6.283); g.fill(); g.restore();
        g.strokeStyle = COLD[nextC]; g.lineWidth = 2.5; g.beginPath(); g.arc(CX, CY, 15.5, 0, 6.283); g.stroke();
        g.globalAlpha = 0.75 - pu * 0.55; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(CX, CY, 18 + pu * 6, 0, 6.283); g.stroke(); g.globalAlpha = 1;
        ballAt(nextC, CX, CY, 13, 0);
      }
      if (shot) ballAt(shot.c, shot.x, shot.y, R + 1, performance.now() / 60);
      parts.forEach((p) => { g.globalAlpha = Math.max(0, p.l / 0.55); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 3.4, 0, 6.283); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x - 1, p.y - 1, 1.2, 0, 6.283); g.fill(); }); g.globalAlpha = 1;
      texts.forEach((t) => { g.globalAlpha = Math.max(0, t.a); g.font = '900 22px Nunito,sans-serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#5a2a00'; g.strokeText(t.t, t.x, t.y); g.fillStyle = '#ffe14d'; g.fillText(t.t, t.x, t.y); }); g.globalAlpha = 1;
    };
    const tick = (now) => {
      if (over) return; const dt = Math.min(0.05, (now - last) / 1000); last = now;
      cool = Math.max(0, cool - dt);
      const fast = chain.length && (sPos(chain.length - 1) < 30 || sPos(0) < 90); head += (fast ? 80 : 14) * dt;
      chain.forEach((b) => { if (b.off) { const st = 170 * dt; b.off = Math.abs(b.off) <= st ? 0 : b.off - Math.sign(b.off) * st; } if (b.grow < 1) b.grow = Math.min(1, b.grow + dt * 5); });
      if (shot) {
        shot.x += shot.vx * dt; shot.y += shot.vy * dt;
        let hit = -1, best = 1e9; for (let i = 0; i < chain.length; i++) { const s = sPos(i); if (s < 6) continue; const p = at(s), d = Math.hypot(shot.x - p.x, shot.y - p.y); if (d < D * 0.9 && d < best) { best = d; hit = i; } }
        if (hit >= 0) { const p = at(sPos(hit)), ahead = (shot.x - p.x) * p.tx + (shot.y - p.y) * p.ty > 0, k = ahead ? hit : hit + 1; chain.splice(k, 0, { c: shot.c, off: 0, grow: 0.3 }); for (let j = k + 1; j < chain.length; j++) chain[j].off += D; shot = null; resolve(k); }
        else if (shot.x < -30 || shot.x > 330 || shot.y < -30 || shot.y > 390) shot = null;
      }
      parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.l -= dt; }); for (let i = parts.length - 1; i >= 0; i--) if (parts[i].l <= 0) parts.splice(i, 1);
      texts.forEach((t) => { t.y -= 28 * dt; t.a -= dt * 0.9; }); for (let i = texts.length - 1; i >= 0; i--) if (texts[i].a <= 0) texts.splice(i, 1);
      $('quickBar').style.width = (chain.length / N * 100) + '%'; $('quickInfo').textContent = 'Popped ' + popped + ' · left ' + chain.length;
      draw();
      if (!chain.length) return finish(true);
      if (sPos(0) >= L - 4) { S.wrong(); buzz([30, 40, 60]); return finish(false); }
      quickRaf = requestAnimationFrame(tick);
    };
    quickRaf = requestAnimationFrame((t) => { last = t; tick(t); });
  }

  /* ---------- Hoop Shot: an arcade machine with a 4x4 board of hoops. Pull the ball back like a slingshot, aim with the
     dotted path, let go. Fill hoops; a full line of four is a bonus. 12 balls. ---------- */
  const hoopArt = {};
  function loadHoop() { if (hoopArt.hoop_ring) return; ['hoop_machine.jpg', 'hoop_ring.webp', 'hoop_ball_g.webp', 'hoop_ball_r.webp'].forEach((f) => { const im = new Image(); im.src = 'art/' + f; hoopArt[f.split('.')[0]] = im; }); }
  function startHoop() {
    loadHoop();
    freshDay(); if ((plays.hoop || 0) >= MAX_PLAYS) return; plays.hoop = (plays.hoop || 0) + 1; store.set('plays', plays); updateSides();
    quickOpen('Hoop Shot', 'Pull the ball back, aim, and let go. Fill the hoops!');
    const { cv, g, xy } = quickCanvas();
    const BALLS = 12, SX = 150, SY = 330, TOPY = 88, BOTY = 268;
    const rowT = [0.13, 0.38, 0.63, 0.88], sc = (t) => 0.74 + 0.36 * t, halfW = (t) => 103 + 42 * t;
    const rings = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const t = rowT[r]; rings.push({ r, c, x: 151 + (c - 1.5) * halfW(t) * 0.46, y: TOPY + (BOTY - TOPY) * t, s: sc(t), ball: null, glow: 0, drop: 0 }); }
    let left = BALLS, filled = 0, lines = 0, drag = null, ball = null, over = false, last = performance.now(), tNow = 0, shake = 0; const doneLines = {}, parts = [], texts = [], loose = [];
    const kindOf = (n) => (n % 2 ? 'hoop_ball_r' : 'hoop_ball_g');
    const target = (d) => { const px = Math.max(-70, Math.min(70, d.x - SX)), py = Math.max(0, Math.min(96, d.y - SY)); return { x: SX - px * 2.5, y: SY - 52 - py * 2.25, pull: py }; };
    const drawBall = (k, x, y, rad, rot) => { const im = hoopArt[k]; g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (im.complete && im.naturalWidth) g.drawImage(im, -rad, -rad, rad * 2, rad * 2); else glossBall(g, 0, 0, rad, '#4fdc4a', '#1f8f1c'); g.restore(); };
    const ringGeo = (q) => { const w = 46 * q.s, h = w * 188 / 200; return { w, h, x: q.x - w / 2, y: q.y - h * 0.27 }; };
    const drawRing = (q, part) => {           // part 0 = whole, 1 = only the front (lower) half, drawn over a ball that sits in the hoop
      const im = hoopArt.hoop_ring, o = ringGeo(q); if (!(im.complete && im.naturalWidth)) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.ellipse(q.x, q.y, 20 * q.s, 8 * q.s, 0, 0, 6.283); g.stroke(); return; }
      if (!part) g.drawImage(im, o.x, o.y, o.w, o.h); else { const cut = 0.27; g.drawImage(im, 0, im.naturalHeight * cut, im.naturalWidth, im.naturalHeight * (1 - cut), o.x, o.y + o.h * cut, o.w, o.h * (1 - cut)); }
    };
    const burst = (x, y, col, n) => { for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, v = 40 + Math.random() * 120; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, l: 0.6, c: col[k % col.length] }); } };
    const say = (t, x, y, c, big) => texts.push({ t, x, y, a: 1.3, c, big });
    const checkLines = () => {
      const sets = []; for (let i = 0; i < 4; i++) { sets.push(['r' + i, rings.filter((q) => q.r === i)]); sets.push(['c' + i, rings.filter((q) => q.c === i)]); }
      sets.push(['d0', rings.filter((q) => q.r === q.c)], ['d1', rings.filter((q) => q.r + q.c === 3)]);
      sets.forEach(([id, qs]) => { if (!doneLines[id] && qs.every((q) => q.ball)) { doneLines[id] = 1; lines++; qs.forEach((q) => { q.glow = 1.6; burst(q.x, q.y, ['#ffe14d', '#fff', '#ffb347'], 8); }); say(T('LINE!'), 150, 150, '#ffe14d', 1); S.fanfare(); buzz([20, 30, 50]); shake = 0.3; } });
    };
    const finish = () => { if (over) return; over = true; const full = filled >= 16; quickEnd(filled + ' hoops · ' + lines + ' line' + (lines === 1 ? '' : 's'), Math.floor(filled / 4) + lines, full ? { hints: 1, inf: 15 } : lines >= 3 ? { inf: 15 } : null); };
    cv.onpointerdown = (e) => { if (over || ball) return; const [x, y] = xy(e); try { cv.setPointerCapture(e.pointerId); } catch (_) {} drag = { x, y: Math.max(SY, y) }; };
    cv.onpointermove = (e) => { if (!drag) return; const [x, y] = xy(e); drag.x = x; drag.y = y; };
    const release = () => {
      if (!drag) return; const tg = target(drag); drag = null; if (tg.pull < 8 || over) return;
      ball = { k: kindOf(BALLS - left), t: 0, tx: tg.x, ty: tg.y, x: SX, y: SY, rad: 19, rot: 0, st: 'fly' }; left--; S.whoosh(); buzz(8);
    };
    cv.onpointerup = release; cv.onpointercancel = () => { drag = null; };
    const pathAt = (tg, u) => { const tt = Math.max(0, Math.min(1, (tg.y - TOPY) / (BOTY - TOPY))), endR = 13.5 * sc(tt); return { x: SX + (tg.x - SX) * u, y: SY + (tg.y - SY) * u - (70 + (SY - tg.y) * 0.32) * 4 * u * (1 - u), rad: 19 + (endR - 19) * u }; };
    const draw = () => {
      g.save(); if (shake > 0) g.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
      const m = hoopArt.hoop_machine; g.fillStyle = '#231a52'; g.fillRect(0, 0, 300, 360); if (m.complete && m.naturalWidth) g.drawImage(m, 0, 0, 300, 300);
      const tr = g.createLinearGradient(0, 296, 0, 360); tr.addColorStop(0, '#7a1420'); tr.addColorStop(0.25, '#c0252f'); tr.addColorStop(1, '#5a0d16'); g.fillStyle = tr; g.fillRect(0, 296, 300, 64);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(SX, SY + 17, 30, 8, 0, 0, 6.283); g.fill();
      // scoreboard
      g.textAlign = 'center'; g.fillStyle = '#7a3a06'; g.font = '900 17px Nunito,sans-serif'; g.fillText(filled + ' / 16', 96, 44); g.font = '900 10px Nunito,sans-serif'; g.fillText(T('HOOPS'), 96, 56);
      g.font = '900 17px Nunito,sans-serif'; g.fillText(String(lines), 150, 44); g.font = '900 10px Nunito,sans-serif'; g.fillText(T('LINES'), 150, 56);
      g.font = '900 17px Nunito,sans-serif'; g.fillText(String(left), 204, 44); g.font = '900 10px Nunito,sans-serif'; g.fillText(T('BALLS'), 204, 56);
      // hoops, far rows first; a ball in flight is drawn at the depth of its row
      const flyRow = ball && ball.st === 'fly' ? -1 : 9;
      rings.forEach((q) => {
        if (q.glow > 0) { g.globalAlpha = Math.min(1, q.glow); const gl = g.createRadialGradient(q.x, q.y, 2, q.x, q.y, 34 * q.s); gl.addColorStop(0, 'rgba(255,240,140,.95)'); gl.addColorStop(1, 'rgba(255,220,80,0)'); g.fillStyle = gl; g.beginPath(); g.arc(q.x, q.y, 34 * q.s, 0, 6.283); g.fill(); g.globalAlpha = 1; }
        g.fillStyle = 'rgba(90,40,0,.25)'; g.beginPath(); g.ellipse(q.x + 3, q.y + 20 * q.s, 20 * q.s, 6 * q.s, 0, 0, 6.283); g.fill();
        drawRing(q, 0);
        if (q.ball) { const dy = 7 * q.s - Math.abs(Math.sin(q.drop * 9)) * q.drop * 10; drawBall(q.ball, q.x, q.y + dy, 13.5 * q.s, 0); drawRing(q, 1); }
      });
      loose.forEach((b) => drawBall(b.k, b.x, b.y, b.rad, b.rot));
      // aim
      if (drag && !ball) {
        const tg = target(drag), px = Math.max(-70, Math.min(70, drag.x - SX)), py = Math.max(0, Math.min(96, drag.y - SY));
        if (tg.pull >= 8) { for (let n = 1; n <= 11; n++) { const p = pathAt(tg, n / 11); g.globalAlpha = 0.35 + 0.55 * (n / 11); g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, 2.2 + n * 0.16, 0, 6.283); g.fill(); } g.globalAlpha = 1;
          const onq = rings.find((q) => !q.ball && Math.hypot((tg.x - q.x) / (20 * q.s), (tg.y - q.y) / (11 * q.s)) < 0.62);
          g.strokeStyle = onq ? '#7dff5a' : '#fff'; g.lineWidth = onq ? 3.5 : 2.5; g.setLineDash(onq ? [] : [5, 4]); g.beginPath(); g.ellipse(tg.x, tg.y, onq ? 18 : 15, onq ? 7.5 : 6, 0, 0, 6.283); g.stroke(); g.setLineDash([]); }
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.beginPath(); g.moveTo(SX - 34, SY - 8); g.lineTo(SX + px * 0.55, SY + py * 0.3); g.lineTo(SX + 34, SY - 8); g.stroke();
        drawBall(kindOf(BALLS - left), SX + px * 0.55, SY + py * 0.3, 19, 0);
      } else if (!ball && left > 0) { drawBall(kindOf(BALLS - left), SX, SY + Math.sin(tNow * 3) * 2, 19, 0); if (left === BALLS) { g.globalAlpha = 0.6 + 0.4 * Math.sin(tNow * 4); g.fillStyle = '#fff'; g.font = '900 12px Nunito,sans-serif'; g.textAlign = 'center'; g.fillText(T('▼ pull down ▼'), SX, 312); g.globalAlpha = 1; } }
      if (ball) { g.fillStyle = 'rgba(60,20,0,.22)'; const u = Math.min(1, ball.t); g.beginPath(); g.ellipse(SX + (ball.tx - SX) * u, SY + (ball.ty - SY) * u + 10, ball.rad * 0.9, ball.rad * 0.3, 0, 0, 6.283); g.fill(); drawBall(ball.k, ball.x, ball.y, ball.rad, ball.rot); }
      parts.forEach((p) => { g.globalAlpha = Math.max(0, p.l / 0.6); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 3, 0, 6.283); g.fill(); }); g.globalAlpha = 1;
      texts.forEach((t) => { g.globalAlpha = Math.max(0, Math.min(1, t.a)); g.font = '900 ' + (t.big ? 34 : 20) + 'px Nunito,sans-serif'; g.textAlign = 'center'; g.lineWidth = t.big ? 7 : 4; g.strokeStyle = '#5a2a00'; g.strokeText(t.t, t.x, t.y); g.fillStyle = t.c; g.fillText(t.t, t.x, t.y); }); g.globalAlpha = 1;
      g.restore();
    };
    const tick = (now) => {
      if (over) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; tNow += dt; shake = Math.max(0, shake - dt);
      if (ball) {
        ball.t += dt / 0.62; ball.rot += dt * 5; const tg = { x: ball.tx, y: ball.ty }, p = pathAt(tg, Math.min(1, ball.t)); ball.x = p.x; ball.y = p.y; ball.rad = p.rad;
        if (ball.t >= 1) {
          let best = null, bd = 9; rings.forEach((q) => { const d = Math.hypot((ball.tx - q.x) / (20 * q.s), (ball.ty - q.y) / (11 * q.s)); if (d < bd) { bd = d; best = q; } });
          if (best && bd < 0.62 && !best.ball) { best.ball = ball.k; best.drop = 1; filled++; burst(best.x, best.y, ['#fff', '#ffe14d', ball.k.endsWith('r') ? '#ff4d7a' : '#7ee21f'], 12); say(bd < 0.22 ? T('Perfect!') : T('Swish!'), best.x, best.y - 26, '#fff'); S.candy(filled % 9, Math.min(8, 2 + filled)); buzz([10, 20, 20]); checkLines(); }
          else { const side = best ? Math.sign(ball.tx - best.x) || 1 : 1, onBoard = ball.ty > TOPY - 6 && ball.ty < BOTY + 14 && Math.abs(ball.tx - 151) < 150; loose.push({ k: ball.k, x: ball.x, y: ball.y, rad: ball.rad, rot: ball.rot, vx: side * (best && bd < 1.5 ? 70 : 20), vy: best && bd < 1.5 ? -150 : -40, life: 0 }); if (best && bd < 1.5) { say(best.ball ? T('Taken!') : T('Rim!'), ball.x, ball.y - 20, '#fff'); S.x(); buzz(14); } else { S.wrong(); } if (!onBoard) loose[loose.length - 1].vy = 60; }
          ball = null; if (left <= 0 || filled >= 16) setTimeout(finish, 1100);
        }
      }
      loose.forEach((b) => { b.vy += 520 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += dt * 7; b.rad = Math.min(20, b.rad + dt * 5); b.life += dt; }); for (let i = loose.length - 1; i >= 0; i--) if (loose[i].y > 400) loose.splice(i, 1);
      rings.forEach((q) => { q.glow = Math.max(0, q.glow - dt); q.drop = Math.max(0, q.drop - dt * 2.2); });
      parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.l -= dt; }); for (let i = parts.length - 1; i >= 0; i--) if (parts[i].l <= 0) parts.splice(i, 1);
      texts.forEach((t) => { t.y -= 24 * dt; t.a -= dt * 1.1; }); for (let i = texts.length - 1; i >= 0; i--) if (texts[i].a <= 0) texts.splice(i, 1);
      $('quickBar').style.width = (left / BALLS * 100) + '%'; $('quickInfo').textContent = 'Balls ' + left + ' · hoops ' + filled + ' · lines ' + lines;
      draw(); quickRaf = requestAnimationFrame(tick);
    };
    quickRaf = requestAnimationFrame((t) => { last = t; tick(t); });
  }

  /* ---------- Cart Race: switch lanes, dodge rocks, grab coins, beat the rival to the finish ---------- */
  function startCart() {
    loadArc();
    freshDay(); if ((plays.cart || 0) >= MAX_PLAYS) return; plays.cart = (plays.cart || 0) + 1; store.set('plays', plays); updateSides();
    quickOpen('Cart Race', 'Hold the cart and drag it left or right. Dodge rocks, grab coins, beat the rival!');
    const { cv, g } = quickCanvas(); const bear = new Image(); bear.src = look.stand;
    const LANES = [66, 150, 228], CART_Y = 292, GOAL = 900; let tx = 150, cx = 150, dist = 0, v = 0, rival = 0, got = 0, shake = 0, items = [], nextSpawn = 8, scroll = 0, over = false, last = performance.now(), t = 0; const texts = [];
    // drag the cart with your finger: it follows left and right freely (no lanes to tap)
    const setX = (e) => { const r = cv.getBoundingClientRect(); tx = Math.max(46, Math.min(254, (e.clientX - r.left) * 300 / r.width)); };
    cv.onpointerdown = (e) => { try { cv.setPointerCapture(e.pointerId); } catch (_) {} setX(e); };
    cv.onpointermove = (e) => { if (e.pressure > 0 || e.buttons) setX(e); };
    quickKey = (e) => { if (e.key === 'ArrowLeft' || e.key === 'a') tx = Math.max(46, tx - 60); if (e.key === 'ArrowRight' || e.key === 'd') tx = Math.min(254, tx + 60); };
    if (location.search.includes('dbg')) window.__cart = () => ({ cx, tx, v, dist, t });
    const finish = (win) => { if (over) return; over = true; quickKey = null; quickEnd(win ? 'You won the race!' : 'The rival won this time', Math.min(2, Math.floor(got / 6)) + (win ? 2 : 0), null); };
    const spawn = () => {
      const roll = Math.random(), free = Math.floor(Math.random() * 3);
      if (roll < 0.5) { items.push({ lane: free, y: -24, k: 'rock' }); const o = (free + 1 + Math.floor(Math.random() * 2)) % 3; if (Math.random() < 0.5) items.push({ lane: o, y: -24, k: 'coin' }); }
      else if (roll < 0.78) { for (let l = 0; l < 3; l++) if (l !== free) items.push({ lane: l, y: -24, k: 'rock' }); items.push({ lane: free, y: -24, k: 'coin' }); }
      else { for (let k = 0; k < 3; k++) items.push({ lane: free, y: -24 - k * 34, k: 'coin' }); }
    };
    const draw = () => {
      const A = arcArt, ok = (im) => im && im.complete && im.naturalWidth;
      if (ok(A.cart_bg)) { const off = scroll % 300; for (let y = -300 + off; y < 360; y += 300) g.drawImage(A.cart_bg, 0, y, 300, 300.5); } else { g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, 300, 360); }
      const vg = g.createLinearGradient(0, 0, 0, 70); vg.addColorStop(0, 'rgba(20,8,0,.75)'); vg.addColorStop(1, 'rgba(20,8,0,0)'); g.fillStyle = vg; g.fillRect(0, 0, 300, 70);
      // speed streaks
      g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 2; for (let k = 0; k < 6; k++) { const x = 18 + (k * 53) % 270, y = (scroll * 1.6 + k * 97) % 400 - 20; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 18 + v * 0.4); g.stroke(); }
      items.forEach((it) => {
        const x = LANES[it.lane];
        g.fillStyle = 'rgba(20,8,0,.35)'; g.beginPath(); g.ellipse(x + 2, it.y + 14, 19, 7, 0, 0, 6.283); g.fill();
        if (it.k === 'rock') { if (ok(A.cart_rock)) g.drawImage(A.cart_rock, x - 23, it.y - 24, 46, 45); else { g.beginPath(); g.arc(x, it.y, 17, 0, 6.283); g.fillStyle = '#7b8090'; g.fill(); } }
        else { const sx = Math.abs(Math.cos(t * 5 + it.y / 40)); if (ok(A.coin)) g.drawImage(A.coin, x - 13 * sx, it.y - 13, 26 * sx, 26); else glossBall(g, x, it.y, 11, '#ffd21f', '#c28a00'); }
      });
      // the rival runs in a ghost lane beside you, ahead or behind by the real gap
      const ry = CART_Y - (rival - dist) * 5; if (ry > -80 && ry < 420 && ok(A.cart_rival)) { g.globalAlpha = 0.9; g.drawImage(A.cart_rival, (cx < 150 ? 252 : 8), ry - 44, 40, 52.5); g.globalAlpha = 1; }
      const bx = cx + (shake > 0 ? (Math.random() - 0.5) * 8 : 0), lean = Math.max(-0.16, Math.min(0.16, (tx - cx) * 0.01)), bob = Math.sin(t * 22) * 1.2;
      g.fillStyle = 'rgba(20,8,0,.4)'; g.beginPath(); g.ellipse(bx, CART_Y + 30, 30, 9, 0, 0, 6.283); g.fill();
      if (ok(A.cart_bear)) { g.save(); g.translate(bx, CART_Y + 26); g.rotate(lean); g.drawImage(A.cart_bear, -30, -76 + bob, 60, 78.7); g.restore(); }
      if (v > 20) { g.fillStyle = 'rgba(255,220,120,.8)'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(bx - 24 + Math.random() * 48, CART_Y + 28 + Math.random() * 8, 1.6, 0, 6.283); g.fill(); } }
      g.fillStyle = 'rgba(0,0,0,.45)'; rr(g, 26, 8, 248, 14, 7); g.fill(); g.fillStyle = '#fff'; g.font = '900 11px Nunito'; g.textAlign = 'center'; g.fillText('🏁', 270, 19);
      const mp = 30 + 232 * Math.min(1, dist / GOAL), rp = 30 + 232 * Math.min(1, rival / GOAL);
      g.beginPath(); g.arc(rp, 15, 7, 0, 6.283); g.fillStyle = '#4aa8ff'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); g.beginPath(); g.arc(mp, 15, 8, 0, 6.283); g.fillStyle = '#ff4d9a'; g.fill(); g.stroke();
      texts.forEach((x) => { g.globalAlpha = Math.max(0, x.a); g.font = '900 20px Nunito'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeText(x.t, x.x, x.y); g.fillStyle = x.c; g.fillText(x.t, x.x, x.y); }); g.globalAlpha = 1;
      if (t < 0.9) { g.font = '900 44px Nunito'; g.textAlign = 'center'; g.lineWidth = 7; g.strokeStyle = '#000'; g.strokeText(T('GO!'), 150, 170); g.fillStyle = '#7ee21f'; g.fillText(T('GO!'), 150, 170); }
    };
    const tick = (now) => {
      if (over) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; shake = Math.max(0, shake - dt);
      v += (44 - v) * Math.min(1, dt * 1.4); dist += v * dt; scroll += v * 5 * dt;
      const gap = dist - rival; rival += (33 + 3 * Math.sin(t * 1.3) + (gap > 70 ? -4 : gap < -70 ? 5 : 0)) * dt * Math.min(1, t / 1.5);
      cx += (tx - cx) * Math.min(1, dt * 16);
      if (dist >= nextSpawn) { spawn(); nextSpawn += 15; }
      items.forEach((it) => { it.y += v * 5 * dt; });
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i]; if (it.y > 390) { items.splice(i, 1); continue; }
        if (Math.abs(it.y - CART_Y) < 26 && Math.abs(LANES[it.lane] - cx) < (it.k === 'rock' ? 27 : 30)) {
          if (it.k === 'rock') { v = Math.max(10, v * 0.35); shake = 0.4; S.wrong(); buzz([20, 30]); texts.push({ t: T('Ouch!'), x: cx, y: CART_Y - 60, a: 1, c: '#ff6a6a' }); }
          else { got++; S.candy(got % 9, 3); buzz(6); texts.push({ t: '+1', x: cx, y: CART_Y - 60, a: 1, c: '#ffe14d' }); }
          items.splice(i, 1);
        }
      }
      texts.forEach((x) => { x.y -= 30 * dt; x.a -= dt * 1.2; }); for (let i = texts.length - 1; i >= 0; i--) if (texts[i].a <= 0) texts.splice(i, 1);
      $('quickBar').style.width = Math.min(100, dist / GOAL * 100) + '%'; $('quickInfo').textContent = 'Coins ' + got + ' · ' + Math.max(0, Math.round(GOAL - dist)) + ' m to go';
      draw();
      if (dist >= GOAL) return finish(true);
      if (rival >= GOAL) return finish(false);
      quickRaf = requestAnimationFrame(tick);
    };
    quickRaf = requestAnimationFrame((tt) => { last = tt; tick(tt); });
  }

  /* memory match */
  function startMemory() {
    freshDay(); if (plays.memory >= MAX_PLAYS) return;
    plays.memory++; store.set('plays', plays); updateSides(); closeAll();
    const deck = [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5]; for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const grid = $('memGrid'); grid.innerHTML = ''; let first = null, lock = false, found = 0, moves = 14;
    $('memMoves').textContent = 'Moves left: ' + moves; $('memMsg').textContent = ''; $('memClose').textContent = 'Give up';
    const finish = (win) => {
      const reward = win ? Math.max(1, Math.floor((2 + Math.floor(moves / 3)) / 2)) : 0; give({ coins: reward }, true); S.win(); updateSides();
      $('memMsg').innerHTML = (win ? 'Great memory! +' : 'Out of moves. +') + reward + ' ' + coinSvg; $('memClose').textContent = 'Done'; lock = true;
    };
    deck.forEach((id) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mcard'; b.dataset.id = id;
      b.innerHTML = '<span class="front">?</span><span class="back"><svg><use href="#c' + id + '"/></svg></span>';
      b.onclick = () => {
        if (lock || b.classList.contains('open') || b.classList.contains('done')) return;
        b.classList.add('open'); S.tap();
        if (!first) { first = b; return; }
        moves--; $('memMoves').textContent = 'Moves left: ' + moves;
        const a = first; first = null;
        if (a.dataset.id === b.dataset.id) {
          a.classList.add('done'); b.classList.add('done'); found++; S.candy(+b.dataset.id, found);
          if (found === 6) setTimeout(() => finish(true), 500); else if (moves <= 0) setTimeout(() => finish(false), 500);
        } else {
          lock = true;
          setTimeout(() => { a.classList.remove('open'); b.classList.remove('open'); lock = false; if (moves <= 0) finish(false); }, 750);
        }
      };
      grid.appendChild(b);
    });
    $('memory').hidden = false;
  }
  /* candy toss */
  let tossRaf = 0;
  function stopToss() { cancelAnimationFrame(tossRaf); tossRaf = 0; }
  // Candy Toss: a glass jar slides along the shelf of a carnival booth. Tap to launch the candy from the spring;
  // it flies up in an arc and drops, so you have to lead the jar. 8 candies.
  const tossArt = {};
  function loadToss() {
    if (tossArt.bg) return;
    [['bg', 'toss_bg.jpg'], ['jar', 'toss_jar.webp'], ['stand', 'toss_stand.webp']].forEach((f) => { const im = new Image(); im.src = 'art/' + f[1]; tossArt[f[0]] = im; });
    tossArt.c = ['lollipop', 'candy', 'doughnut', 'cupcake', 'cookie', 'cherries', 'shortcake', 'dango'].map((n) => { const im = new Image(); im.src = 'art/cd_' + n + '.webp'; return im; });
  }
  function startToss() {
    loadToss();
    freshDay(); if (plays.toss >= MAX_PLAYS) return; plays.toss++; store.set('plays', plays); updateSides();
    quickOpen('Candy Toss', 'Tap to launch. The candy takes a moment to fly, so aim ahead of the jar!');
    const { cv, g } = quickCanvas(), ok = (im) => im && im.complete && im.naturalWidth;
    const N = 8, SX = 150, SY = 292, SHELF = 136, JW = 76, JH = 90, TOP = 26, FLY = 0.72;
    let shot = 0, hits = 0, perfect = 0, fly = null, over = false, last = performance.now(), t = 0, jx = 150, spring = 0, wob = 0; const inJar = [], parts = [], texts = [], loose = [];
    const speed = () => 1.25 + shot * 0.22, jarAt = (tt) => 150 + Math.sin(tt * speed()) * 96;
    const candy = (i, x, y, sz, rot) => { const im = tossArt.c[i % tossArt.c.length]; g.save(); g.translate(x, y); g.rotate(rot || 0); if (ok(im)) g.drawImage(im, -sz / 2, -sz / 2, sz, sz); else glossBall(g, 0, 0, sz / 2, '#ff5fa8', '#a8123a'); g.restore(); };
    const burst = (x, y, n) => { const col = ['#fff', '#ffe14d', '#ff8fd0', '#7fe3ff']; for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, v = 40 + Math.random() * 110; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, l: 0.6, c: col[k % 4] }); } };
    const say = (s, x, y, c) => texts.push({ t: s, x, y, a: 1.3, c });
    const finish = () => { if (over) return; over = true; quickEnd(hits + ' / ' + N + ' in the jar', Math.floor((hits + perfect) / 2), hits >= N ? { hints: 1 } : null); };
    cv.onpointerdown = (e) => { e.preventDefault(); if (over || fly || shot >= N) return; fly = { u: 0, i: shot, x: SX, y: SY - 30, rot: 0, st: 'up' }; spring = 1; S.whoosh(); buzz(8); };
    const draw = () => {
      if (ok(tossArt.bg)) g.drawImage(tossArt.bg, -30, 0, 360, 360); else { g.fillStyle = '#c86ad0'; g.fillRect(0, 0, 300, 360); }
      const jy = SHELF - JH + 4, tilt = Math.sin(wob * 18) * wob * 0.09;
      g.fillStyle = 'rgba(60,20,0,.3)'; g.beginPath(); g.ellipse(jx, SHELF + 3, 34, 6, 0, 0, 6.283); g.fill();
      g.save(); g.translate(jx, SHELF); g.rotate(tilt); g.translate(-jx, -SHELF);
      inJar.forEach((c, n) => candy(c.i, jx - 17 + (n % 3) * 17 + (Math.floor(n / 3) % 2) * 6, SHELF - 16 - Math.floor(n / 3) * 15 - Math.abs(Math.sin(c.b * 10)) * c.b * 10, 21, c.r));
      if (fly && fly.st === 'in') candy(fly.i, fly.x, fly.y, 22, fly.rot);
      if (ok(tossArt.jar)) g.drawImage(tossArt.jar, jx - JW / 2, jy, JW, JH);
      g.restore();
      loose.forEach((b) => candy(b.i, b.x, b.y, b.sz, b.rot));
      // launcher
      const sq = 1 - spring * 0.35 + Math.sin(spring * 14) * spring * 0.1;
      g.fillStyle = 'rgba(60,20,0,.3)'; g.beginPath(); g.ellipse(SX, SY + 26, 30, 7, 0, 0, 6.283); g.fill();
      if (ok(tossArt.stand)) g.drawImage(tossArt.stand, SX - 31, SY + 26 - 55 * sq, 62, 55 * sq);
      if (!fly && shot < N) candy(shot, SX, SY - 30 + Math.sin(t * 3) * 1.5 + (1 - sq) * 40, 34, Math.sin(t * 2) * 0.08);
      if (fly && fly.st !== 'in') { const sz = 34 - 12 * Math.min(1, fly.u); candy(fly.i, fly.x, fly.y, sz, fly.rot); }
      // candies left
      for (let k = shot + (fly ? 1 : 0) + (fly ? 0 : 1); k < N; k++) candy(k, 18 + (k - shot - 1) * 19, 344, 17, 0);
      parts.forEach((p) => { g.globalAlpha = Math.max(0, p.l / 0.6); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 3, 0, 6.283); g.fill(); }); g.globalAlpha = 1;
      texts.forEach((x) => { g.globalAlpha = Math.max(0, Math.min(1, x.a)); g.font = '900 24px Nunito,sans-serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#5a2a00'; g.strokeText(x.t, x.x, x.y); g.fillStyle = x.c; g.fillText(x.t, x.x, x.y); }); g.globalAlpha = 1;
    };
    const tick = (now) => {
      if (over) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; jx = jarAt(t); spring = Math.max(0, spring - dt * 2.4); wob = Math.max(0, wob - dt * 1.6);
      if (fly) {
        fly.rot += dt * 9;
        if (fly.st === 'up') {
          fly.u += dt / FLY; const u = Math.min(1, fly.u), top = SHELF - JH - 2;
          fly.y = (SY - 30) + (top - (SY - 30)) * u - 70 * 4 * u * (1 - u) * 0.9; fly.x = SX;
          if (fly.u >= 1) {
            const d = Math.abs(jx - SX);
            if (d <= 17) { fly.st = 'in'; fly.vy = 60; hits++; const pf = d <= 6; if (pf) perfect++; say(pf ? T('Perfect!') : T('Sweet!'), jx, SHELF - JH - 14, pf ? '#ffe14d' : '#fff'); burst(jx, SHELF - JH + 6, pf ? 16 : 9); S.candy(shot % 9, Math.min(8, 2 + hits)); buzz(pf ? [10, 20, 30] : 14); wob = 0.6; }
            else if (d <= 40) { loose.push({ i: fly.i, x: fly.x, y: fly.y, sz: 22, rot: fly.rot, vx: (SX > jx ? 1 : -1) * 90, vy: -170 }); say(T('Rim!'), SX, SHELF - JH - 14, '#fff'); S.x(); buzz(14); wob = 1; fly = null; shot++; }
            else { loose.push({ i: fly.i, x: fly.x, y: fly.y, sz: 22, rot: fly.rot, vx: 0, vy: 30 }); say(T('Miss'), SX, SHELF - JH - 14, '#ffb3b3'); S.wrong(); fly = null; shot++; }
          }
        } else {
          fly.vy += 900 * dt; fly.y += fly.vy * dt; fly.x = jx;
          if (fly.y >= SHELF - 18) { inJar.push({ i: fly.i, r: (Math.random() - 0.5) * 0.9, b: 0.5 }); fly = null; shot++; }
        }
        if (!fly && shot >= N) setTimeout(finish, 900);
      }
      inJar.forEach((c) => { c.b = Math.max(0, c.b - dt); });
      loose.forEach((b) => { b.vy += 620 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += dt * 8; b.sz = Math.min(34, b.sz + dt * 14); }); for (let i = loose.length - 1; i >= 0; i--) if (loose[i].y > 400) loose.splice(i, 1);
      parts.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.l -= dt; }); for (let i = parts.length - 1; i >= 0; i--) if (parts[i].l <= 0) parts.splice(i, 1);
      texts.forEach((x) => { x.y -= 22 * dt; x.a -= dt * 1.1; }); for (let i = texts.length - 1; i >= 0; i--) if (texts[i].a <= 0) texts.splice(i, 1);
      $('quickBar').style.width = ((N - shot) / N * 100) + '%'; $('quickInfo').textContent = 'Candies left ' + (N - shot) + ' · in the jar ' + hits;
      draw(); quickRaf = requestAnimationFrame(tick);
    };
    quickRaf = requestAnimationFrame((x) => { last = x; tick(x); });
  }
  function wireExtras() {
    $('medDaily').onclick = () => { S.unlock(); S.tap(); if (daily.last === today()) { alert('Daily Candy is done for today. Come back tomorrow!'); return; } transition(() => startDaily()); };
    $('medWheel').onclick = openWheel; $('medChest').onclick = openChest; $('medGames').onclick = openGames;
    $('navGifts').onclick = openGifts; $('navQuests').onclick = openQuests;
    $('navHome').onclick = () => { S.tap(); closeAll(); scrollToLevel(level); }; $('navShop').onclick = openShop; $('navRank').onclick = openRanking;
    $('walletMe').onclick = openProfile;
    $('wheelBtn').onclick = spinWheel; $('chestOpen').onclick = openChestNow; $('chestSpeed').onclick = speedChest;
    $('wheelClose').onclick = () => { S.tap(); if (!spinning) $('wheel').hidden = true; };
    $('chestClose').onclick = () => { S.tap(); $('chest').hidden = true; };
    $('questClose').onclick = () => { S.tap(); $('quests').hidden = true; };
    $('giftClose').onclick = () => { S.tap(); $('gifts').hidden = true; };
    $('gamesClose').onclick = () => { S.tap(); $('games').hidden = true; };
    $('memClose').onclick = () => { S.tap(); $('memory').hidden = true; updateSides(); };
    $('tossClose').onclick = () => { S.tap(); stopToss(); $('toss').hidden = true; updateSides(); };
    $('medPass').onclick = openPass; $('passClose').onclick = () => { S.tap(); $('pass').hidden = true; updateSides(); };
    $('medEvents').onclick = openEvents; $('eventsClose').onclick = () => { S.tap(); $('events').hidden = true; updateSides(); };
    $('livesClose').onclick = () => { S.tap(); $('lives').hidden = true; };
    $('livesAd').onclick = () => { S.tap(); watchAd(() => { addLives(1); renderLives(); toast('❤️ +1 life'); }); };
    $('livesCoins').onclick = () => { if (coins < 30 || livesNow() >= MAX_LIVES) return; coins -= 30; saveWallet(); addLives(MAX_LIVES); updateHintUi(); S.ui('buy', 1, 1); renderLives(); };
    $('livesBuy').onclick = () => { S.tap(); buyPack('lives'); };
    $('livesShop').onclick = () => { $('lives').hidden = true; openShop(); };
    { const hc = $('heartN') && $('heartN').closest('.chip'); if (hc) { hc.style.cursor = 'pointer'; hc.onclick = openLives; } }
    $('stormStart').onclick = stormStart; $('stormPlay').onclick = () => { S.tap(); $('storm').hidden = true; updateSides(); openPrelevel(Math.min(level, LAST_LEVEL)); }; $('stormClose').onclick = () => { S.tap(); $('storm').hidden = true; updateSides(); };
    $('climbStart').onclick = climbStart; $('climbPlay').onclick = () => { S.tap(); $('climb').hidden = true; updateSides(); openPrelevel(level); }; $('climbClose').onclick = () => { S.tap(); $('climb').hidden = true; updateSides(); };
    $('medRush').onclick = startRush; $('quickClose').onclick = () => { S.tap(); stopQuick(); quickKey = null; const was = $('quickClose').textContent === T('Done'); $('quick').hidden = true; updateSides(); if (was) openEvents(); };
    setInterval(() => { if (rushActive() || rushWas) updateRushTag(); if (!$('events').hidden) refreshEvents(); if (!$('climb').hidden && climbOn()) $('climbTimer').textContent = '⏱ ' + fmtClock(climbLeft()); if (chest.q) { const was = chestLeft() <= 0; updateSides(); if (!$('chest').hidden) renderChestTick(was); } }, 1000);
  }
  wireExtras();
  // every popup opens and closes with a sound, found automatically
  (function popupSounds() {
    const seen = new Set(); let t0 = 0;
    new MutationObserver((ms) => ms.forEach((m) => {
      const el = m.target; if (!el.classList || !el.classList.contains('overlay') || m.attributeName !== 'hidden') return;
      const now = performance.now(); if (now - t0 < 120) return; t0 = now;
      if (el.hidden) S.ui('close', 1, 0.8); else if (el.id !== 'intro') S.ui('open', 1, 0.9);
    })).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
  })();
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  window.addEventListener('pagehide', saveGame);
  applyLook();
  (function () { const f = document.createElement('div'); f.id = 'mapfx'; document.body.appendChild(f); sparkField(f, 26); })();
  syncSound();
  renderHome();
  scrollToLevel(level);
  if (!store.get('seenIntro', false)) showIntro();
  else if (!store.get('seenHow', false)) $('how').hidden = false;
  else {
    const g = store.get('game', null);
    if (g && g.meta && ((g.meta.kind === 'level' && g.meta.level <= level) || (g.meta.kind === 'daily' && g.meta.date === today()))) {
      if (g.meta.kind === 'level') startLevel(g.meta.level); else startDaily();
    } else maybeBonus();
  }
  { const sp = document.getElementById('splash'), t0 = window.__t0 || Date.now(); let gone = false;
    const bye = () => { if (gone || !sp) return; gone = true; sp.classList.add('out'); setTimeout(() => sp.remove(), 450); if ($('game').hidden) scrollToLevel(level); };
    const ready = () => setTimeout(bye, Math.max(0, 7000 - (Date.now() - t0)));
    const hero = new Image(); hero.onload = hero.onerror = () => { if (document.readyState === 'complete') ready(); else window.addEventListener('load', ready); }; hero.src = 'art/bg_' + (Math.floor((level - 1) / 10) % 30) + '.jpg';
    setTimeout(bye, 12000); }
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => { if (!sessionStorage.getItem('swr') && document.getElementById('splash')) { sessionStorage.setItem('swr', '1'); location.reload(); } });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load', () => setTimeout(() => navigator.serviceWorker.register('sw.js').then((r) => r.update && r.update()).catch(() => {}), 300));
})();
