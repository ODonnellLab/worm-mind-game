'use strict';

// ── CONFIG ──────────────────────────────────────────────────────────────────

const COLS = 80, ROWS = 50;
const CELL_W = 12, CELL_H = 16;
const PLATE_CX = 40, PLATE_CY = 24, PLATE_R = 32;
const JOIN_URL = 'https://odonnell-lab-website.pages.dev/join.html';

const HUNGER_THRESHOLDS = {
  HINT:    20,   // faint odor hints appear
  CUT1:    40,   // "getting hungry" cutscene
  PARTIAL: 60,   // bacteria partially revealed
  CUT2:    80,   // "very hungry" cutscene
  CRITICAL: 90,  // hunger prompt fires (once)
};

const BACTERIA_POSITIONS = [
  { x: 52, y: 15 },
  { x: 28, y: 35 },
  { x: 58, y: 32 },
];

// ── STATE ────────────────────────────────────────────────────────────────────

let state = {
  phase: 'intro',     // intro | exploration | prompt | cutscene | endpoint
  hunger: 0,
  hungerPromptFired: false,
  nodeId: null,
  history: [],
  pendingNext: null,  // next nodeId after continue
  worm: { x: PLATE_CX, y: PLATE_CY, dir: 'right', tail: [] },
  paused: false,
  cutsceneActive: false,
};

let nodes = null;

// ── CANVAS SETUP ─────────────────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
canvas.width  = COLS * CELL_W;
canvas.height = ROWS * CELL_H;

// ── FONT & COLORS ─────────────────────────────────────────────────────────────

const C = {
  bg:      '#0d1117',
  surface: '#161b22',
  border:  '#30363d',
  text:    '#e6edf3',
  muted:   '#8b949e',
  dim:     '#6e7681',
  green:   '#3fb950',
  blue:    '#58a6ff',
  purple:  '#d2a8ff',
  orange:  '#ffa657',
};

function setFont(size = CELL_H, weight = 400) {
  ctx.font = `${weight} ${size}px 'IBM Plex Mono', monospace`;
}

// ── UTILITIES ────────────────────────────────────────────────────────────────

function inPlate(x, y) {
  return (x - PLATE_CX) ** 2 + (y - PLATE_CY) ** 2 <= PLATE_R ** 2;
}

function distTo(x, y, bx, by) {
  return Math.sqrt((x - bx) ** 2 + (y - by) ** 2);
}

function nearestBacteria(x, y) {
  return Math.min(...BACTERIA_POSITIONS.map(b => distTo(x, y, b.x, b.y)));
}

// ── RENDERING ────────────────────────────────────────────────────────────────

function drawChar(ch, col, row, color) {
  ctx.fillStyle = color;
  ctx.fillText(ch, col * CELL_W, row * CELL_H + CELL_H - 2);
}

function drawPlate() {
  setFont(CELL_H);
  // fill background inside plate
  for (let r = 0; r < ROWS - 2; r++) {
    for (let c = 0; c < COLS; c++) {
      if (inPlate(c, r)) {
        ctx.fillStyle = C.surface;
        ctx.fillRect(c * CELL_W, r * CELL_H, CELL_W, CELL_H);
      }
    }
  }

  // plate boundary
  for (let r = 0; r < ROWS - 2; r++) {
    for (let c = 0; c < COLS; c++) {
      const d = (c - PLATE_CX) ** 2 + (r - PLATE_CY) ** 2;
      if (Math.abs(d - PLATE_R ** 2) < PLATE_R * 1.8) {
        drawChar('·', c, r, C.dim);
      }
    }
  }
}

