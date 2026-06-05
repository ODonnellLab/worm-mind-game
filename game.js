'use strict';

// ── CONFIG ──────────────────────────────────────────────────────────────────

const WORLD_W = 300, WORLD_H = 200;
const VIEW_W  = 60,  VIEW_H  = 38;   // total canvas columns/rows
const GAME_H  = VIEW_H - 2;          // rows used for world (bottom 2 = status bar)
const CELL_W  = 12,  CELL_H  = 16;
const JOIN_URL = 'https://odonnell-lab-website.pages.dev/join.html';

const HUNGER_THRESHOLDS = {
  HINT:     20,
  CUT1:     40,
  PARTIAL:  60,
  CUT2:     80,
  CRITICAL: 90,
};

// Bacteria clusters spread across the world. Worm starts at (150, 100).
// Nearest cluster is ~25 cells away so player discovers it after brief exploration.
const BACTERIA_CLUSTERS = [
  { x: 170, y: 115 },
  { x: 120, y: 78  },
  { x: 205, y: 135 },
  { x:  88, y: 150 },
  { x: 232, y:  68 },
  { x: 255, y: 145 },
  { x:  62, y:  88 },
  { x: 175, y: 172 },
];

// ── STATE ────────────────────────────────────────────────────────────────────

let state = {
  phase: 'intro',
  hunger: 0,
  hungerPromptFired: false,
  nodeId: null,
  history: [],
  pendingNext: null,
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

function minDistToCluster(wx, wy) {
  let min = Infinity;
  for (const c of BACTERIA_CLUSTERS) {
    const d = Math.sqrt((wx - c.x) ** 2 + (wy - c.y) ** 2);
    if (d < min) min = d;
  }
  return min;
}

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
  for (const [t, h] of hints) { if (state.hunger >= t) hint = h; }

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

  if (minDistToCluster(nx, ny) < 4 && state.phase === 'exploration') {
    state.phase = 'prompt';
    setTimeout(() => showNode('detect'), 400);
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
  document.getElementById('image-btn').style.display = node.image ? 'block' : 'none';
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
  const nextId = state.pendingNext;  // capture BEFORE clearing — fixes freeze bug
  state.pendingNext = null;

  if (nextId) {
    const next = getNode(nextId);
    if (next) {
      setTimeout(() => showNode(nextId), 200);
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
  document.getElementById('image-btn').style.display = hp.image ? 'block' : 'none';
  document.getElementById('continue-btn').classList.remove('visible');
  document.getElementById('modal-card').style.display = '';
  document.getElementById('endpoint-card').style.display = 'none';
  document.getElementById('modal-overlay').classList.add('visible');
}

// ── ENDPOINT ──────────────────────────────────────────────────────────────────

function showEndpoint(node) {
  document.getElementById('endpoint-narrative').textContent = node.narrative;
  document.getElementById('endpoint-cta').textContent = `→ ${node.cta}`;
  document.getElementById('endpoint-cta').href = JOIN_URL;
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
  if ((e.key==='i'||e.key==='I') && state.phase==='prompt') {
    document.getElementById('image-btn').click(); return;
  }
  if ((e.key==='Enter'||e.key===' ') && state.phase==='prompt') {
    const btn = document.getElementById('continue-btn');
    if (btn.classList.contains('visible')) btn.click();
  }
});

document.getElementById('continue-btn').addEventListener('click', continueGame);
document.getElementById('papers-toggle').addEventListener('click', () =>
  document.getElementById('papers-list').classList.toggle('visible'));
document.getElementById('image-btn').addEventListener('click', () => {
  const node = getNode(state.nodeId);
  const img  = node?.image || nodes?.hunger_prompt?.image;
  if (img) openLightbox(img);
});
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
