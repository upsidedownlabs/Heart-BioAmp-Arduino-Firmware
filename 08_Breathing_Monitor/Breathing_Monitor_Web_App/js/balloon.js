// ==================================================================
// balloon.js -- the animated breathing balloon: sizing/resize,
// inhale/exhale color+size states, the oxygen particle system,
// balloon/string/knot rendering, BPM display, hold timer, and the
// main requestAnimationFrame draw loop. Depends on dom.js (canvas,
// balloonBox, labels, bpm/hold-timer elements) and audio.js
// (playBreathTone). Declares the shared 'calibrating' and
// 'hasCalibratedOnce' flags used by plots.js and calibration.js.
// ==================================================================
let w, h, centerX, centerY, baseRadius, expandRadius, stringAnchorY;

const STATES = {
  INHALE:  { size: 1.00, base: '#2563eb', highlight: '#93c5fd' }, 
  EXHALE:  { size: 0.28, base: '#d97706', highlight: '#fcd34d' }
};

let currentState = 'EXHALE';
let calibrating = false;
let hasCalibratedOnce = false; // Tracks if initial session setup calibration has completed

let dispSize = STATES.EXHALE.size;
let prevDispSize = dispSize;
let dispBase = hexToRgb(STATES.EXHALE.base);
let dispHi = hexToRgb(STATES.EXHALE.highlight);

let fromSize = dispSize, toSize = dispSize;
let fromBase = dispBase, toBase = hexToRgb(STATES.EXHALE.base);
let fromHi = dispHi, toHi = hexToRgb(STATES.EXHALE.highlight);

// Both transitions are now smooth and comparably paced: inhale fills
// the balloon gradually, and exhale lets it out at a similar gentle
// pace instead of snapping to the deflated size instantly.
const INHALE_TRANSITION_MS = 650;
const EXHALE_TRANSITION_MS = 900;
let activeTransitionMs = EXHALE_TRANSITION_MS;
let transitionStartTime = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = balloonBox.getBoundingClientRect();
  canvas.width = Math.max(1, rect.width) * dpr;
  canvas.height = Math.max(1, rect.height) * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  w = rect.width;
  h = rect.height;
  centerX = w / 2;
  centerY = h * 0.42;
  baseRadius = Math.max(40, Math.min(120, Math.min(w, h) * 0.22));
  expandRadius = baseRadius * 0.75;
  stringAnchorY = h * 0.86;

  if (transitionStartTime === 0) transitionStartTime = performance.now();
}
window.addEventListener('resize', resize);
resize();

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lerpRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function rgbToCss(rgb) {
  return `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;
}

function setState(name) {
  if (calibrating) return; // ignore breath state changes while calibration is running
  if (!STATES[name] || name === currentState) return;
  currentState = name;
  const target = STATES[name];

  fromSize = dispSize; toSize = target.size;
  fromBase = dispBase; toBase = hexToRgb(target.base);
  fromHi = dispHi; toHi = hexToRgb(target.highlight);
  activeTransitionMs = (name === 'EXHALE') ? EXHALE_TRANSITION_MS : INHALE_TRANSITION_MS;
  transitionStartTime = performance.now();

  exhaleLabel.classList.toggle('active', name === 'EXHALE');
  inhaleLabel.classList.toggle('active', name === 'INHALE');

  playBreathTone(name);
}

// ---------------- Oxygen particle system ----------------
let particles = [];
let spawnAccumulator = 0;

function spawnParticle(phase) {
  const angle = Math.random() * Math.PI * 2;
  const balloonR = baseRadius + expandRadius * dispSize;

  if (phase === 'inhale') {
    const spawnDist = balloonR + 140 + Math.random() * 120;
    const x = centerX + Math.cos(angle) * spawnDist;
    const y = centerY + Math.sin(angle) * spawnDist * 0.8;
    const speed = 1.4 + Math.random() * 1.0;
    const dx = centerX - x, dy = centerY - y;
    const dist = Math.hypot(dx, dy) || 1;
    particles.push({ x, y, vx: (dx / dist) * speed, vy: (dy / dist) * speed, radius: 5 + Math.random() * 2.5, alpha: 0, life: 0, phase: 'inhale', label: Math.random() < 0.35 });
  } else {
    const spawnDist = balloonR - 4;
    const x = centerX + Math.cos(angle) * spawnDist;
    const y = centerY + Math.sin(angle) * spawnDist * 0.8;
    const speed = 0.9 + Math.random() * 0.8;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * 0.8, radius: 2.5 + Math.random() * 1.5, alpha: 0, life: 0, phase: 'exhale', label: Math.random() < 0.35 });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.life += 1;
    const balloonR = baseRadius + expandRadius * dispSize;
    const distToCenter = Math.hypot(p.x - centerX, (p.y - centerY) / 0.8);

    if (p.phase === 'inhale') {
      p.alpha = Math.min(1, p.life / 15);
      p.radius = Math.max(1.5, 5 - (1 - (distToCenter / (balloonR + 200))) * 3);
      if (distToCenter <= balloonR + 6) particles.splice(i, 1);
    } else {
      p.alpha = Math.max(0, 1 - p.life / 70);
      p.radius += 0.02;
      if (p.alpha <= 0.02) particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  particles.forEach(p => {
    const color = p.phase === 'inhale' ? `rgba(147, 197, 253, ${p.alpha})` : `rgba(203, 213, 225, ${p.alpha * 0.6})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    if (p.label) {
      ctx.font = '9px system-ui, sans-serif'; ctx.fillStyle = `rgba(226, 232, 240, ${p.alpha * 0.8})`;
      ctx.textAlign = 'center'; ctx.fillText('O\u2082', p.x, p.y - p.radius - 3);
    }
  });
}