function drawBacteria() {
  const { hunger } = state;
  BACTERIA_POSITIONS.forEach(b => {
    // odor plume: faint dots at distance when hungry enough
    if (hunger >= HUNGER_THRESHOLDS.HINT) {
      for (let r = b.y - 12; r <= b.y + 12; r++) {
        for (let c = b.x - 12; c <= b.x + 12; c++) {
          if (!inPlate(c, r)) continue;
          const d = distTo(c, r, b.x, b.y);
          if (d > 10 && d < 13 && Math.random() < 0.25) {
            const alpha = Math.min(1, (hunger - HUNGER_THRESHOLDS.HINT) / 40);
            drawChar('·', c, r, `rgba(63,185,80,${alpha * 0.3})`);
          }
        }
      }
    }

    // bacteria cluster
    const wDist = distTo(state.worm.x, state.worm.y, b.x, b.y);
    const reveal = hunger >= HUNGER_THRESHOLDS.PARTIAL || wDist < 10;

    if (!reveal) return;

    const opacity = Math.min(1, hunger >= HUNGER_THRESHOLDS.PARTIAL
      ? (hunger - HUNGER_THRESHOLDS.PARTIAL) / 20 + 0.4
      : Math.max(0, (10 - wDist) / 10));

    const chars = ['✦', '∙', '∙', '·', '·', '·'];
    const offsets = [
      [0,0],[1,0],[-1,0],[0,1],[0,-1],
      [2,0],[-2,0],[0,2],[0,-2],[1,1],[-1,1],[1,-1],[-1,-1],
    ];
    offsets.forEach(([dc, dr], i) => {
      const ch = chars[Math.min(i, chars.length - 1)];
      const col = `rgba(63,185,80,${opacity * (i === 0 ? 1 : 0.6)})`;
      drawChar(ch, b.x + dc, b.y + dr, col);
    });
  });
}

function drawWorm() {
  const { x, y, dir, tail } = state.worm;
  setFont(CELL_H, 600);

  // tail
  tail.forEach((seg, i) => {
    const alpha = 0.3 + (i / tail.length) * 0.5;
    drawChar('~', seg.x, seg.y, `rgba(63,185,80,${alpha})`);
  });

  // head: ~~* or *~~ depending on direction
  const headChars = {
    right: ['~','~','*'],
    left:  ['*','~','~'],
    up:    ['~','~','*'],
    down:  ['~','~','*'],
  };
  const chars = headChars[dir] || headChars.right;
  const offsets = {
    right: [[-2,0],[-1,0],[0,0]],
    left:  [[0,0],[1,0],[2,0]],
    up:    [[0,2],[0,1],[0,0]],
    down:  [[0,0],[0,1],[0,2]],
  };
  (offsets[dir] || offsets.right).forEach(([dc, dr], i) => {
    drawChar(chars[i], x + dc, y + dr, C.green);
  });
}

function drawHungerBar() {
  const barRow = ROWS - 1;
  const label = 'HUNGER: ';
  setFont(CELL_H * 0.8);
  ctx.fillStyle = C.muted;
  ctx.fillText(label, 2, barRow * CELL_H + CELL_H - 3);

  const barStart = 2 + label.length * CELL_W * 0.6;
  const barWidth = 120;
  const filled = Math.floor((state.hunger / 100) * barWidth);

  ctx.fillStyle = C.dim;
  ctx.fillRect(barStart, barRow * CELL_H + 4, barWidth, CELL_H - 8);

  const barColor = state.hunger < 60 ? C.green
    : state.hunger < 80 ? C.orange : '#f78166';
  ctx.fillStyle = barColor;
  ctx.fillRect(barStart, barRow * CELL_H + 4, filled, CELL_H - 8);

  // context hint
  const hints = [
    [0,  'Explore the plate with arrow keys or WASD'],
    [20, 'Something is out there...'],
    [40, 'Getting hungry. Follow the trail.'],
    [60, 'Very hungry. You need food.'],
    [80, 'Desperate. Find the bacteria.'],
  ];
  let hint = hints[0][1];
  for (const [t, h] of hints) { if (state.hunger >= t) hint = h; }

  setFont(CELL_H * 0.75);
  ctx.fillStyle = C.dim;
  ctx.fillText(hint, barStart + barWidth + 16, barRow * CELL_H + CELL_H - 3);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  setFont(CELL_H);
  drawPlate();
  drawBacteria();
  drawWorm();
  drawHungerBar();
}

// ── WORM MOVEMENT ────────────────────────────────────────────────────────────

const DIR_DELTA = {
  right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1],
};

