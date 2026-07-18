// ==================================================================
// plots.js -- live signal plots: ECG trace + R-peak markers, the
// R-peak/MWI envelope plot, and the inhale/exhale peak-height bar
// chart. Owns the ECG/MWI ring buffers and the functions serial.js
// calls to feed them (pushECGSample, pushMWISample, markRPeak,
// pushBreathPeak) as well as the reset functions used on
// connect/disconnect. Depends on dom.js (plotsPanel, the three
// canvases) and balloon.js (hasCalibratedOnce).
// ==================================================================
// ==================================================================
// Live signal plots: ECG trace, R-peak markers, inhale/exhale peak
// heights (inhale plotted below zero, exhale above zero).
// ==================================================================
const ECG_BUFFER_LEN = 400;
const ecgBuffer = new Array(ECG_BUFFER_LEN).fill(null);
// Raw Arduino sample index ('n') that each ecgBuffer slot came from.
// Lets an R-peak (which reports its own true sample index) be matched
// to the exact sample it belongs to instead of whatever happens to be
// newest when the RPEAK line arrives.
const ecgRawIndexBuf = new Array(ECG_BUFFER_LEN).fill(null);
// Monotonically increasing "version" stamped on a buffer slot every time
// it's (re)written with a real sample. Lets the plots tell, per pixel
// column, whether that column currently holds live data or is still
// waiting -- which is what drives the idle-wave / sweep-takeover effect
// below (0 = never written this lap, i.e. still idle).
const ecgSlotSeq = new Array(ECG_BUFFER_LEN).fill(0);
let ecgWritePos = 0;
let rpeakMarks = []; // { pos, seq } -- pos is a raw ecgBuffer index, seq pins it to the sample that was there when detected
let ecgSampleCount = 0;

// A flat placeholder line drawn on plot columns that don't have live
// sensor data yet -- keeps the ECG / R-Peaks plots visibly present
// before a device is connected. Once real samples start landing in
// ecgBuffer (left-to-right, one buffer slot per sample), the real trace
// is drawn on top and progressively overtakes this line, left to right.

const BREATH_HISTORY_LEN = 60;
const breathHistory = []; // { value, isExhale }
let pendingPeakHeight = null; // height reported by RPEAK:, paired with the following INHALE/EXHALE line

// Moving-window-integrated (MWI) envelope stream -- the same signal
// the firmware's Pan-Tompkins detector uses internally to spot QRS
// complexes. Buffered the same way as the raw ECG samples so the
// R-Peaks plot can draw it as one continuous, smooth curve (one hump
// per heartbeat) instead of connecting only the discrete accepted
// R-peak heights.
const MWI_BUFFER_LEN = ECG_BUFFER_LEN;
const mwiBuffer = new Array(MWI_BUFFER_LEN).fill(null);
let mwiWritePos = 0;
let mwiSampleCount = 0;

function pushECGSample(val, rawIndex) {
  ecgBuffer[ecgWritePos] = val;
  ecgRawIndexBuf[ecgWritePos] = (rawIndex !== undefined && !isNaN(rawIndex)) ? rawIndex : null;
  ecgSampleCount++;
  ecgSlotSeq[ecgWritePos] = ecgSampleCount; // this column is now "live" for the current lap
  ecgWritePos = (ecgWritePos + 1) % ECG_BUFFER_LEN;
}

// Clears the ECG / R-Peaks plot data so they fall back to the idle wave
// (e.g. on disconnect), ready to be swept over again by real data next
// time a device connects.
function resetECGPlots() {
  ecgBuffer.fill(null);
  ecgRawIndexBuf.fill(null);
  ecgSlotSeq.fill(0);
  ecgWritePos = 0;
  ecgSampleCount = 0;
  rpeakMarks = [];
  mwiBuffer.fill(null);
  mwiWritePos = 0;
  mwiSampleCount = 0;
}

function pushMWISample(val) {
  mwiBuffer[mwiWritePos] = val;
  mwiWritePos = (mwiWritePos + 1) % MWI_BUFFER_LEN;
  mwiSampleCount++;
}

