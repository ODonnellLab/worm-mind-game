'use strict';

// ── CONFIG ──────────────────────────────────────────────────────────────────

const WORLD_W = 300, WORLD_H = 200;
const VIEW_W  = 60,  VIEW_H  = 38;   // total canvas columns/rows
const GAME_H  = VIEW_H - 2;          // rows used for world (bottom 2 = status bar)
const CELL_W  = 12,  CELL_H  = 16;
const JOIN_URL = 'https://odonnell-lab-website.pages.dev/join.html';

const MOVES_BETWEEN_PROMPTS = 25;

// ── BAG ART (animated ASCII worm art for the bag/reproduction endpoint) ────────

const BAG_ART = `
                                                                                                                                                                               ###.    ###########.
                                                                                                                                                                             ##-  #####         +# -##
                                                                                                                                                                           ##  ###.            ## ##+
                                                                                                                                                                         +#- ##-             -#--#+
                                                                                                                                                                        ## ##.              +# ##
                                       +############.                                                                                                                  #+ ##               ## ##
                                 -####+             .#####-                                                                                                          .#-+#.               +# ##
                              ###+     +############-     +###.                                                                                                     -# ##                 # ##
                           ###.  .####+             .#####.   ###+                                                                                                 -# ##                 #+##
                        +##.  ###+                        +###.  +##-                                                                                             +# ##                 ##.#
                      ###  ###.                               ###+  ###.                                                                                         +# ##                 .# #-
                   .##. +##.                                     +##-  ##+                                                                                      ## ##                  ####
                 -##  ###                                           ###  ###                                                                                   ## ##                  -# #.
               +##  ##.                                               .##+ .##-                                                                               ## ##                   #-##
             ### -##.                                                    ###  ###                                                                           +#.+#-                   ## #
           ##+ +##                                                         .##- -##.                                                                      .## ##                     # ##
        .##- ###                                                              ###  ###                                                                  .## -##                     ##.#
      ###  ##+                                                                  -##. -##-                                                             -##  ##                       # #+
   +##-  ##-                                                                       ###  ###                                                         ###  ##                        ####
 ##-  ###                                                                            -##-  ###                                                   ###. -##.                        +# #
 # +##-                                                                                 ###  .###                                             ###-  ###                           #.##
 -#-                                                                                       ###  -###                                      +###   ###-                            ## #
 +#                                                                                          .###  .###                               ####.   ###-                               # #+
  #.                                                                                            -###   ####-                    .#####    +###                                  ####
 ###                                                                                               -###    +######++----+#######-     ####.                                    +# #
 # ##                                                                                                  ####.                     #####.                                        # ##
 -# ##                                                                                                     -######++---++#######-                                             ####
  -#.+##                               -##########                                                                                                                           ## #
    ## ###                          +###         -##.                                                                                                                       .# #+
     ### .###-                  ####.  -##########  ###                                                                                                                     #-##
       ###   +######+++++#######    ###+         -##  ###.                                                                                                                 ##-#
         .###.                  ####-              .##+  ###                                                                                                              ## #
             -######+++++######+                      ###  +##.                                                                                                          +# #+
                                                        .###  ##+                                                                                                       +# ##
                                                           +##. +##                                                                                                    +# ##
                                                              ##+ -##                                                                                                 ## ##
                                                                +## .##                                                                                              ## ##
                                                                  -## -##                                                                                           ## #+
                                                                    -## ##-                                                                                       ##.+#.
                                                                      +#+ ##                                                                                    -## ##
                                                                        ## -##                                                                                 ## +#+
                                                                         .## ##-                                                                             ##. ##
                                                                           +#+ ##.                                                                         ##- ##-
                                                                             ##. ##-                                                                    .##. ##-
                                                                               ##  ###                                                                +##  ##-
                                                                                .##. .###                                                          .###  ##-
                                                                                   ###   ####                                                    ###  -##.
                                                                                     .###    ###+                                             ###   ###
                                                                                         ####   .#####.                                   -###.  ###
                                                                                             ####     .#######+                      -####-   ###
                                                                                                -#####         +#####################.    -###.
`.trim();

const _bagLines    = BAG_ART.split('\n');
const BAG_ART_COLS = Math.max(..._bagLines.map(l => l.length));
const BAG_ART_ROWS = _bagLines.length;
const bagArtSpots  = [];
for (let r = 0; r < _bagLines.length; r++) {
  for (let c = 0; c < _bagLines[r].length; c++) {
    const ch = _bagLines[r][c];
    if (ch !== ' ') bagArtSpots.push({ r, c, orig: ch });
  }
}
// Body-interior mask: flood-fill inside the worm's inner # boundary.
//
// Seed strategy: find the first row (middle third of art) where ## is followed
// immediately by 10+ spaces.  That transition is unambiguously inner-wall →
// body cavity — unlike "longest space run" which can land in the exterior loop.
//
// Boundary strategy: dilate all # chars diagonally before filling so that
// staircase corners in the ASCII outline don't create 4-connected leaks.
const bagBodyMask = (() => {
  const R = BAG_ART_ROWS, C = BAG_ART_COLS;
  const mask    = new Uint8Array(R * C);
  const blocked = new Uint8Array(R * C);

  // Block all non-space chars (outline characters)
  for (const sp of bagArtSpots) blocked[sp.r * C + sp.c] = 1;

  // Diagonal dilation of # chars only — seals staircase corners
  for (const sp of bagArtSpots) {
    if (sp.orig !== '#') continue;
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const nr = sp.r + dr, nc = sp.c + dc;
      if (nr >= 0 && nr < R && nc >= 0 && nc < C) blocked[nr * C + nc] = 1;
    }
  }

  // Seed: first occurrence of ## immediately followed by ≥10 spaces
  let seedR = -1, seedC = -1;
  for (let r = Math.floor(R * 0.25); r < Math.floor(R * 0.75) && seedR < 0; r++) {
    const line = _bagLines[r] || '';
    for (let c = 0; c + 2 < line.length && seedR < 0; c++) {
      if (line[c] !== '#' || line[c + 1] !== '#') continue;
      // walk to end of this # group
      let he = c + 1;
      while (he + 1 < line.length && line[he + 1] === '#') he++;
      const after = he + 1;
      if (after >= line.length || line[after] !== ' ') continue;
      let sp = 0;
      while (after + sp < line.length && line[after + sp] === ' ') sp++;
      if (sp >= 10) {
        seedR = r;
        seedC = after + Math.min(5, Math.floor(sp / 3));
      }
    }
  }

  if (seedR < 0 || blocked[seedR * C + seedC]) return mask;

  // BFS flood-fill through unblocked space cells only
  mask[seedR * C + seedC] = 1;
  const queue = [seedR * C + seedC];
  let qi = 0;
  while (qi < queue.length) {
    const pos = queue[qi++];
    const r = Math.floor(pos / C), c = pos % C;
    for (let d = 0; d < 4; d++) {
      const nr = r + (d === 0 ? -1 : d === 1 ? 1 : 0);
      const nc = c + (d === 2 ? -1 : d === 3 ? 1 : 0);
      if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
      const ni = nr * C + nc;
      if (mask[ni] || blocked[ni]) continue;
      if ((_bagLines[nr] || '')[nc] === ' ') { mask[ni] = 1; queue.push(ni); }
    }
  }
  return mask;
})();