function moveWorm(dir) {
  if (state.phase !== 'exploration' && state.phase !== 'intro') return;
  if (state.paused || state.cutsceneActive) return;

  const [dx, dy] = DIR_DELTA[dir];
  const nx = state.worm.x + dx;
  const ny = state.worm.y + dy;

  if (!inPlate(nx, ny)) return; // boundary

  // update tail
  state.worm.tail.unshift({ x: state.worm.x, y: state.worm.y });
  if (state.worm.tail.length > 5) state.worm.tail.pop();

  state.worm.x = nx;
  state.worm.y = ny;
  state.worm.dir = dir;

  if (state.phase === 'intro') state.phase = 'exploration';

  // hunger
  state.hunger = Math.min(100, state.hunger + 1);

  // cutscene triggers
  if (state.hunger === HUNGER_THRESHOLDS.CUT1) showCutscene("You're getting hungry. Something is out there...");
  if (state.hunger === HUNGER_THRESHOLDS.CUT2) showCutscene("Very hungry now. You need to find food.");

  // critical hunger prompt (once)
  if (state.hunger >= HUNGER_THRESHOLDS.CRITICAL && !state.hungerPromptFired) {
    state.hungerPromptFired = true;
    showHungerPrompt();
    return;
  }

  // check if worm reached bacteria
  const nearest = nearestBacteria(state.worm.x, state.worm.y);
  if (nearest < 4 && state.phase === 'exploration') {
    state.hunger = Math.min(state.hunger, 100); // freeze
    state.phase = 'prompt';
    setTimeout(() => showNode('detect'), 400);
  }

  render();
}

// ── CUTSCENE ─────────────────────────────────────────────────────────────────

function showCutscene(text) {
  const el = document.getElementById('cutscene-text');
  el.textContent = text;
  el.classList.add('visible');
  state.cutsceneActive = true;
  setTimeout(() => {
    el.classList.remove('visible');
    state.cutsceneActive = false;
  }, 2500);
}

// ── NODE SYSTEM ──────────────────────────────────────────────────────────────

function getNode(id) {
  return nodes.nodes[id] || null;
}

function showNode(id) {
  const node = getNode(id);
  if (!node) return;

  state.nodeId = id;
  state.phase = 'prompt';

  if (node.type === 'endpoint') {
    showEndpoint(node);
    return;
  }

  // populate modal
  document.getElementById('modal-header').textContent = node.phase;
  document.getElementById('modal-narrative').textContent = node.narrative;

  // choices
  const choicesEl = document.getElementById('modal-choices');
  choicesEl.innerHTML = '';
  node.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `
      <div><span class="choice-key">[${i + 1}]</span><span class="choice-label">${choice.label}</span></div>
      ${choice.sublabel ? `<div class="choice-sublabel">${choice.sublabel}</div>` : ''}
    `;
    const expDiv = document.createElement('div');
    expDiv.className = 'choice-explanation';
    expDiv.textContent = choice.explanation || '';
    choicesEl.appendChild(btn);
    choicesEl.appendChild(expDiv);

    btn.addEventListener('click', () => handleChoice(node, choice, i, expDiv));
  });

  // papers
  const papersSection = document.getElementById('papers-section');
  const papersList = document.getElementById('papers-list');
  if (node.papers && node.papers.length) {
    papersSection.style.display = 'block';
    papersList.innerHTML = node.papers.map(p =>
      `<a href="${p.url}" target="_blank" rel="noopener">→ ${p.label}</a>`
    ).join('');
  } else {
    papersSection.style.display = 'none';
  }
  document.getElementById('papers-list').classList.remove('visible');

  // image button
  const imageBtn = document.getElementById('image-btn');
  imageBtn.style.display = node.image ? 'block' : 'none';

  document.getElementById('continue-btn').classList.remove('visible');
  document.getElementById('modal-card').style.display = '';
  document.getElementById('endpoint-card').style.display = 'none';
  document.getElementById('modal-overlay').classList.add('visible');
}

function handleChoice(node, choice, index, expDiv) {
  // record history
  state.history.push(`${node.id}:${choice.id}`);

  // show explanation
  document.querySelectorAll('.choice-explanation').forEach(e => e.classList.remove('visible'));
  document.querySelectorAll('.choice-btn').forEach(b => b.style.opacity = '0.5');
  expDiv.classList.add('visible');

  // store next
  state.pendingNext = choice.next || null;

  // show continue button
  document.getElementById('continue-btn').classList.add('visible');
}

function continueGame() {
  document.getElementById('modal-overlay').classList.remove('visible');

  if (state.pendingNext) {
    const next = getNode(state.pendingNext);
    if (next) {
      setTimeout(() => showNode(state.pendingNext), 200);
    } else {
      state.phase = 'exploration';
      render();
    }
  } else {
    state.phase = 'exploration';
    render();
  }
  state.pendingNext = null;
}

// ── HUNGER PROMPT ────────────────────────────────────────────────────────────