// peakTime is the R-peak's own raw sample index (same numbering as
// the index sent with each ECG: line). We find the buffered ECG
// sample whose raw index is closest to it and mark that one --
// rather than always marking "the newest sample right now", which is
// what caused markers to land on random points of the trace (and
// therefore appear at the top or bottom depending on luck) since the
// Pan-Tompkins detector confirms a peak several samples after it
// actually occurred.
function markRPeak(peakTime) {
  let pos;
  if (peakTime === undefined || isNaN(peakTime)) {
    // Fallback for older firmware that doesn't send a timestamp: assume
    // the most recently written slot.
    pos = (ecgWritePos - 1 + ECG_BUFFER_LEN) % ECG_BUFFER_LEN;
  } else {
    let bestPos = -1, bestDiff = Infinity;
    for (let i = 0; i < ECG_BUFFER_LEN; i++) {
      if (ecgRawIndexBuf[i] === null) continue;
      const diff = Math.abs(ecgRawIndexBuf[i] - peakTime);
      if (diff < bestDiff) { bestDiff = diff; bestPos = i; }
    }
    if (bestPos === -1) return;
    pos = bestPos;
  }

  // Stamp the mark with the slot's current version so it can tell,
  // later, whether that column has since been swept over by newer data
  // (a fresh, unrelated sample landing on the same slot) and should be
  // dropped instead of drawn on top of the wrong point.
  rpeakMarks.push({ pos, seq: ecgSlotSeq[pos] });
  pruneRpeakMarks();
}

function pruneRpeakMarks() {
  if (rpeakMarks.length === 0) return;
  rpeakMarks = rpeakMarks.filter(m => ecgSlotSeq[m.pos] === m.seq);
}

function pushBreathPeak(height, isExhale) {
  if (!hasCalibratedOnce) return; // hold off until the calibration wizard has finished at least once
  breathHistory.push({ value: height, isExhale });
  if (breathHistory.length > BREATH_HISTORY_LEN) breathHistory.shift();
}

// Clears the Inhale/Exhale plot and requires a fresh calibration pass
// before it starts filling in again -- used on disconnect and whenever a
// (re)calibration begins, so stale bars never linger on screen.
function resetBreathPlot() {
  breathHistory.length = 0;
  hasCalibratedOnce = false;
}

function setupPlotCanvas(canvasEl) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvasEl.getBoundingClientRect();
  canvasEl.width = Math.max(1, rect.width * dpr);
  canvasEl.height = Math.max(1, rect.height * dpr);
  const c = canvasEl.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, cw: rect.width, ch: rect.height };
}

function drawECGPlot() {
  if (!plotsPanel.classList.contains('visible')) return;
  const { c, cw, ch } = setupPlotCanvas(ecgCanvas);
  c.clearRect(0, 0, cw, ch);

  // Raw, un-offset buffer order: slot 0 is always the leftmost pixel and
  // slot ECG_BUFFER_LEN-1 the rightmost. Samples are written into
  // increasing slots as they arrive (see pushECGSample), so a freshly
  // connected device fills the plot left-to-right; once the buffer wraps
  // it keeps sweeping the same way, overwriting the previous lap's trace
  // as it goes -- the classic bedside-monitor "sweep" look.
  const vals = ecgBuffer;
  const present = vals.filter(v => v !== null);

  const mapX = i => (i / (ECG_BUFFER_LEN - 1)) * cw;

  let minV = -1, maxV = 1;
  if (present.length >= 2) {
    minV = Infinity; maxV = -Infinity;
    present.forEach(v => { if (v < minV) minV = v; if (v > maxV) maxV = v; });
    if (maxV - minV < 1e-3) { minV -= 1; maxV += 1; }
    const pad = (maxV - minV) * 0.1;
    minV -= pad; maxV += pad;
  }
  const mapY = v => ch - ((v - minV) / (maxV - minV)) * ch;

  // Flat placeholder line: drawn for every slot that hasn't received a
  // real sample yet this lap. Before a device connects this covers the
  // whole width; as real samples sweep in left-to-right, it shrinks to
  // whatever's left ahead of the live data. Its height matches the last
  // real sample right before it so there's no visible jump where the
  // live trace hands off to the placeholder.
  let idleY = ch / 2;
  for (let i = 0; i < ECG_BUFFER_LEN; i++) {
    if (ecgSlotSeq[i] > 0) continue;
    if (i > 0 && vals[i - 1] !== null && present.length >= 2) idleY = mapY(vals[i - 1]);
    break;
  }
  c.strokeStyle = '#4ade80';
  c.lineWidth = 1.2;
  c.beginPath();
  let started = false;
  for (let i = 0; i < ECG_BUFFER_LEN; i++) {
    if (ecgSlotSeq[i] > 0) { started = false; continue; }
    const x = mapX(i);
    if (!started) { c.moveTo(x, idleY); started = true; } else c.lineTo(x, idleY);
  }
  c.stroke();

  if (present.length < 2) return; // nothing live to draw yet -- placeholder line only

  // Live trace, drawn on top -- this is what visibly "overcomes" the
  // placeholder line as it sweeps across.
  c.strokeStyle = '#4ade80';
  c.lineWidth = 1.4;
  c.beginPath();
  started = false;
  for (let i = 0; i < ECG_BUFFER_LEN; i++) {
    const v = vals[i];
    if (v === null) { started = false; continue; }
    const x = mapX(i), y = mapY(v);
    if (!started) { c.moveTo(x, y); started = true; } else c.lineTo(x, y);
  }
  c.stroke();

  // Highlight each detected R-peak with a small bracket whose roof
  // rests exactly on the spike's tip, with open legs hanging down
  // alongside it (left/top/right strokes only -- bottom stays open).
  pruneRpeakMarks();
  const boxW = Math.max(8, cw / ECG_BUFFER_LEN * 6);
  const boxH = ch * 0.14;
  c.strokeStyle = 'rgba(248, 113, 113, 0.9)';
  c.lineWidth = 1.3;
  c.lineJoin = 'miter';
  rpeakMarks.forEach(m => {
    const posInBuffer = m.pos;

    // The firmware confirms an R-peak a few samples after it actually
    // occurs, so the reported index can land a sample or two off the
    // true local maximum -- enough to visibly miss the tip on a spike
    // this narrow. Snap to the tallest sample in a small window
    // around the reported index so the bracket's roof always rests
    // exactly on the visible apex instead of floating near it.
    const SEARCH_RADIUS = 5;
    let bestPos = -1, bestVal = -Infinity;
    for (let d = -SEARCH_RADIUS; d <= SEARCH_RADIUS; d++) {
      const p = posInBuffer + d;
      if (p < 0 || p >= ECG_BUFFER_LEN) continue;
      const vv = vals[p];
      if (vv === null || vv === undefined) continue;
      if (vv > bestVal) { bestVal = vv; bestPos = p; }
    }
    if (bestPos === -1) return;

    const x = mapX(bestPos), y = mapY(bestVal); // y = the tip itself
    const left = x - boxW / 2, right = x + boxW / 2;
    const bottom = y + boxH;
    c.beginPath();
    c.moveTo(left, bottom);  // bottom-left
    c.lineTo(left, y);       // up the left side to the tip
    c.lineTo(right, y);      // across the roof, resting on the tip
    c.lineTo(right, bottom); // down the right side
    c.stroke();           // bottom left open -- no line back across
  });
}