// Canvas scaling params — set once in startBagArt, reused every frame
let bagCW = 4, bagLH = 8, bagOffX = 0, bagOffY = 0;

function isInBagBody(x, y) {
  const c = Math.round((x - bagOffX) / bagCW);
  const r = Math.round((y - bagOffY) / bagLH);
  if (r < 0 || r >= BAG_ART_ROWS || c < 0 || c >= BAG_ART_COLS) return false;
  return bagBodyMask[r * BAG_ART_COLS + c] === 1;
}

let bagAnimHandle = null;

const HUNGER_THRESHOLDS = {
  HINT:     20,
  CUT1:     40,
  PARTIAL:  60,
  CUT2:     80,
  CRITICAL: 90,
};

// Good bacteria clusters (green) — food
const BACTERIA_CLUSTERS = [
  { x: 170, y: 115 },
  { x: 120, y:  78 },
  { x: 205, y: 135 },
  { x:  88, y: 150 },
  { x: 232, y:  68 },
  { x: 255, y: 145 },
  { x:  62, y:  88 },
  { x: 175, y: 172 },
];

// Pathogenic bacteria (red/orange) — dangerous, trigger aversion prompts
const PATHOGEN_CLUSTERS = [
  { x: 145, y: 130 },
  { x: 200, y:  90 },
  { x:  95, y: 115 },
  { x: 240, y: 160 },
];

// Predators (purple) — nematophagous fungi / predatory bacteria; worm avoids
const PREDATORS = [
  { x: 160, y:  85 },
  { x: 115, y: 145 },
  { x: 220, y: 115 },
  { x:  75, y:  60 },
];

// ── STATE ────────────────────────────────────────────────────────────────────

let state = {
  phase: 'intro',
  hunger: 0,
  hungerPromptFired: false,
  nodeId: null,
  history: [],
  pendingNext: null,
  pendingChoiceId: null,
  proximityNodeId: null,     // next path node — fires when worm returns near bacteria
  proximityArmed: false,     // true once worm has moved away from bacteria after queuing
  queuedNodeId: null,        // legacy: locomotion interrupt only
  movesRemaining: 0,
  explorationMoves: 0,       // moves since last path prompt (for locomotion trigger)
  savedQueue: null,
  inPathogenZone: false,
  inPredatorZone: false,
  locomotionPromptFired: false,
  visitedClusters: new Set(),
  parentPathogens: [],
  worm: { x: 150, y: 100, dir: 'right', tail: [] },
  paused: false,
  cutsceneActive: false,
  pharynxSeen: false,
  eatUnlocked: false,
  pharynxPendingNodeId: null,
  goodLoad: 0,
  harmLoad: 0,
  inFoodZone: false,
  nearFoodType: null,
  lastEatTime: 0,
};

let nodes = null;
let REFS  = {};  // keyed by slug, loaded from odonnell-lab-website/data/references.json

function resolveRefs(slugs) {
  if (!slugs?.length) return [];
  return slugs.map(s => REFS[s]).filter(Boolean);
}

// ── CANVAS ───────────────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');
canvas.width  = VIEW_W * CELL_W;   // 720
canvas.height = VIEW_H * CELL_H;   // 608

const C = {
  bg:     '#0d1117',
  muted:  '#8b949e',
  dim:    '#6e7681',
  green:  '#3fb950',
  orange: '#ffa657',
  red:    '#f78166',
};

function setFont(size, weight = 400) {
  ctx.font = `${weight} ${size}px 'IBM Plex Mono', monospace`;
}

// ── CAMERA ───────────────────────────────────────────────────────────────────

function getCam() {
  return {
    x: Math.max(0, Math.min(WORLD_W - VIEW_W, state.worm.x - Math.floor(VIEW_W / 2))),
    y: Math.max(0, Math.min(WORLD_H - GAME_H, state.worm.y - Math.floor(GAME_H / 2))),
  };
}

// ── DETERMINISTIC PER-CELL NOISE ─────────────────────────────────────────────

function cellNoise(wx, wy) {
  let h = ((wx * 374761393) ^ (wy * 1234567891)) & 0x7fffffff;
  h = ((h ^ (h >> 13)) * 1664525 + 1013904223) & 0x7fffffff;
  return h / 0x7fffffff;
}

// ── DISTANCE HELPERS ──────────────────────────────────────────────────────────

function minDistTo(wx, wy, list) {
  let min = Infinity;
  for (const c of list) {
    const d = Math.sqrt((wx - c.x) ** 2 + (wy - c.y) ** 2);
    if (d < min) min = d;
  }
  return min;
}

function minDistToCluster(wx, wy) { return minDistTo(wx, wy, BACTERIA_CLUSTERS); }

// ── WORLD CELL RENDERING ─────────────────────────────────────────────────────

const SOIL_CHARS = [',', '·', "'", '.', '`'];
const ORG_CHARS  = ['∙', '∘', '·', '∙'];

function drawChar(ch, col, row, color) {
  ctx.fillStyle = color;
  ctx.fillText(ch, col * CELL_W, row * CELL_H + CELL_H - 2);
}