function showHungerPrompt() {
  const hp = nodes.hunger_prompt;
  state.phase = 'prompt';

  document.getElementById('modal-header').textContent = hp.phase;
  document.getElementById('modal-narrative').textContent = hp.narrative;

  const choicesEl = document.getElementById('modal-choices');
  choicesEl.innerHTML = '';
  hp.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<div><span class="choice-key">[${i + 1}]</span><span class="choice-label">${choice.label}</span></div>`;
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
  const papersList = document.getElementById('papers-list');
  papersSection.style.display = 'block';
  papersList.innerHTML = hp.papers.map(p =>
    `<a href="${p.url}" target="_blank" rel="noopener">→ ${p.label}</a>`
  ).join('');
  document.getElementById('papers-list').classList.remove('visible');

  const imageBtn = document.getElementById('image-btn');
  imageBtn.style.display = hp.image ? 'block' : 'none';
  if (hp.image) imageBtn.dataset.image = hp.image;

  document.getElementById('continue-btn').classList.remove('visible');
  document.getElementById('modal-card').style.display = '';
  document.getElementById('endpoint-card').style.display = 'none';
  document.getElementById('modal-overlay').classList.add('visible');
}

// ── ENDPOINT ─────────────────────────────────────────────────────────────────

function showEndpoint(node) {
  document.getElementById('endpoint-narrative').textContent = node.narrative;
  document.getElementById('endpoint-cta').textContent = `→ ${node.cta}`;
  document.getElementById('endpoint-cta').href = JOIN_URL;
  document.getElementById('modal-card').style.display = 'none';
  document.getElementById('endpoint-card').style.display = '';
  document.getElementById('modal-overlay').classList.add('visible');
  state.phase = 'endpoint';
}

// ── LIGHTBOX ─────────────────────────────────────────────────────────────────

function openLightbox(filename) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightbox-img').src = `images/${filename}`;
  lb.classList.add('visible');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('visible');
}

// ── INPUT ─────────────────────────────────────────────────────────────────────

const KEY_DIR = {
  ArrowRight: 'right', ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down',
  d: 'right', a: 'left', w: 'up', s: 'down',
  D: 'right', A: 'left', W: 'up', S: 'down',
};

document.addEventListener('keydown', e => {
  // lightbox open: any key closes
  if (document.getElementById('lightbox').classList.contains('visible')) {
    closeLightbox();
    return;
  }

  // pause toggle
  if (e.key === 'Escape') {
    if (state.phase === 'prompt' || state.phase === 'endpoint') return;
    const po = document.getElementById('pause-overlay');
    state.paused = !state.paused;
    po.classList.toggle('visible', state.paused);
    return;
  }

  if (state.paused) return;

  // movement
  if (KEY_DIR[e.key]) {
    e.preventDefault();
    moveWorm(KEY_DIR[e.key]);
    return;
  }

  // choices 1/2/3
  if (['1','2','3'].includes(e.key) && state.phase === 'prompt') {
    const idx = parseInt(e.key) - 1;
    const btns = document.querySelectorAll('.choice-btn');
    if (btns[idx]) btns[idx].click();
    return;
  }

  // H: papers toggle
  if ((e.key === 'h' || e.key === 'H') && state.phase === 'prompt') {
    document.getElementById('papers-toggle').click();
    return;
  }

  // I: image
  if ((e.key === 'i' || e.key === 'I') && state.phase === 'prompt') {
    document.getElementById('image-btn').click();
    return;
  }

  // Enter / Space: continue
  if ((e.key === 'Enter' || e.key === ' ') && state.phase === 'prompt') {
    const btn = document.getElementById('continue-btn');
    if (btn.classList.contains('visible')) btn.click();
  }
});

// Button event listeners
document.getElementById('continue-btn').addEventListener('click', continueGame);

document.getElementById('papers-toggle').addEventListener('click', () => {
  document.getElementById('papers-list').classList.toggle('visible');
});

document.getElementById('image-btn').addEventListener('click', () => {
  const node = getNode(state.nodeId);
  const img = node ? node.image : (nodes.hunger_prompt.image);
  if (img) openLightbox(img);
});

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeLightbox();
});

// ── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const resp = await fetch('data/nodes.json');
    nodes = await resp.json();
  } catch (e) {
    console.error('Could not load nodes.json', e);
    return;
  }

  // set image button handler dynamically after node load
  document.getElementById('image-btn').dataset.image = '';

  render();
  showCutscene('You are a C. elegans worm. You are hungry. Use arrow keys to explore.');
}

init();
