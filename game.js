'use strict';

// ── CONFIG ──────────────────────────────────────────────────────────────────

const WORLD_W = 300, WORLD_H = 200;
const VIEW_W  = 60,  VIEW_H  = 38;   // total canvas columns/rows
const GAME_H  = VIEW_H - 2;          // rows used for world (bottom 2 = status bar)
const CELL_W  = 12,  CELL_H  = 16;
const JOIN_URL = 'https://odonnell-lab-website.pages.dev/join.html';

const MOVES_BETWEEN_PROMPTS = 25;  // steps required between each question

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
  queuedNodeId: null,    // next node waiting for movement
  movesRemaining: 0,     // moves required before queuedNodeId fires
  worm: { x: 150, y: 100, dir: 'right', tail: [] },
  paused: false,
  cutsceneActive: false,
};

let nodes = null;

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

  // Predators — purple, spread out, trap-like filaments
  const predDist = minDistTo(wx, wy, PREDATORS);
  if (predDist < 6) {
    const a = Math.min(0.85, (6 - predDist) / 5);
    const ch = predDist < 2 ? '⊕' : (noise < 0.4 ? '─' : noise < 0.7 ? '│' : '┼');
    drawChar(ch, vc, vr, `rgba(180,130,255,${a})`);
    return;
  }
  if (predDist < 11 && noise < 0.35) {
    const a = Math.min(0.40, (11 - predDist) / 10) * 0.6;
    const ch = noise < 0.5 ? '─' : '│';
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
  let hint = state.queuedNodeId
    ? `Keep moving... (${state.movesRemaining})`
    : hints[0][1];
  if (!state.queuedNodeId) {
    for (const [t, h] of hints) { if (state.hunger >= t) hint = h; }
  }

  ctx.fillStyle = C.dim;
  ctx.fillText(hint, bx + bw + 12, y0 + CELL_H - 3);
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // divider above status bar
  ctx.fillStyle = '#21262d';
  ctx.fillRect(0, (VIEW_H - 2) * CELL_H, canvas.width, 1);

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

  state.hunger = Math.min(100, state.hunger + 1);

  if (state.hunger === HUNGER_THRESHOLDS.CUT1)
    showCutscene("You're getting hungry.\nSomething is out there...");
  if (state.hunger === HUNGER_THRESHOLDS.CUT2)
    showCutscene("Very hungry now.\nYou need to find food.");

  if (state.hunger >= HUNGER_THRESHOLDS.CRITICAL && !state.hungerPromptFired) {
    state.hungerPromptFired = true;
    showHungerPrompt();
    return;
  }

  // Countdown to queued prompt
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

  // First bacteria encounter
  if (!state.queuedNodeId && minDistToCluster(nx, ny) < 4 && state.phase === 'exploration') {
    state.phase = 'prompt';
    render();
    setTimeout(() => showNode('detect'), 400);
    return;
  }

  render();
}

// ── CUTSCENE ──────────────────────────────────────────────────────────────────

function showCutscene(text) {
  const el = document.getElementById('cutscene-text');
  el.textContent = text;
  el.classList.add('visible');
  state.cutsceneActive = true;
  setTimeout(() => { el.classList.remove('visible'); state.cutsceneActive = false; }, 2600);
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

function showNode(id) {
  const node = getNode(id);
  if (!node) return;
  state.nodeId = id;
  state.phase  = 'prompt';

  if (node.type === 'endpoint') { showEndpoint(node); return; }

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
  if (node.papers?.length) {
    papersSection.style.display = 'block';
    papersList.innerHTML = node.papers.map(p =>
      `<a href="${p.url}" target="_blank" rel="noopener">→ ${p.label}</a>`).join('');
  } else {
    papersSection.style.display = 'none';
  }
  document.getElementById('papers-list').classList.remove('visible');
  setModalBgImage(node.image || null);
  document.getElementById('continue-btn').classList.remove('visible');
  document.getElementById('modal-card').style.display = '';
  document.getElementById('endpoint-card').style.display = 'none';
  document.getElementById('modal-overlay').classList.add('visible');
}

function handleChoice(node, choice, expDiv) {
  state.history.push(`${node.id}:${choice.id}`);
  document.querySelectorAll('.choice-explanation').forEach(e => e.classList.remove('visible'));
  document.querySelectorAll('.choice-btn').forEach(b => b.style.opacity = '0.5');
  expDiv.classList.add('visible');
  state.pendingNext = choice.next || null;
  document.getElementById('continue-btn').classList.add('visible');
}

function continueGame() {
  document.getElementById('modal-overlay').classList.remove('visible');
  setModalBgImage(null);
  const nextId = state.pendingNext;  // capture BEFORE clearing — fixes freeze bug
  state.pendingNext = null;

  if (nextId) {
    const next = getNode(nextId);
    if (next) {
      // Require movement before the next prompt fires
      state.queuedNodeId  = nextId;
      state.movesRemaining = MOVES_BETWEEN_PROMPTS;
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
      document.querySelectorAll('.choice-explanation').forEach(e => e.classList.remove('visible'));
      document.querySelectorAll('.choice-btn').forEach(b => b.style.opacity = '0.5');
      expDiv.classList.add('visible');
      state.pendingNext = null;
      document.getElementById('continue-btn').classList.add('visible');
    });
  });

  const papersSection = document.getElementById('papers-section');
  const papersList    = document.getElementById('papers-list');
  papersSection.style.display = 'block';
  papersList.innerHTML = hp.papers.map(p =>
    `<a href="${p.url}" target="_blank" rel="noopener">→ ${p.label}</a>`).join('');
  document.getElementById('papers-list').classList.remove('visible');
  setModalBgImage(hp.image || null);
  document.getElementById('continue-btn').classList.remove('visible');
  document.getElementById('modal-card').style.display = '';
  document.getElementById('endpoint-card').style.display = 'none';
  document.getElementById('modal-overlay').classList.add('visible');
}

// ── ENDPOINT ──────────────────────────────────────────────────────────────────

function buildPathSummary() {
  const lines = [];
  for (const entry of state.history) {
    const [nodeId, choiceId] = entry.split(':');
    const node = getNode(nodeId);
    if (!node) continue;
    const choice = node.choices?.find(c => c.id === choiceId);
    if (choice?.label) lines.push(`· ${choice.label}`);
  }
  return lines.length ? 'Your path:\n' + lines.join('\n') + '\n\n' : '';
}

function showEndpoint(node) {
  const summary = buildPathSummary();
  document.getElementById('endpoint-narrative').textContent = summary + node.narrative;
  document.getElementById('endpoint-cta').textContent = `→ ${node.cta}`;
  document.getElementById('endpoint-cta').href = JOIN_URL;
  setModalBgImage(node.image || null);
  document.getElementById('modal-card').style.display = 'none';
  document.getElementById('endpoint-card').style.display = '';
  document.getElementById('modal-overlay').classList.add('visible');
  state.phase = 'endpoint';
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
  if (['1','2','3'].includes(e.key) && state.phase === 'prompt') {
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
document.getElementById('papers-toggle').addEventListener('click', () =>
  document.getElementById('papers-list').classList.toggle('visible'));
document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeLightbox();
});

// ── INIT ──────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const resp = await fetch('data/nodes.json');
    nodes = await resp.json();
  } catch(e) {
    console.error('Could not load nodes.json', e);
    return;
  }
  render();
  showCutscene('You are a C. elegans worm.\nYou are hungry.\nUse arrow keys to explore.');
}

init();