function drawWorldCell(vc, vr, wx, wy) {
  if (wx < 0 || wx >= WORLD_W || wy < 0 || wy >= WORLD_H) return;

  const noise  = cellNoise(wx, wy);
  const hunger = state.hunger;
  const dist   = minDistToCluster(wx, wy);

  // Bacteria core — grows more visible as hunger increases and worm gets closer
  const revealR = 5 + Math.max(0, hunger - HUNGER_THRESHOLDS.HINT) * 0.22;
  if (dist < revealR) {
    if (dist < 2.5) {
      const a = Math.min(1, (revealR - dist) / 3.5);
      drawChar(noise < 0.5 ? '✦' : '∙', vc, vr, `rgba(63,185,80,${a})`);
      return;
    }
    if (dist < 6 && noise < 0.65) {
      const a = Math.min(0.85, (revealR - dist) / 5) * 0.75;
      drawChar(noise < 0.35 ? '∙' : '·', vc, vr, `rgba(63,185,80,${a})`);
      return;
    }
  }

  // Organic halo — appears gradually as hunger crosses PARTIAL threshold
  const orgR = 13 + Math.max(0, hunger - HUNGER_THRESHOLDS.PARTIAL) * 0.18;
  if (dist < orgR && noise < 0.30) {
    const a = Math.min(0.40, ((orgR - dist) / orgR) * 0.40);
    const ch = ORG_CHARS[Math.floor(noise * ORG_CHARS.length)];
    drawChar(ch, vc, vr, `rgba(130,200,140,${a})`);
    return;
  }

  // Pathogenic bacteria — red/orange, always partially visible
  const pathDist = minDistTo(wx, wy, PATHOGEN_CLUSTERS);
  if (pathDist < 5) {
    const a = Math.min(0.9, (5 - pathDist) / 4);
    const ch = noise < 0.45 ? '✦' : '∙';
    drawChar(ch, vc, vr, `rgba(247,129,102,${a})`);
    return;
  }
  if (pathDist < 9 && noise < 0.50) {
    const a = Math.min(0.55, (9 - pathDist) / 7) * 0.7;
    drawChar(noise < 0.25 ? '∙' : '·', vc, vr, `rgba(247,129,102,${a})`);
    return;
  }

  // Predators — purple, sharp spike/web pattern
  const predDist = minDistTo(wx, wy, PREDATORS);
  if (predDist < 6) {
    const a = Math.min(0.90, (6 - predDist) / 4.5);
    const ch = predDist < 1.5 ? '╬'
      : noise < 0.25 ? '<' : noise < 0.50 ? '>' : noise < 0.70 ? '─' : '/';
    drawChar(ch, vc, vr, `rgba(180,130,255,${a})`);
    return;
  }
  if (predDist < 12 && noise < 0.32) {
    const a = Math.min(0.45, (12 - predDist) / 11) * 0.65;
    const ch = noise < 0.33 ? '<' : noise < 0.66 ? '>' : '─';
    drawChar(ch, vc, vr, `rgba(180,130,255,${a})`);
    return;
  }

  // Soil texture — always present, very sparse
  if (noise < 0.09) {
    const ch = SOIL_CHARS[Math.floor((noise / 0.09) * SOIL_CHARS.length)];
    drawChar(ch, vc, vr, 'rgba(110,118,129,0.40)');
  }
}

// ── WORM ─────────────────────────────────────────────────────────────────────

function drawWorm() {
  const cam = getCam();
  setFont(CELL_H, 600);

  state.worm.tail.forEach((seg, i) => {
    const vc = seg.x - cam.x, vr = seg.y - cam.y;
    if (vc >= 0 && vc < VIEW_W && vr >= 0 && vr < GAME_H) {
      const a  = 0.3 + (i / Math.max(1, state.worm.tail.length)) * 0.5;
      const ch = (seg.dir === 'up' || seg.dir === 'down') ? '|' : '~';
      drawChar(ch, vc, vr, `rgba(63,185,80,${a})`);
    }
  });

  const hx = state.worm.x - cam.x;
  const hy = state.worm.y - cam.y;

  const headChars = {
    right: ['~','~','*'], left:  ['*','~','~'],
    up:    ['*','|','|'], down:  ['|','|','*'],
  };
  const offsets = {
    right: [[-2,0],[-1,0],[0,0]], left:  [[0,0],[1,0],[2,0]],
    up:    [[0,0],[0,1],[0,2]],   down:  [[0,0],[0,1],[0,2]],
  };
  const chars   = headChars[state.worm.dir] || headChars.right;
  const offList = offsets[state.worm.dir]   || offsets.right;

  offList.forEach(([dc, dr], i) => {
    const vc = hx + dc, vr = hy + dr;
    if (vc >= 0 && vc < VIEW_W && vr >= 0 && vr < GAME_H)
      drawChar(chars[i], vc, vr, C.green);
  });
}

// ── STATUS BAR ────────────────────────────────────────────────────────────────

function drawStatusBar() {
  const row = VIEW_H - 2;
  const y0  = row * CELL_H;
  setFont(CELL_H * 0.75);

  ctx.fillStyle = C.muted;
  ctx.fillText('HUNGER', 8, y0 + CELL_H - 3);

  const bx = 78, bw = 100, bh = CELL_H - 7, by = y0 + 4;
  ctx.fillStyle = '#1c2230';
  ctx.fillRect(bx, by, bw, bh);

  const barColor = state.hunger < 60 ? C.green : state.hunger < 80 ? C.orange : C.red;
  ctx.fillStyle = barColor;
  ctx.fillRect(bx, by, Math.floor(bw * state.hunger / 100), bh);

  const hints = [
    [0,  'Explore with arrow keys or WASD'],
    [20, 'You sense something nearby...'],
    [40, 'Getting hungry. Follow your instincts.'],
    [60, 'Very hungry. Something is close.'],
    [80, 'Desperate. You need to eat.'],
  ];
  let hint = hints[0][1];
  if (state.proximityNodeId) {
    hint = 'Return to the bacteria...';
  } else if (state.queuedNodeId) {
    hint = `Keep moving... (${state.movesRemaining})`;
  } else if (state.eatUnlocked && state.inFoodZone) {
    hint = state.nearFoodType === 'pathogen' ? '[E] eat  ⚠ dangerous' : '[E] to eat';
  } else {
    for (const [t, h] of hints) { if (state.hunger >= t) hint = h; }
  }

  ctx.fillStyle = C.dim;
  ctx.fillText(hint, bx + bw + 12, y0 + CELL_H - 3);

  // ── Gut content meters (row 2 of status bar) ──────────────────────────────
  const y1 = (VIEW_H - 1) * CELL_H;
  const gw = 72, gbh = CELL_H - 7;

  ctx.fillStyle = C.muted;
  ctx.fillText('GUT', 8, y1 + CELL_H - 3);

  // Good bacteria bar (green, faster decay)
  const gbx = 78, gby = y1 + 4;
  ctx.fillStyle = '#1c2230';
  ctx.fillRect(gbx, gby, gw, gbh);
  if (state.goodLoad > 0) {
    ctx.fillStyle = C.green;
    ctx.fillRect(gbx, gby, Math.floor(gw * state.goodLoad / 100), gbh);
  }

  // Harmful bacteria bar (orange→red, slower decay)
  const hbx = gbx + gw + 6;
  ctx.fillStyle = '#1c2230';
  ctx.fillRect(hbx, gby, gw, gbh);
  if (state.harmLoad > 0) {
    ctx.fillStyle = state.harmLoad < 50 ? C.orange : C.red;
    ctx.fillRect(hbx, gby, Math.floor(gw * state.harmLoad / 100), gbh);
  }

  // Gut hint text
  let gutHint = '';
  if (state.harmLoad > 75)      gutHint = 'Severe gut damage — toxins overwhelming immune response';
  else if (state.harmLoad > 50) gutHint = 'Toxins accumulating in gut';
  else if (state.harmLoad > 0)  gutHint = 'Harmful bacteria present';
  else if (state.goodLoad > 60) gutHint = 'Well colonized — gut-brain signaling active';
  else if (state.goodLoad > 20) gutHint = 'Bacteria colonizing gut';
  if (gutHint) {
    ctx.fillStyle = state.harmLoad > 50 ? C.orange : C.dim;
    ctx.fillText(gutHint, hbx + gw + 12, y1 + CELL_H - 3);
  }
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // dividers above status bar rows
  ctx.fillStyle = '#21262d';
  ctx.fillRect(0, (VIEW_H - 2) * CELL_H, canvas.width, 1);
  ctx.fillRect(0, (VIEW_H - 1) * CELL_H, canvas.width, 1);

  setFont(CELL_H);
  const cam = getCam();
  for (let vr = 0; vr < GAME_H; vr++) {
    for (let vc = 0; vc < VIEW_W; vc++) {
      drawWorldCell(vc, vr, cam.x + vc, cam.y + vr);
    }
  }

  drawWorm();
  drawStatusBar();
}