function drawRPeaksPlot() {
  if (!plotsPanel.classList.contains('visible')) return;
  const { c, cw, ch } = setupPlotCanvas(rpeaksCanvas);
  c.clearRect(0, 0, cw, ch);

  // Plot the moving-window-integrated (MWI) envelope streamed directly
  // from the firmware -- the same signal the Pan-Tompkins detector uses
  // internally to find QRS complexes. This gives one continuous, smooth
  // hump per heartbeat whose height varies with the actual signal
  // (inhale/exhale), rather than an identical fixed-height pulse for
  // every beat. mwiBuffer is written in lockstep with ecgBuffer, so it
  // shares the same raw slot indexing and idle/live status (ecgSlotSeq)
  // as the ECG plot above.
  const vals = mwiBuffer;
  const present = vals.filter(v => v !== null);

  const mapX = i => (i / (MWI_BUFFER_LEN - 1)) * cw;

  let minV = 0, maxV = 1; // envelope is non-negative; anchor baseline at 0
  if (present.length >= 2) {
    maxV = -Infinity;
    present.forEach(v => { if (v > maxV) maxV = v; });
    if (maxV < 1e-3) maxV = 1;
    const pad = maxV * 0.12;
    maxV += pad;
  }
  const mapY = v => ch - ((v - minV) / (maxV - minV)) * ch;

  // Flat placeholder line -- shown for pixel columns whose corresponding
  // ECG slot hasn't received live data yet, so this plot stays in sync
  // with the ECG plot above: same idle look before connecting, and the
  // same left-to-right sweep takeover once data starts arriving. Sits on
  // the same resting baseline as the real trace (y = ch, i.e. height 0)
  // so there's no vertical jump at the hand-off point.
  let idleY = ch;
  for (let i = 0; i < MWI_BUFFER_LEN; i++) {
    if (ecgSlotSeq[i] > 0) continue;
    if (i > 0 && vals[i - 1] !== null && present.length >= 2) idleY = mapY(vals[i - 1]);
    break;
  }
  c.strokeStyle = '#38bdf8';
  c.lineWidth = 1.2;
  c.beginPath();
  let started = false;
  for (let i = 0; i < MWI_BUFFER_LEN; i++) {
    if (ecgSlotSeq[i] > 0) { started = false; continue; }
    const x = mapX(i);
    if (!started) { c.moveTo(x, idleY); started = true; } else c.lineTo(x, idleY);
  }
  c.stroke();

  if (present.length < 2) return; // nothing live to draw yet -- placeholder line only

  // Live envelope trace, drawn on top -- this is what visibly "overcomes"
  // the placeholder line as it sweeps across. Height tracks the real MWI
  // value at each point, so it rises and falls with the actual signal.
  c.strokeStyle = '#38bdf8';
  c.lineWidth = 2;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.beginPath();
  started = false;
  for (let i = 0; i < MWI_BUFFER_LEN; i++) {
    const v = vals[i];
    if (v === null) { started = false; continue; }
    const x = mapX(i), y = mapY(v);
    if (!started) { c.moveTo(x, y); started = true; } else c.lineTo(x, y);
  }
  c.stroke();

  // Soft fill under the envelope for a bit of visual weight.
  c.beginPath();
  started = false;
  let lastX = 0;
  for (let i = 0; i < MWI_BUFFER_LEN; i++) {
    const v = vals[i];
    if (v === null) continue;
    const x = mapX(i), y = mapY(v);
    if (!started) { c.moveTo(x, y); started = true; } else c.lineTo(x, y);
    lastX = x;
  }
  c.lineTo(lastX, ch);
  c.lineTo(mapX(0), ch);
  c.closePath();
  c.fillStyle = 'rgba(56, 189, 248, 0.12)';
  c.fill();
}

