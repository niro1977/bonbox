/* Candoku sound: everything is synthesized with Web Audio, so there are no audio files to load.
   Each candy has its own voice; its pitch climbs a pentatonic scale as more candies are placed. */
(function (root) {
  let ctx = null, master = null, noiseBuf = null, on = true;
  try { const v = localStorage.getItem('candoku.sound'); if (v !== null) on = JSON.parse(v); } catch (e) {}
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const hz = (semi) => 261.63 * Math.pow(2, semi / 12);

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }   // the shortest output delay the device offers
    setTimeout(preloadSamples, 0);
    master = ctx.createGain(); master.gain.value = 0.6;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  // the loading screen stays silent: inside the app sound can play without a tap, and the daily bonus window, opening under the loading
  // screen, played its whole opening tune there. Any sound asked for while it is up is skipped (the music already waits for it to go).
  const splashUp = () => { const s = document.getElementById('splash'); return !!(s && !s.classList.contains('out')); };
  function ready() { return on && !splashUp() && init(); }

  /* ---- studio-style polish: a short plate reverb, FM bells and plucked marimba ---- */
  let wet = null;
  function reverb() {
    if (wet) return wet;
    const len = Math.floor(ctx.sampleRate * 1.5), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
    wet = ctx.createGain(); wet.gain.value = 0.55; wet.connect(hp); hp.connect(conv); conv.connect(master);
    return wet;
  }
  // a glass/crystal bell: FM with a decaying modulator plus two inharmonic partials; part of it goes to the reverb
  function bell(f, t, dur, vel, send) {
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.type = 'sine'; mod.type = 'sine'; car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * 0.02, t + dur * 0.5);
    mod.connect(mg); mg.connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g); g.connect(master); if (send !== 0) { const s = ctx.createGain(); s.gain.value = send == null ? 0.45 : send; g.connect(s); s.connect(reverb()); }
    car.start(t); mod.start(t); car.stop(t + dur + 0.05); mod.stop(t + dur + 0.05);
    [[2.76, 0.35, 0.5], [5.4, 0.18, 0.22]].forEach(([r, v, d]) => osc('sine', f * r, t, dur * d, vel * v));
  }
  // soft marimba-like pluck (body of the sound)
  function pluck(f, t, dur, vel) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 4;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 7, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function sparkle(t, vel) {   // a quick upward shimmer
    const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; hp.type = 'bandpass'; hp.Q.value = 1.4; hp.frequency.setValueAtTime(4500, t); hp.frequency.exponentialRampToValueAtTime(11000, t + 0.22);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    s.connect(hp); hp.connect(g); g.connect(master); const r = ctx.createGain(); r.gain.value = 0.5; g.connect(r); r.connect(reverb()); s.start(t); s.stop(t + 0.3);
  }

  /* Recorded UI sounds (Kenney, CC0) in audio/sfx. Each one falls back to the synthesized sound until it has loaded. */
  const bufs = {}, pending = {};
  function loadSample(name) {
    if (bufs[name] !== undefined || pending[name] || !ctx) return;
    pending[name] = fetch('audio/sfx/' + name + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('missing'))))
      .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej))).then((b) => { bufs[name] = b; }).catch(() => { bufs[name] = null; });
  }
  function preloadSamples() { ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'fanfare', 'stars', 'cake_layer', 'cake_top', 'cake_fly', 'first_bells', window.LANG === 'es' ? 'first_es' : 'first_en'].forEach(loadSample); }
  // plays a recorded sample; returns false (so the caller can use the synth) when it is not loaded yet
  function sample(name, rate, gain, when) {
    const b = bufs[name]; if (!b || !ctx) return false;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b; src.playbackRate.value = rate || 1; g.gain.value = gain == null ? 1 : gain;
    src.connect(g); g.connect(master); src.start(when || ctx.currentTime);
    return true;
  }
  // variation: each sound rotates through a few variants (never the same one twice in a row) with a little random detune
  const lastV = {};
  function pickV(key, list) { let i; do { i = Math.floor(Math.random() * list.length); } while (list.length > 1 && i === lastV[key]); lastV[key] = i; return list[i]; }
  const jit = () => 1 + (Math.random() - 0.5) * 0.035;
  // semitone steps -> playback rate
  const rt = (semi) => Math.pow(2, semi / 12);

  function osc(type, f, t, dur, peak, slideTo, detune) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.value = detune;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, peak, f, q) {
    const s = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; flt.type = 'bandpass'; flt.frequency.value = f; flt.Q.value = q || 1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(flt); flt.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
  }

  // one voice per candy id
  const voices = [
    (f, t) => { osc('sine', f * 2, t, 0.5, 0.32); osc('sine', f * 4, t, 0.3, 0.12); osc('sine', f * 5.99, t, 0.18, 0.05); },        // 0 lollipop: glass bell
    (f, t) => { noise(t, 0.12, 0.35, 5200, 0.8); noise(t + 0.05, 0.1, 0.25, 3800, 1); osc('triangle', f * 2, t + 0.04, 0.22, 0.22); }, // 1 wrapper: crinkle + blip
    (f, t) => { osc('triangle', f, t, 0.35, 0.5); osc('sine', f * 0.5, t, 0.22, 0.4); },                                              // 2 chocolate: marimba thunk
    (f, t) => { osc('sine', f * 0.7, t, 0.3, 0.45, f * 1.8); osc('sine', f * 1.4, t + 0.08, 0.2, 0.15); },                            // 3 donut: boing
    (f, t) => { osc('triangle', f * 4, t, 0.35, 0.22); osc('sine', f * 8, t, 0.2, 0.09); },                                          // 4 cane: ting
    (f, t) => { noise(t, 0.08, 0.5, 1800, 0.7); noise(t + 0.04, 0.08, 0.4, 1200, 0.7); osc('triangle', f, t + 0.05, 0.22, 0.3); },     // 5 cookie: crunch
    (f, t) => { osc('sine', f * 3, t, 0.12, 0.5, f * 0.8); osc('sine', f * 2, t + 0.07, 0.25, 0.2); },                               // 6 cherry: pop
    (f, t) => { osc('triangle', f * 2, t, 0.4, 0.3); osc('triangle', f * 3.01, t, 0.25, 0.14); },                                     // 7 cupcake: soft pluck
    (f, t) => { osc('sine', f * 1.5, t, 0.45, 0.28, f * 3); osc('sine', f * 3, t + 0.1, 0.25, 0.12); },                              // 8 ice cream: whistle slide
    (f, t) => { osc('square', f * 2, t, 0.18, 0.1); osc('sine', f * 4, t, 0.3, 0.2); osc('sine', f * 3, t + 0.05, 0.3, 0.14); }       // 9 macaron: squeaky chime
  ];

  // a sound played the moment the finger lands (pre) is not played a second time when the click itself fires
  const preAt = {};
  const S = {
    pre(name) { if (!on || !S[name]) return; S[name](); preAt[name] = performance.now(); },
    unlock() { if (on) init(); },   // a tap on the loading screen still wakes the sound up for later, silently
    // build the sound engine and the reverb ahead of time, when the phone is idle (they took about 0.2 s and 0.15 s on a phone, on the first tap and the first window)
    warm() { if (!on) return; const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200)); idle(() => { if (!init()) return; idle(() => { try { reverb(); } catch (e) {} }, { timeout: 4000 }); }, { timeout: 3000 }); },
    ctx() { return on ? init() : null; },
    dest() { return master; },
    isOn() { return on; },
    toggle() { on = !on; try { localStorage.setItem('candoku.sound', JSON.stringify(on)); } catch (e) {} if (on) { init(); S.tap(); } return on; },
    // a candy is revealed: warm pluck, a three-note crystal arpeggio that climbs with progress, a shimmer and a soft low thump
    candy(id, step) {
      if (!ready()) return;
      const t = ctx.currentTime, k = Math.max(1, step) - 1, root = SCALE[k % SCALE.length] + (k >= SCALE.length ? 12 : 0);
      reverb();
      osc('sine', 110, t, 0.18, 0.3, 48);
      pluck(hz(root), t, 0.35, 0.34);
      [0, 4, 7].forEach((x, n) => bell(hz(root + 12 + x), t + 0.018 + n * 0.055, 0.9 - n * 0.1, 0.16 - n * 0.02));
      sparkle(t + 0.02, 0.07);
    },
    x() { if (preAt.x && performance.now() - preAt.x < 380) { preAt.x = 0; return; } if (!ready()) return; const t = ctx.currentTime, f = pickV('x', [520, 494, 554, 466]) * jit(); pluck(f, t, 0.07, 0.16); noise(t, 0.035, 0.12, 3000 + Math.random() * 600, 2); },
    // one soft, round click (a single voice: no second layer)
    tap() { if (preAt.tap && performance.now() - preAt.tap < 380) { preAt.tap = 0; return; } if (!ready()) return; const t = ctx.currentTime, f = pickV('tap', [620, 587, 660]) * jit(); osc('sine', f, t, 0.085, 0.2, f * 0.72); },
    // a coin drops into the purse: two bright metal pings and a tiny jingle
    coin() { if (!ready()) return; const t = ctx.currentTime, k = pickV('coin', [1, 1.06, 0.95]) * jit(); bell(1568 * k, t, 0.22, 0.13, 0.15); bell(2093 * k, t + 0.055, 0.3, 0.11, 0.2); noise(t, 0.03, 0.05, 7000, 3); },
    // hearts: a warm double thump, lub-dub
    heart() { if (!ready()) return; const t = ctx.currentTime; osc('sine', 92, t, 0.16, 0.5, 52); osc('sine', 184, t, 0.07, 0.1, 110); osc('sine', 78, t + 0.2, 0.2, 0.4, 44); osc('sine', 156, t + 0.2, 0.07, 0.07, 92); },
    // a helper lands in its pocket: one soft chime
    item() { if (!ready()) return; const t = ctx.currentTime; bell(1047 * jit(), t, 0.4, 0.13, 0.25); },
    wrong() { if (!ready()) return; const t = ctx.currentTime, k = pickV('wrong', [1, 0.94, 1.06]); osc('sine', 220 * k, t, 0.34, 0.34, 110 * k); pluck(196 * k, t, 0.28, 0.22); pluck(147 * k, t + 0.09, 0.3, 0.2); },
    hint() { if (!ready()) return; const t = ctx.currentTime; reverb(); [0, 4, 7, 12, 16].forEach((s, i) => bell(hz(s + 12), t + i * 0.06, 0.8, 0.16)); sparkle(t + 0.1, 0.06); },
    // a prize: three soft, warm notes (a little different each time). The bright jingle is kept for finishing a level only.
    prize() { if (!ready()) return; const t = ctx.currentTime, r = pickV('prize', [0, 2, -3, 5]); reverb(); pluck(hz(7 + r), t, 0.3, 0.17); pluck(hz(12 + r), t + 0.11, 0.34, 0.17); bell(hz(16 + r), t + 0.22, 0.75, 0.085, 0.3); },
    win() { if (!ready()) return; if (sample('stars', 1, 0.95)) return; const t = ctx.currentTime; [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => { osc('triangle', hz(s + 12), t + i * 0.09, 0.45, 0.28); osc('sine', hz(s + 24), t + i * 0.09, 0.3, 0.1); }); },
    // a candy lands: soft thump + glassy sparkle run, the run climbs with progress
    place(step) {
      if (!ready()) return;
      const t = ctx.currentTime, base = SCALE[(Math.max(1, step) - 1) % SCALE.length] + 12;
      reverb(); osc('sine', 130, t, 0.16, 0.26, 52); bell(hz(base + 12), t + 0.02, 0.7, 0.12);
    },
    // a word of praise pops up
    praise(level) {
      if (!ready()) return;
      const t = ctx.currentTime, up = [0, 4, 7, 12, 16].slice(0, 3 + Math.min(2, level || 0));
      reverb(); up.forEach((x, k) => bell(hz(x + 24), t + k * 0.06, 0.7, 0.14)); sparkle(t + 0.05, 0.07);
    },
    ui(name) { if (!ready()) return; const m = { open: 'tap', close: 'tap', back: 'tap', flip: 'tap', buy: 'coin', coin: 'coin', heart: 'heart', item: 'item' }[name]; if (m && S[m]) S[m](); },
    // a cake layer: a short riser while it falls and a deep 808 hit as it lands (the third layer gets a bigger one with a sparkle)
    // the cake flying into its button: whoosh + bassy zip, then a pling as it lands in the button
    cakeFly() { if (!ready()) return; if (!sample('cake_fly', 1, 0.95)) osc('sine', 300, ctx.currentTime, 0.5, 0.2, 1200); },
    cakeHit(top) { if (!ready()) return; if (sample(top ? 'cake_top' : 'cake_layer', 1, 1)) return; S.cakeDrop(); setTimeout(() => S.cakeLand(top), 380); },
    // a cake layer falling: a rising whoosh while it drops
    cakeDrop() {
      if (!ready()) return; const t = ctx.currentTime;
      const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      n.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3500, t + 0.32);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + 0.42);
      osc('sine', 880, t, 0.34, 0.12, 1760);
    },
    // a cake layer landing: a soft heavy thump, then a bright magical run of bells and a shimmer (top layer = a bigger finish)
    cakeLand(top) {
      if (!ready()) return; const t = ctx.currentTime; reverb();
      osc('sine', 130, t, 0.35, 0.7, 48); noise(t, 0.08, 0.3, 900, 0.8);
      const run = top ? [0, 4, 7, 12, 16, 19, 24, 28] : [0, 4, 7, 12, 16, 19];
      run.forEach((st, i) => { bell(hz(12 + st), t + 0.08 + i * 0.07, 0.9, 0.16, 0.35); pluck(hz(24 + st), t + 0.08 + i * 0.07, 0.25, 0.07); });
      const end = t + 0.08 + run.length * 0.07;
      [0, 4, 7].forEach((st) => bell(hz((top ? 24 : 19) + st), end, 1.6, 0.13, 0.5));
      for (let k = 0; k < 6; k++) noise(end + k * 0.05, 0.12, 0.06, 7000 + k * 600, 3);
    },
    // the cake's candy bomb going off: a deep thump, a rumble that closes down, and a short crackle on top
    boom() {
      if (!ready()) return; const t = ctx.currentTime;
      osc('sine', 150, t, 0.6, 0.75, 36); osc('triangle', 95, t, 0.38, 0.35, 28);
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(160, t + 0.48);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.8, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 0.55);
      noise(t + 0.02, 0.12, 0.25, 6000, 0.7); noise(t + 0.09, 0.08, 0.15, 4200, 0.9);
    },
    starIn() { if (!ready()) return; const t = ctx.currentTime; noise(t, 0.4, 0.18, 2400, 0.8); osc('sine', 280, t, 0.42, 0.1, 1600); },
    star(i, earned) {
      if (!ready()) return;
      const t = ctx.currentTime;
      osc('sine', 130, t, 0.2, 0.4, 48);   // landing thump
      if (!earned) { osc('sine', 330, t, 0.2, 0.12, 200); return; }
      const base = [0, 4, 7][Math.min(i, 3) - 1] + 12;
      reverb(); bell(hz(base + 12), t, 1.2, 0.26); bell(hz(base + 24), t + 0.02, 1.0, 0.14); sparkle(t, 0.1);
      [0, 7, 12, 16].forEach((x, k) => bell(hz(base + 24 + x), t + 0.05 + k * 0.05, 0.6, 0.08));
    },
    // first place in the league table: crown bells and the deep narrator "You're number one!" (bells only when the narrator is off)
    first(voice) {
      if (!ready()) return;
      if (sample(voice ? (window.LANG === 'es' ? 'first_es' : 'first_en') : 'first_bells', 1, 1)) return;
      if (voice && sample('first_bells', 1, 1)) return;
      S.fanfare();
    },
    fanfare() {
      if (!ready()) return;
      const t = ctx.currentTime;
      if (sample('fanfare', 1, 1)) return;
      [0, 4, 7, 12].forEach((x) => { osc('triangle', hz(x + 12), t, 0.9, 0.22); osc('sawtooth', hz(x), t, 0.7, 0.05); });
      [12, 16, 19, 24, 28, 31, 36].forEach((x, k) => osc('sine', hz(x + 12), t + 0.12 + k * 0.07, 0.4, 0.14));
      noise(t + 0.1, 0.6, 0.12, 6000, 0.8);
    },
    lose() { if (!ready()) return; const t = ctx.currentTime; reverb(); [7, 4, 0, -5].forEach((s, i) => { pluck(hz(s), t + i * 0.2, 0.5, 0.28); bell(hz(s + 12), t + i * 0.2, 0.7, 0.07, 0.3); }); },
    hop() { if (!ready()) return; const t = ctx.currentTime, k = pickV('hop', [1, 1.06, 0.94]) * jit(); pluck(520 * k, t, 0.12, 0.2); pluck(780 * k, t + 0.08, 0.14, 0.2); bell(1560 * k, t + 0.1, 0.4, 0.06); },
    // soft button feel: a low thud when the finger goes down, a tiny tick when it lifts
    press() {},   // silent: the click itself is the only sound of a press
    release() {},
    // a window pops in (rising swish + soft chime) and out (falling swish)
    popIn() { if (!ready()) return; const t = ctx.currentTime, k = pickV('pin', [1, 1.12, 0.9]); noise(t, 0.16, 0.07, 1400 * k, 0.7); osc('sine', 330 * k, t, 0.16, 0.09, 660 * k); bell(1320 * k, t + 0.09, 0.35, 0.05, 0.3); },
    popOut() { if (!ready()) return; const t = ctx.currentTime, k = pickV('pout', [1, 1.1, 0.92]); noise(t, 0.12, 0.05, 1100 * k, 0.7); osc('sine', 520 * k, t, 0.12, 0.07, 260 * k); },
    // a star stamps onto a level button on the map
    stamp(i) { if (!ready()) return; const t = ctx.currentTime; reverb(); osc('sine', 150, t, 0.1, 0.2, 70); bell(hz(12 + [0, 4, 7][i % 3]), t, 0.7, 0.15); sparkle(t + 0.02, 0.05); },
    unlock2() { if (!ready()) return; const t = ctx.currentTime; reverb(); [0, 7, 12].forEach((x, n) => bell(hz(12 + x), t + n * 0.07, 0.8, 0.13)); sparkle(t + 0.1, 0.08); },
    whoosh() { if (!ready()) return; const t = ctx.currentTime; noise(t, 0.5, 0.22, 900, 0.6); osc('sine', 300, t, 0.45, 0.1, 1200); }
  };
  root.CandokuSound = S;
})(window);