// ── MOVEMENT ──────────────────────────────────────────────────────────────────

const DIR_DELTA = {
  right:[1,0], left:[-1,0], up:[0,-1], down:[0,1],
};

function moveWorm(dir) {
  if (state.phase !== 'exploration' && state.phase !== 'intro') return;
  if (state.paused || state.cutsceneActive) return;

  const [dx, dy] = DIR_DELTA[dir];
  const nx = state.worm.x + dx;
  const ny = state.worm.y + dy;
  if (nx < 0 || nx >= WORLD_W || ny < 0 || ny >= WORLD_H) return;

  state.worm.tail.unshift({ x: state.worm.x, y: state.worm.y, dir });
  if (state.worm.tail.length > 6) state.worm.tail.pop();
  state.worm.x = nx;
  state.worm.y = ny;
  state.worm.dir = dir;

  if (state.phase === 'intro') state.phase = 'exploration';

  if (state.goodLoad <= 0) state.hunger = Math.min(100, state.hunger + 1);
  state.goodLoad = Math.max(0, state.goodLoad - 0.3);
  state.harmLoad = Math.max(0, state.harmLoad - 0.1);

  // Bag: energy exhausted → reproduce
  if (state.hunger >= 100) { showBag(); return; }

  if (state.hunger === HUNGER_THRESHOLDS.CUT1)
    showCutscene("You're getting hungry.\nSomething is out there...");
  if (state.hunger === HUNGER_THRESHOLDS.CUT2)
    showCutscene("Very hungry now.\nYou need to find food.");

  if (state.hunger >= HUNGER_THRESHOLDS.CRITICAL && !state.hungerPromptFired) {
    state.hungerPromptFired = true;
    showHungerPrompt();
    return;
  }

  state.explorationMoves++;

  // Locomotion interrupt: fires 15 moves into the first path choice
  if (state.proximityNodeId && state.explorationMoves === 15 && !state.locomotionPromptFired) {
    state.locomotionPromptFired = true;
    state.savedQueue = { proximityNodeId: state.proximityNodeId };
    state.proximityNodeId = null;
    state.phase = 'prompt';
    render();
    setTimeout(() => showNode('locomotion-forward'), 300);
    return;
  }

  // Legacy countdown (only used if savedQueue restores a move-based queue)
  if (state.queuedNodeId && state.movesRemaining > 0) {
    state.movesRemaining--;
    if (state.movesRemaining === 0) {
      const qId = state.queuedNodeId;
      state.queuedNodeId = null;
      state.phase = 'prompt';
      render();
      setTimeout(() => showNode(qId), 300);
      return;
    }
  }

  // Sidebar encounters — save any active queue, fire prompt, restore after
  function fireSidebar(nodeId) {
    if (state.proximityNodeId) {
      state.savedQueue = { proximityNodeId: state.proximityNodeId };
      state.proximityNodeId = null;
    } else if (state.queuedNodeId) {
      state.savedQueue = { nodeId: state.queuedNodeId, movesRemaining: state.movesRemaining };
      state.queuedNodeId = null;
      state.movesRemaining = 0;
    }
    state.phase = 'prompt';
    render();
    setTimeout(() => showNode(nodeId), 300);
  }

  const nowInPathogen = minDistTo(nx, ny, PATHOGEN_CLUSTERS) < 4;
  const nowNearGood   = minDistToCluster(nx, ny) < 4;
  const nowInPredator = minDistTo(nx, ny, PREDATORS) < 5;

  // Track food proximity for eat key and status bar
  state.inFoodZone   = nowNearGood || nowInPathogen;
  state.nearFoodType = nowNearGood ? 'good' : nowInPathogen ? 'pathogen' : null;

  // Pharynx gate — fires ONCE on first food contact of any kind
  if (!state.pharynxSeen && state.inFoodZone) {
    state.pharynxSeen = true;
    if (nowNearGood && !state.proximityNodeId && !state.queuedNodeId) {
      state.hunger = 0;
      state.pharynxPendingNodeId = 'detect';
    } else if (nowInPathogen) {
      if (state.proximityNodeId) {
        state.savedQueue = { proximityNodeId: state.proximityNodeId };
        state.proximityNodeId = null;
      } else if (state.queuedNodeId) {
        state.savedQueue = { nodeId: state.queuedNodeId, movesRemaining: state.movesRemaining };
        state.queuedNodeId = null; state.movesRemaining = 0;
      }
      state.inPathogenZone = true;
      state.pharynxPendingNodeId = 'pathogen-encounter';
    } else {
      state.pharynxPendingNodeId = null;
    }
    state.phase = 'prompt';
    render();
    setTimeout(() => showNode('pharynx-intro'), 400);
    return;
  }

  if (!state.inPathogenZone && nowInPathogen) {
    state.inPathogenZone = true;
    fireSidebar('pathogen-encounter'); return;
  }
  state.inPathogenZone = nowInPathogen;

  if (!state.inPredatorZone && nowInPredator) {
    state.inPredatorZone = true;
    fireSidebar('predator-encounter'); return;
  }
  state.inPredatorZone = nowInPredator;

  // Arm proximity trigger once worm has moved away from bacteria
  if (state.proximityNodeId && !state.proximityArmed && minDistToCluster(nx, ny) >= 8) {
    state.proximityArmed = true;
  }

  // Proximity-fire queued path node (only after worm has moved away and returned)
  if (state.proximityNodeId && state.proximityArmed && minDistToCluster(nx, ny) < 4) {
    const qId = state.proximityNodeId;
    state.proximityNodeId = null;
    state.proximityArmed  = false;
    state.phase = 'prompt';
    render();
    setTimeout(() => showNode(qId), 300);
    return;
  }

  // First good bacteria encounter — reset hunger, fire detect
  if (!state.proximityNodeId && !state.queuedNodeId && minDistToCluster(nx, ny) < 4 && state.phase === 'exploration') {
    state.hunger = 0;
    state.phase = 'prompt';
    render();
    setTimeout(() => showNode('detect'), 400);
    return;
  }

  render();
}

