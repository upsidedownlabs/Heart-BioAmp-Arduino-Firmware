// ==================================================================
// Sound & narration engine
// ==================================================================
let soundEnabled = true;
let audioCtx = null;

function ensureAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function beep(freqStart, freqEnd, durationMs, gainLevel = 0.05) {
  if (!soundEnabled) return;
  const ac = ensureAudioCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  const t0 = ac.currentTime;
  const dur = durationMs / 1000;
  osc.frequency.setValueAtTime(freqStart, t0);
  osc.frequency.linearRampToValueAtTime(freqEnd, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainLevel, t0 + dur * 0.15);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function playBreathTone(name) {
  if (name === 'INHALE') beep(320, 520, 260, 0.045);
  else beep(420, 240, 220, 0.045);
}

function playChime() {
  beep(660, 880, 180, 0.05);
}

function speak(text) {
  if (!soundEnabled) return;
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 0.9;
    window.speechSynthesis.speak(utter);
  } catch (e) { console.error(e); }
}

function setSoundEnabled(on) {
  soundEnabled = on;
  soundBtn.textContent = on ? 'Sound: On' : 'Sound: Off';
  soundBtn.classList.toggle('on', on);
  if (!on && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

soundBtn.addEventListener('click', () => {
  ensureAudioCtx();
  setSoundEnabled(!soundEnabled);
});
setSoundEnabled(true);