function drawBreathPlot() {
  if (!plotsPanel.classList.contains('visible')) return;
  const { c, cw, ch } = setupPlotCanvas(breathCanvas);
  c.clearRect(0, 0, cw, ch);

  const midY = ch / 2;
  const marginY = 4;
  const amplitudeY = midY - marginY;

  // 1. Draw Baseline
  c.strokeStyle = 'rgba(148, 163, 184, 0.35)'; // Light grey baseline
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(0, midY);
  c.lineTo(cw, midY);
  c.stroke();

  if (breathHistory.length === 0) return;

  const barW = cw / BREATH_HISTORY_LEN;

  // Helper to determine Y-level: flat squares, no variable height
  const getLevelY = (p) => {
    return p.isExhale ? midY - amplitudeY : midY + amplitudeY;
  };

  // 2. Draw Connected Color Fills
  c.beginPath();
  c.moveTo(0, midY); // Start at baseline
  breathHistory.forEach((p, i) => {
    const xStart = i * barW;
    const xEnd = xStart + barW;
    const yLevel = getLevelY(p);

    // Step to level, hold flat
    c.lineTo(xStart, yLevel);
    c.lineTo(xEnd, yLevel);
  });
  c.lineTo(cw, midY); // End back at baseline
  c.closePath(); // Form continuous shape for fill

  // Create two separate fills based on the same square-wave path:
  // Using clipping or overlapping fills might be complex. The simplest way
  // to achieve two different, adjacent, constant-height colors with a shared
  // path is to just fill the *entire* wave path with one color, and rely on the
  // previous bar-by-bar approach's colors for the distinct regions.
  // Given the image, the colors are flat and constant. We can just fill the entire wave with amber,
  // and the entire region below the baseline with blue. This will work if the amplitude
  // is large enough to fill the respective halves.

  // Let's keep the discrete fill blocks for robustness, just setting constant height.
  c.beginPath(); // Re-clear path before discrete fills
  breathHistory.forEach((p, i) => {
    const x = i * barW;
    const yLevel = getLevelY(p);
    const top = Math.min(yLevel, midY);
    const height = Math.abs(yLevel - midY);

    c.fillStyle = p.isExhale ? 'rgba(251, 191, 36, 0.3)' : 'rgba(147, 197, 253, 0.3)';
    c.fillRect(x, top, barW, height);
  });

  // 3. Draw Continuous Square-Wave Outline
  c.beginPath();
  // We need to trace the *outline* of the filled blocks, not just the midline.
  // Tracing the top/bottom boundary with vertical transitions.
  let currentY = midY;
  c.moveTo(0, midY);

  breathHistory.forEach((p, i) => {
    const xStart = i * barW;
    const xEnd = xStart + barW;
    const yLevel = getLevelY(p);

    // Vertical transition at the shared edge:
    if (yLevel !== currentY) {
      c.lineTo(xStart, yLevel); // Vertical step
    }
    
    // Horizontal hold across the bar:
    c.lineTo(xEnd, yLevel); // Hold flat
    currentY = yLevel; // Update for next comparison
  });

  // Vertical step back to baseline at the very end
  c.lineTo(breathHistory.length * barW, midY);

  // Dark outline:
  c.strokeStyle = 'rgba(15, 23, 42, 0.9)'; // Dark slate, almost opaque
  c.lineWidth = 1.5;
  c.stroke();
}

function drawAllPlots() {
  drawECGPlot();
  drawRPeaksPlot();
  drawBreathPlot();
}
setInterval(drawAllPlots, 100);
window.addEventListener('resize', drawAllPlots);