// ── CUTSCENE ──────────────────────────────────────────────────────────────────

function showCutscene(text, duration = 2600) {
  const el = document.getElementById('cutscene-text');
  el.textContent = text;
  el.classList.add('visible');
  state.cutsceneActive = true;
  setTimeout(() => { el.classList.remove('visible'); state.cutsceneActive = false; }, duration);
}

// ── NODE SYSTEM ───────────────────────────────────────────────────────────────

function getNode(id) { return nodes.nodes[id] || null; }

function setModalBgImage(filename) {
  const img = document.getElementById('modal-bg-image');
  if (filename) {
    img.src = `images/${filename}`;
    img.classList.add('visible');
  } else {
    img.classList.remove('visible');
    img.src = '';
  }
}

function resolveNode(node) {
  if (!node.variants) return node;
  for (const variant of node.variants) {
    if (variant.requires?.every(r => state.history.includes(r))) {
      return { ...node, ...variant };
    }
  }
  return node;
}

function showNode(id) {
  const raw  = getNode(id);
  if (!raw) return;
  const node = resolveNode(raw);
  state.nodeId = id;
  state.phase  = 'prompt';

  if (node.type === 'endpoint') { showEndpoint(node); return; }
  if (node.type === 'death')    { showDeath(node);    return; }

  document.getElementById('modal-header').textContent    = node.phase;
  document.getElementById('modal-narrative').textContent = node.narrative;

  const choicesEl = document.getElementById('modal-choices');
  choicesEl.innerHTML = '';
  node.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `
      <div><span class="choice-key">[${i+1}]</span><span class="choice-label">${choice.label}</span></div>
      ${choice.sublabel ? `<div class="choice-sublabel">${choice.sublabel}</div>` : ''}`;
    const expDiv = document.createElement('div');
    expDiv.className = 'choice-explanation';
    expDiv.textContent = choice.explanation || '';
    choicesEl.appendChild(btn);
    choicesEl.appendChild(expDiv);
    btn.addEventListener('click', () => handleChoice(node, choice, expDiv));
  });

  const papersSection = document.getElementById('papers-section');
  const papersList    = document.getElementById('papers-list');
  const papersScience = document.getElementById('papers-science');
  papersScience.textContent = node.science || '';
  papersScience.classList.remove('visible');
  const nodePapers = resolveRefs(node.papers);
  if (nodePapers.length) {
    papersSection.style.display = 'block';
    papersList.innerHTML = nodePapers.map(p =>
      `<a href="${p.url}" target="_blank" rel="noopener">→ ${p.label}</a>`).join('');
  } else {
    papersSection.style.display = 'none';
  }
  papersList.classList.remove('visible');
  setModalBgImage(node.image || null);
  document.getElementById('continue-btn').classList.remove('visible');
  document.getElementById('modal-card').style.display    = '';
  document.getElementById('endpoint-card').style.display = 'none';
  document.getElementById('death-card').style.display    = 'none';
  document.getElementById('bag-card').style.display      = 'none';
  document.getElementById('modal-overlay').classList.add('visible');
}

function handleChoice(node, choice, expDiv) {
  document.querySelectorAll('.choice-btn').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
  expDiv.classList.add('visible');
  state.pendingNext     = choice.next || null;
  state.pendingChoiceId = choice.id;
  document.getElementById('continue-btn').classList.add('visible');

  const choicePapers = resolveRefs(choice.papers?.length ? choice.papers : node.papers);
  const papersSection = document.getElementById('papers-section');
  const papersList    = document.getElementById('papers-list');
  const papersScience = document.getElementById('papers-science');
  papersScience.textContent = choice.science ?? node.science ?? '';
  if (choicePapers.length) {
    papersSection.style.display = 'block';
    papersList.innerHTML = choicePapers.map(p =>
      `<a href="${p.url}" target="_blank" rel="noopener">→ ${p.label}</a>`).join('');
  }
}

function continueGame() {
  document.getElementById('modal-overlay').classList.remove('visible');
  setModalBgImage(null);
  const nextId = state.pendingNext;  // capture BEFORE clearing — fixes freeze bug
  if (state.pendingChoiceId) {
    if (nextId !== state.nodeId) {  // don't record loop-back choices
      state.history.push(`${state.nodeId}:${state.pendingChoiceId}`);
    }
    state.pendingChoiceId = null;
  }
  state.pendingNext = null;

  // Pharynx-intro completion: unlock eating and immediately fire pending node
  if (state.nodeId === 'pharynx-intro') {
    state.eatUnlocked = true;
    const pending = state.pharynxPendingNodeId;
    state.pharynxPendingNodeId = null;
    if (pending) {
      showNode(pending);
    } else {
      state.phase = 'exploration';
      render();
    }
    return;
  }

  // Loop-back: show same node immediately (e.g. wrong-answer choices)
  if (nextId === state.nodeId) {
    setTimeout(() => showNode(nextId), 200);
    return;
  }

  // Restore any paused queue (from sidebar prompts)
  // Death/endpoint routes take priority — don't swallow them into queue restoration
  if (state.savedQueue) {
    const nextNode = nextId ? getNode(nextId) : null;
    if (!nextNode || (nextNode.type !== 'death' && nextNode.type !== 'endpoint')) {
      if (state.savedQueue.proximityNodeId) {
        state.proximityNodeId = state.savedQueue.proximityNodeId;
      } else {
        state.queuedNodeId   = state.savedQueue.nodeId;
        state.movesRemaining = state.savedQueue.movesRemaining;
      }
      state.savedQueue = null;
      state.phase = 'exploration';
      render();
      return;
    }
    state.savedQueue = null;  // death/endpoint fires below
  }

  if (nextId) {
    const next = getNode(nextId);
    if (next) {
      if (next.type === 'death' || next.type === 'endpoint') {
        showNode(nextId);
        return;
      }
      state.proximityNodeId = nextId;
      state.explorationMoves = 0;
      state.phase = 'exploration';
      render();
    } else {
      state.phase = 'exploration';
      render();
    }
  } else {
    state.phase = 'exploration';
    render();
  }
}

