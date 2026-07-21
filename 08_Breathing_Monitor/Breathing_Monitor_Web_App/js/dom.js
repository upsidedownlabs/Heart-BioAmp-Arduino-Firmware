// ==================================================================
// dom.js -- cached DOM element references used across all other
// modules, plus the electrode-placement guide overlay (small enough
// to not need its own file). Must be loaded first: every other
// script assumes these consts already exist.
// ==================================================================
const canvas = document.getElementById('canvas');
const balloonBox = document.getElementById('balloon-box');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const recalBtn = document.getElementById('recal-btn');
const inhaleLabel = document.getElementById('inhale-label');
const exhaleLabel = document.getElementById('exhale-label');
const unsupportedEl = document.getElementById('unsupported');
const holdTimerEl = document.getElementById('hold-timer');
const bpmDisplayEl = document.getElementById('bpm-display');
const bpmValueEl = document.getElementById('bpm-value');
const calibOverlay = document.getElementById('calib-overlay');
const calibText = document.getElementById('calib-text');
const calibFill = document.getElementById('calib-progress-fill');
const calibCount = document.getElementById('calib-count');
const calibPhaseLabel = document.getElementById('calib-phase-label');
const calibPhaseTimer = document.getElementById('calib-phase-timer');
const calibCountdownNum = document.getElementById('calib-countdown-num');
const calibStartBtn = document.getElementById('calib-start-btn');
const calibCancelBtn = document.getElementById('calib-cancel-btn');
const calibStepEls = {
  intro: document.getElementById('calib-step-intro'),
  countdown: document.getElementById('calib-step-countdown'),
  progress: document.getElementById('calib-step-progress'),
  done: document.getElementById('calib-step-done')
};

const electrodeBtn = document.getElementById('electrode-btn');
const electrodeOverlay = document.getElementById('electrode-overlay');
const electrodeCloseBtn = document.getElementById('electrode-close-btn');

const soundBtn = document.getElementById('sound-btn');
const plotsPanel = document.getElementById('plots-panel');
const ecgCanvas = document.getElementById('plot-ecg');
const rpeaksCanvas = document.getElementById('plot-rpeaks');
const breathCanvas = document.getElementById('plot-breath');

function openElectrodeGuide() {
  window.open('https://docs.upsidedownlabs.tech/guides/usage-guides/using-gel-electrodes/index.html#using-gel-electrodes', '_blank', 'noopener');
}
function closeElectrodeGuide() {
  electrodeOverlay.classList.remove('active');
}

electrodeBtn.addEventListener('click', openElectrodeGuide);
electrodeCloseBtn.addEventListener('click', closeElectrodeGuide);
electrodeOverlay.addEventListener('click', (e) => {
  if (e.target === electrodeOverlay) closeElectrodeGuide(); // click outside modal closes it
});
