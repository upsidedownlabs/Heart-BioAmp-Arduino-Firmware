// ==================================================================
// calibration.js -- the recalibration wizard: step overlay,
// countdown, instruction queue (paced narration from the device),
// and progress bar. Depends on dom.js (calib-* elements) and
// balloon.js/audio.js/plots.js (freezeBalloon, resetBreathPlot,
// speak, beep, playChime). Calls sendCommand(), defined in serial.js
// -- fine since it's only referenced inside a function body, called
// well after all scripts have loaded.
// ==================================================================
// ---------------- Calibration wizard ----------------
let countdownTimer = null;
const INSTRUCTION_MIN_MS = 3800; 
let calibQueue = [];
let calibQueueTimer = null;

function resetCalibQueue() {
  calibQueue = [];
  if (calibQueueTimer) { clearTimeout(calibQueueTimer); calibQueueTimer = null; }
}

function enqueueCalibStep(action) {
  calibQueue.push(action);
  advanceCalibQueue();
}

function advanceCalibQueue() {
  if (calibQueueTimer) return; 
  const next = calibQueue.shift();
  if (!next) return;

  if (next.type === 'instruction') {
    calibText.textContent = next.text;
    speak(next.text);
  } else if (next.type === 'done') {
    exitCalibrationUI();
    return;
  }

  calibQueueTimer = setTimeout(() => {
    calibQueueTimer = null;
    advanceCalibQueue();
  }, INSTRUCTION_MIN_MS);
}

function showCalibStep(name) {
  Object.entries(calibStepEls).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
}

function openCalibWizard() {
  calibrating = true;
  freezeBalloon();
  resetBreathPlot();
  recalBtn.disabled = true;
  calibOverlay.classList.add('active');
  showCalibStep('intro');
}

function closeCalibWizard() {
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  resetCalibQueue();
  calibrating = false;
  calibOverlay.classList.remove('active');
  recalBtn.disabled = false;
}

function startCalibCountdown() {
  ensureAudioCtx();
  showCalibStep('countdown');
  speak('Get ready. Calibration starting.');
  let count = 3;
  calibCountdownNum.textContent = count;
  countdownTimer = setInterval(() => {
    count--;
    beep(500, 500, 90, 0.04);
    if (count > 0) {
      calibCountdownNum.textContent = count;
      return;
    }
    clearInterval(countdownTimer);
    countdownTimer = null;

    resetCalibQueue();
    currentCalibPhase = 1;
    calibText.textContent = 'Breathe normally...';
    calibFill.style.width = '0%';
    calibPhaseTimer.textContent = '6';
    calibCount.textContent = 'Step 1 of 3';
    showCalibStep('progress');

    sendCommand('C\n');
  }, 1000);
}

function enterCalibrationUI() {
  calibrating = true;
  freezeBalloon();
  resetBreathPlot();
  recalBtn.disabled = true;
  calibOverlay.classList.add('active');
  showCalibStep('progress');
  resetCalibQueue();
  calibFill.style.width = '0%';
  calibCount.textContent = '0 / 18 seconds';
}

const CALIB_PHASE_LABELS = { 1: 'Normal breathing', 2: 'Inhale &amp; hold', 3: 'Exhale out' };
let currentCalibPhase = 1;

function setCalibPhase(phaseNum) {
  currentCalibPhase = phaseNum;
  const label = CALIB_PHASE_LABELS[phaseNum] || 'Calibrating';
  calibPhaseLabel.textContent = `Step ${phaseNum} of 3`;
}

function updateCalibProgress(cur, total) {
  if (!total) return;
  const pct = Math.min(100, (cur / total) * 100);
  calibFill.style.width = pct + '%';
  const remainingSec = Math.max(0, Math.ceil((total - cur) / 1000));
  calibPhaseTimer.textContent = remainingSec;
  calibCount.textContent = `Step ${currentCalibPhase} of 3`;
}

function exitCalibrationUI() {
  hasCalibratedOnce = true; // Mark initial required auto-calibration done
  showCalibStep('done');
  playChime();
  speak('Calibration complete.');
  setTimeout(closeCalibWizard, 1800);
}