// ── HUNGER PROMPT ─────────────────────────────────────────────────────────────

function showHungerPrompt() {
  const hp = nodes.hunger_prompt;
  state.phase = 'prompt';

  document.getElementById('modal-header').textContent    = hp.phase;
  document.getElementById('modal-narrative').textContent = hp.narrative;

  const choicesEl = document.getElementById('modal-choices');
  choicesEl.innerHTML = '';
  hp.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<div><span class="choice-key">[${i+1}]</span><span class="choice-label">${choice.label}</span></div>`;
    const expDiv = document.createElement('div');
    expDiv.className = 'choice-explanation';
    expDiv.textContent = choice.explanation;
    choicesEl.appendChild(btn);
    choicesEl.appendChild(expDiv);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.choice-btn').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
      expDiv.classList.add('visible');
      state.pendingNext = null;
      document.getElementById('continue-btn').classList.add('visible');
    });
  });

  const papersSection = document.getElementById('papers-section');
  const papersList    = document.getElementById('papers-list');
  papersSection.style.display = 'block';
  papersList.innerHTML = resolveRefs(hp.papers).map(p =>
    `<a href="${p.url}" target="_blank" rel="noopener">→ ${p.label}</a>`).join('');
  document.getElementById('papers-list').classList.remove('visible');
  setModalBgImage(hp.image || null);
  document.getElementById('continue-btn').classList.remove('visible');
  document.getElementById('modal-card').style.display    = '';
  document.getElementById('endpoint-card').style.display = 'none';
  document.getElementById('death-card').style.display    = 'none';
  document.getElementById('bag-card').style.display      = 'none';
  document.getElementById('modal-overlay').classList.add('visible');
}

// ── ENDPOINT ──────────────────────────────────────────────────────────────────

function buildPathSummary() {
  const parts = [];
  for (const entry of state.history) {
    const [nodeId, choiceId] = entry.split(':');
    const node = getNode(nodeId);
    if (!node) continue;
    const choice = node.choices?.find(c => c.id === choiceId);
    if (!choice || !choice.summary || choice.next === nodeId) continue;
    parts.push(choice.summary);
  }
  return parts.join(' ');
}

function showEndpoint(node) {
  const summary = buildPathSummary();
  document.getElementById('endpoint-narrative').textContent = (summary ? summary + '\n\n' : '') + node.narrative;
  document.getElementById('endpoint-cta').textContent = `→ ${node.cta}`;
  document.getElementById('endpoint-cta').href = JOIN_URL;
  setModalBgImage(node.image || null);
  document.getElementById('modal-card').style.display = 'none';
  document.getElementById('endpoint-card').style.display = '';
  document.getElementById('modal-overlay').classList.add('visible');
  state.phase = 'endpoint';
}

// ── DEATH ENDPOINT ────────────────────────────────────────────────────────────

function showDeath(node) {
  stopBagArt();
  const summary = buildPathSummary();
  const deathText = (summary ? summary + '\n\n' : '') + (node.narrative || '');
  document.getElementById('death-narrative').textContent = deathText;
  document.getElementById('death-header').textContent    = node.header    || 'YOU DIED';
  document.getElementById('modal-card').style.display    = 'none';
  document.getElementById('endpoint-card').style.display = 'none';
  document.getElementById('bag-card').style.display      = 'none';
  document.getElementById('death-card').style.display    = '';
  document.getElementById('modal-overlay').classList.add('visible');
  setModalBgImage(null);
  state.phase = 'endpoint';
}

// ── BAG ENDPOINT ──────────────────────────────────────────────────────────────

const BAG_SCIENCE = "C. elegans embryos develop inside the mother and, when she runs out of food, the eggs hatch internally. The L1 larvae consume her from within — digesting her body to fuel their own development. This is called the \"bag of worms\" (bag) phenotype. It is not a failure mode; it is a programmed strategy for transmitting the mother's energy reserves to the next generation.\n\nWhat gets transmitted beyond nutrients is an open question. Exposure to certain pathogens changes small RNA populations that can persist across multiple generations — enough for offspring to mount a faster immune response to the same threat. Whether general nutritional or behavioral history is similarly transmitted remains unknown.";
const BAG_PAPERS = [
  { label: "Kaletsky et al. 2020 — small RNA inheritance (Nature)", href: "https://doi.org/10.1038/s41586-020-2963-8" },
  { label: "Moore et al. 2019 — transgenerational epigenetic memory (Cell)", href: "https://doi.org/10.1016/j.cell.2019.01.040" },
];

function showBag() {
  const text =
    "You have run out of energy.\n\n" +
    "You begin laying eggs — but there's no food left. Your eggs hatch inside you. " +
    "The larvae eat your intestine first, then work outward. Your body becomes their first meal. " +
    "This is not a tragedy. It is the plan.\n\n" +
    "Your offspring emerge here, carrying what you learned. The world is unchanged.\n\n" +
    "Not everything is lost across generations.";
  document.getElementById('bag-narrative').textContent    = text;
  // wire [H] toggle
  const toggle = document.getElementById('bag-science-toggle');
  const panel  = document.getElementById('bag-science-panel');
  if (toggle && panel) {
    toggle.onclick = () => panel.classList.toggle('visible');
    panel.innerHTML = `<p>${BAG_SCIENCE.replace(/\n\n/g,'</p><p>')}</p>` +
      BAG_PAPERS.map(p => `<a href="${p.href}" target="_blank" rel="noopener">${p.label}</a>`).join('');
  }
  document.getElementById('modal-card').style.display    = 'none';
  document.getElementById('endpoint-card').style.display = 'none';
  document.getElementById('death-card').style.display    = 'none';
  document.getElementById('bag-card').style.display      = '';
  document.getElementById('modal-overlay').classList.add('visible');
  setModalBgImage(null);
  state.phase = 'endpoint';
  startBagArt();
}

function continueBag() {
  stopBagArt();
  // Carry pathogen history forward across generations
  const parentPathogens = state.harmLoad > 0
    ? [...state.parentPathogens, Math.round(state.harmLoad)]
    : [...state.parentPathogens];

  document.getElementById('bag-card').style.display      = 'none';
  document.getElementById('modal-overlay').classList.remove('visible');

  // Reset only energy and per-generation counters; keep position, history, path state
  state.hunger           = 0;
  state.hungerPromptFired = false;
  state.goodLoad         = 0;
  state.harmLoad         = 0;
  state.cutsceneActive   = false;
  state.paused           = false;
  state.phase            = 'exploration';
  state.parentPathogens  = parentPathogens;
  state.worm.tail        = [];
  state.lastEatTime      = 0;

  render();
  showCutscene("A new generation begins.\nYou inherit your parent's world.");
}

// ── BAG ART ANIMATION ─────────────────────────────────────────────────────────

// Baby worm state (populated in startBagArt)
let bagWorms = null;

function initBagWorms() {
  // Only seed from cells where all 4 neighbours are also inside the mask —
  // ensures worms start well away from the boundary.
  const C = BAG_ART_COLS, R = BAG_ART_ROWS;
  const candidates = [];
  for (let r = 1; r < R - 1; r++) {
    for (let c = 1; c < C - 1; c++) {
      if (bagBodyMask[r * C + c] &&
          bagBodyMask[(r - 1) * C + c] && bagBodyMask[(r + 1) * C + c] &&
          bagBodyMask[r * C + (c - 1)] && bagBodyMask[r * C + (c + 1)]) {
        candidates.push([bagOffX + (c + 0.5) * bagCW, bagOffY + (r + 0.5) * bagLH]);
      }
    }
  }
  if (candidates.length === 0) return;
  bagWorms = [];
  for (let i = 0; i < 25; i++) {
    const [px, py] = candidates[Math.floor(Math.random() * candidates.length)];
    bagWorms.push({
      x: px, y: py,
      angle: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      freq:  0.55 + Math.random() * 0.35,   // per-worm undulation frequency
      amp:   1.4  + Math.random() * 1.0,    // per-worm wiggle amplitude multiplier
      length: 9 + Math.floor(Math.random() * 5),
    });
  }
}

function drawBagArt() {
  const cv = document.getElementById('bag-canvas');
  if (!cv) return;
  const ctx2 = cv.getContext('2d');
  const W = cv.width, H = cv.height;

  // ── Big worm outline (dim static background) ───────────────────────────────
  const fs = bagCW / 0.615;
  ctx2.fillStyle = '#0d1117';
  ctx2.fillRect(0, 0, W, H);
  ctx2.font = `${fs}px IBM Plex Mono, monospace`;
  ctx2.shadowBlur = 0;

  for (const sp of bagArtSpots) {
    const x = bagOffX + sp.c * bagCW;
    const y = bagOffY + (sp.r + 1) * bagLH;
    if (sp.orig === '#') {
      ctx2.fillStyle = 'rgba(63,185,80,0.35)';
      ctx2.fillText('#', x, y);
    } else if (sp.orig !== ' ') {
      ctx2.fillStyle = 'rgba(63,185,80,0.10)';
      ctx2.fillText(sp.orig, x, y);
    }
  }

  // ── Baby worms crawling inside the body mask ───────────────────────────────
  if (!bagWorms) initBagWorms();
  if (!bagWorms) { bagAnimHandle = requestAnimationFrame(drawBagArt); return; }

  const BABY_FS = Math.max(11, fs * 3.0);
  const SEG_GAP = BABY_FS * 0.68;
  const BASE_AMP = bagCW * 2.2;   // larger base wiggle
  const WCHARS  = ['~', '-', '~', '·', '~', '-'];

  ctx2.font = `${BABY_FS}px IBM Plex Mono, monospace`;

  for (const w of bagWorms) {
    const newX = w.x + Math.cos(w.angle) * w.speed;
    const newY = w.y + Math.sin(w.angle) * w.speed;

    if (isInBagBody(newX, newY)) {
      w.x = newX; w.y = newY;
    } else {
      w.angle += Math.PI * (0.6 + Math.random() * 0.8);
      const tx = w.x + Math.cos(w.angle) * w.speed;
      const ty = w.y + Math.sin(w.angle) * w.speed;
      if (isInBagBody(tx, ty)) { w.x = tx; w.y = ty; }
    }
    w.phase += 0.11;

    // Pre-compute segment positions head→tail; clip at first segment outside body
    const WIGGLE_AMP = BASE_AMP * w.amp;
    const segs = [];
    for (let i = 0; i < w.length; i++) {
      const sx = w.x - i * SEG_GAP * Math.cos(w.angle);
      const sy = w.y - i * SEG_GAP * Math.sin(w.angle);
      const wiggle = Math.sin(w.phase - i * w.freq) * WIGGLE_AMP;
      const dx = sx - Math.sin(w.angle) * wiggle;
      const dy = sy + Math.cos(w.angle) * wiggle;
      if (i > 0 && !isInBagBody(dx, dy)) break;
      segs.push({ dx, dy });
    }

    // Draw clipped tail→head so head is always on top
    for (let i = segs.length - 1; i >= 0; i--) {
      const { dx, dy } = segs[i];
      const isHead = i === 0;
      const bright = isHead ? 1.0 : 0.5 + 0.5 * (1 - i / w.length);
      const g = Math.floor(120 + bright * 135);
      ctx2.fillStyle = `rgb(${Math.floor(5 + bright * 40)},${g},${Math.floor(5 + bright * 25)})`;
      if (isHead) { ctx2.shadowColor = '#3fb950'; ctx2.shadowBlur = 4; }
      else ctx2.shadowBlur = 0;
      ctx2.fillText(isHead ? '*' : WCHARS[i % WCHARS.length], dx, dy);
    }
    ctx2.shadowBlur = 0;
  }

  bagAnimHandle = requestAnimationFrame(drawBagArt);
}

function startBagArt() {
  stopBagArt();
  bagWorms = null;
  const cv = document.getElementById('bag-canvas');
  if (!cv) return;
  cv.width  = cv.offsetWidth || 560;
  cv.height = 300;
  // Compute and store scaling params used by isInBagBody and drawBagArt
  const charAspect = 0.615, lineRatio = 1.3;
  const fs = Math.min(cv.width / (BAG_ART_COLS * charAspect), cv.height / (BAG_ART_ROWS * lineRatio));
  bagCW   = fs * charAspect;
  bagLH   = fs * lineRatio;
  bagOffX = (cv.width  - BAG_ART_COLS * bagCW) / 2;
  bagOffY = Math.max(0, (cv.height - BAG_ART_ROWS * bagLH) / 2);
  drawBagArt();
}

function stopBagArt() {
  if (bagAnimHandle !== null) { cancelAnimationFrame(bagAnimHandle); bagAnimHandle = null; }
}

// ── EAT MECHANIC ──────────────────────────────────────────────────────────────

function doEat() {
  if (!state.eatUnlocked || state.phase !== 'exploration') return;
  const now = Date.now();
  if (now - state.lastEatTime < 900) return;
  state.lastEatTime = now;

  const wx = state.worm.x, wy = state.worm.y;
  const nearGood = minDistToCluster(wx, wy) < 5;
  const nearPath = minDistTo(wx, wy, PATHOGEN_CLUSTERS) < 5;

  if (!nearGood && !nearPath) { showCutscene('No food nearby.', 800); return; }

  if (nearGood) {
    state.hunger  = Math.max(0, state.hunger - 15);
    state.goodLoad = Math.min(100, state.goodLoad + 20);
    showCutscene('Feeding.', 800);
  } else {
    state.harmLoad = Math.min(100, state.harmLoad + 25);
    state.hunger   = Math.max(0, state.hunger - 5);
    if (state.harmLoad >= 100) {
      showDeath(getNode('death-pathogen') || {
        header: 'POISONED',
        narrative: 'The toxins accumulated past the point of recovery.',
      });
      return;
    }
    showCutscene(
      state.harmLoad <= 25 ? 'You eat despite the warning.\nSomething is wrong.'
        : 'You eat again.\nToxins are accumulating.',
      1600
    );
  }
  render();
}

// ── RESET GAME ────────────────────────────────────────────────────────────────

function resetGame(isOffspring = false) {
  stopBagArt();
  const parentPathogens = isOffspring
    ? [...state.parentPathogens, ...(state.pathogenPromptFired ? [0] : [])]
    : [];
  document.getElementById('death-card').style.display    = 'none';
  document.getElementById('bag-card').style.display      = 'none';
  document.getElementById('endpoint-card').style.display = 'none';
  document.getElementById('modal-overlay').classList.remove('visible');
  state = {
    phase: 'intro',
    hunger: 0,
    hungerPromptFired: false,
    nodeId: null,
    history: [],
    pendingNext: null,
    pendingChoiceId: null,
    proximityNodeId: null,
    proximityArmed: false,
    queuedNodeId: null,
    movesRemaining: 0,
    explorationMoves: 0,
    savedQueue: null,
    inPathogenZone: false,
    inPredatorZone: false,
    locomotionPromptFired: false,
    visitedClusters: new Set(),
    parentPathogens,
    worm: { x: 150, y: 100, dir: 'right', tail: [] },
    paused: false,
    cutsceneActive: false,
    pharynxSeen: false,
    eatUnlocked: false,
    pharynxPendingNodeId: null,
    goodLoad: 0,
    harmLoad: 0,
    inFoodZone: false,
    nearFoodType: null,
    lastEatTime: 0,
  };
  render();
  showCutscene(isOffspring
    ? "A new generation begins.\nYou inherit your parent's world."
    : 'You are a C. elegans worm.\nYou are hungry.\nUse arrow keys to explore.');
}

// ── LIGHTBOX ──────────────────────────────────────────────────────────────────

function openLightbox(f) {
  document.getElementById('lightbox-img').src = `images/${f}`;
  document.getElementById('lightbox').classList.add('visible');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('visible');
}

// ── INPUT ─────────────────────────────────────────────────────────────────────

const KEY_DIR = {
  ArrowRight:'right', ArrowLeft:'left', ArrowUp:'up', ArrowDown:'down',
  d:'right', a:'left', w:'up', s:'down',
  D:'right', A:'left', W:'up', S:'down',
};

document.addEventListener('keydown', e => {
  if (document.getElementById('lightbox').classList.contains('visible')) {
    closeLightbox(); return;
  }
  if (e.key === 'Escape') {
    if (state.phase === 'prompt' || state.phase === 'endpoint') return;
    state.paused = !state.paused;
    document.getElementById('pause-overlay').classList.toggle('visible', state.paused);
    return;
  }
  if (state.paused) return;
  if (KEY_DIR[e.key]) { e.preventDefault(); moveWorm(KEY_DIR[e.key]); return; }
  if (e.key === 'e' || e.key === 'E') { doEat(); return; }
  // Dev shortcut: B = bag preview, X = death preview
  if (e.key === 'b' || e.key === 'B') { showBag(); return; }
  if (e.key === 'x' || e.key === 'X') { showDeath({ header: 'CONSUMED', narrative: 'Test death screen.' }); return; }
  if (['1','2','3','4'].includes(e.key) && state.phase === 'prompt') {
    document.querySelectorAll('.choice-btn')[parseInt(e.key)-1]?.click(); return;
  }
  if ((e.key==='h'||e.key==='H') && state.phase==='prompt') {
    document.getElementById('papers-toggle').click(); return;
  }
  if ((e.key==='Enter'||e.key===' ') && state.phase==='prompt') {
    const btn = document.getElementById('continue-btn');
    if (btn.classList.contains('visible')) btn.click();
  }
});

document.getElementById('continue-btn').addEventListener('click', continueGame);
document.getElementById('death-restart').addEventListener('click', () => resetGame(false));
document.getElementById('bag-continue').addEventListener('click', continueBag);
document.getElementById('papers-toggle').addEventListener('click', () => {
  document.getElementById('papers-list').classList.toggle('visible');
  document.getElementById('papers-science').classList.toggle('visible');
});
document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeLightbox();
});

// ── INIT ──────────────────────────────────────────────────────────────────────

const REFS_URL = 'https://odonnell-lab-website.pages.dev/data/references.json';

async function init() {
  try {
    const [nodesResp, refsResp] = await Promise.allSettled([
      fetch('data/nodes.json'),
      fetch(REFS_URL),
    ]);
    if (nodesResp.status === 'fulfilled') {
      nodes = await nodesResp.value.json();
    } else {
      console.error('Could not load nodes.json', nodesResp.reason);
      return;
    }
    if (refsResp.status === 'fulfilled') {
      REFS = await refsResp.value.json();
    } else {
      console.warn('Could not load references.json — [H] papers will not display', refsResp.reason);
    }
  } catch(e) {
    console.error('Init error', e);
    return;
  }
  render();
  showCutscene('You are a C. elegans worm.\nYou are hungry.\nUse arrow keys to explore.');
}

init();