function drawString(time, balloonR, noSway) {
  const knotY = centerY + balloonR * 0.92;
  const sway = noSway ? 0 : Math.sin(time / 900) * 10;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(centerX, knotY);
  ctx.quadraticCurveTo(centerX + sway, (knotY + stringAnchorY) / 2, centerX + sway * 0.4, stringAnchorY);
  ctx.stroke();
}

function drawKnot(balloonR, baseColorCss) {
  const knotY = centerY + balloonR * 0.88;
  ctx.beginPath(); ctx.moveTo(centerX - 7, knotY); ctx.lineTo(centerX + 7, knotY); ctx.lineTo(centerX, knotY + 12); ctx.closePath();
  ctx.fillStyle = baseColorCss; ctx.fill();
}

function drawBalloon(balloonR, baseColorCss, highlightColorCss) {
  const rx = balloonR; const ry = balloonR * 1.15;
  const gradient = ctx.createRadialGradient(centerX - rx * 0.3, centerY - ry * 0.35, rx * 0.1, centerX, centerY, Math.max(rx, ry));
  gradient.addColorStop(0, highlightColorCss); gradient.addColorStop(1, baseColorCss);
  ctx.beginPath(); ctx.ellipse(centerX, centerY, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = gradient; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(centerX - rx * 0.35, centerY - ry * 0.45, rx * 0.22, ry * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; ctx.fill();
}

// ---------------- Live heart rate (BPM) ----------------
function freezeBalloon() {
  // Force a static, non-animating resting (exhale) state for the
  // duration of calibration.
  currentState = 'EXHALE';
  dispSize = STATES.EXHALE.size;
  prevDispSize = dispSize;
  dispBase = hexToRgb(STATES.EXHALE.base);
  dispHi = hexToRgb(STATES.EXHALE.highlight);
  fromSize = dispSize; toSize = dispSize;
  fromBase = dispBase; toBase = dispBase;
  fromHi = dispHi; toHi = dispHi;
  transitionStartTime = performance.now();
  particles = [];
  exhaleLabel.classList.remove('active');
  inhaleLabel.classList.remove('active');
  inhaleHoldStartTime = null;
  holdTimerEl.classList.remove('visible');
}

function updateBPM(bpm) {
  bpmValueEl.textContent = bpm;
  // Retrigger the pulse animation on every new reading
  bpmDisplayEl.classList.remove('pulse');
  void bpmDisplayEl.offsetWidth; // force reflow so the animation restarts
  bpmDisplayEl.classList.add('pulse');
}

function resetBPM() {
  bpmValueEl.textContent = '--';
  bpmDisplayEl.classList.remove('pulse');
}

// ---------------- Inhale hold timer ----------------
// Starts counting only once the balloon has finished inflating to its
// max size (i.e. the INHALE transition has fully completed), and
// resets as soon as the state leaves INHALE.
let inhaleHoldStartTime = null;

function updateHoldTimer(time, transitionDone) {
  if (currentState === 'INHALE' && transitionDone) {
    if (inhaleHoldStartTime === null) inhaleHoldStartTime = time;
    const heldSeconds = (time - inhaleHoldStartTime) / 1000;
    holdTimerEl.textContent = `Holding ${heldSeconds.toFixed(1)}s`;
    holdTimerEl.classList.add('visible');
  } else {
    inhaleHoldStartTime = null;
    holdTimerEl.classList.remove('visible');
  }
}

function draw(time) {
  ctx.clearRect(0, 0, w, h);

  if (calibrating) {
    // Balloon stays completely still at rest while calibration runs --
    // no sway, no size change, no oxygen particles. It only starts
    // responding once real breath data comes in after calibration ends.
    updateHoldTimer(time, false);
    const balloonR = baseRadius + expandRadius * dispSize;
    drawString(time, balloonR, true);
    drawBalloon(balloonR, rgbToCss(dispBase), rgbToCss(dispHi));
    requestAnimationFrame(draw);
    return;
  }

  const elapsed = time - transitionStartTime;
  const t = Math.min(1, elapsed / activeTransitionMs);
  const eased = 0.5 - 0.5 * Math.cos(t * Math.PI);

  updateHoldTimer(time, t >= 1);

  dispSize = fromSize + (toSize - fromSize) * eased;
  dispBase = lerpRgb(fromBase, toBase, eased);
  dispHi = lerpRgb(fromHi, toHi, eased);

  const delta = dispSize - prevDispSize;
  prevDispSize = dispSize;

  if (delta > 0.0004) {
    spawnAccumulator++; if (spawnAccumulator > 2) { spawnParticle('inhale'); spawnAccumulator = 0; }
  } else if (delta < -0.0004) {
    spawnAccumulator++; if (spawnAccumulator > 3) { spawnParticle('exhale'); spawnAccumulator = 0; }
  }
  updateParticles();

  const balloonR = baseRadius + expandRadius * dispSize;
  drawParticles(); drawString(time, balloonR); drawBalloon(balloonR, rgbToCss(dispBase), rgbToCss(dispHi));
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

