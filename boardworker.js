/* Bonbox board maker: builds a level's board in the background, so the screen never freezes while a big board is made.
   It runs the very same engine and rating code as the game. */
self.window = self;
importScripts('engine.js', 'hints.js');
self.onmessage = (e) => {
  const p = e.data; let b = null, err = null;
  try {
    for (const s of p.seeds) {
      b = self.CandokuEngine.generate(p.n, s);
      if (!p.rate || self.CandokuHints.rate(p.n, b.regions, b.solution).max <= 2) break;   // normal levels: skip boards that would need guessing
    }
  } catch (x) { err = String(x); }
  self.postMessage({ id: p.id, board: b, err });
};
