// ==================================================================
// serial.js -- Web Serial connection to the Arduino: connect/
// disconnect, the read loop that parses incoming lines (ECG:, MWI:,
// RPEAK:, BPM:, INHALE/EXHALE, CALIB_*) and routes them to plots.js/
// balloon.js/calibration.js, plus the top-level button listeners.
// Loaded last: it wires up listeners on elements/functions every
// other module defines.
// ==================================================================
// ---- Web Serial connection to the Arduino ----
let port = null; let reader = null; let readableStreamClosed = null;
let writer = null; let writableStreamClosed = null; let keepReading = false;

function setStatus(text, cls) {
  statusEl.textContent = text;
  statusEl.className = cls;
}

async function connectSerial() {
  statusEl.disabled = true;
  setStatus('Connecting...', 'connecting');
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });

    const textEncoder = new TextEncoderStream();
    writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
    writer = textEncoder.writable.getWriter();

    keepReading = true;
    setStatus('Disconnect', 'connected');
    statusEl.disabled = false;
    recalBtn.classList.add('visible');

    // Show the calibration wizard's intro screen on every connection,
    // but wait for the user to click "Start" before the countdown
    // (and the timed exercise on the Arduino) actually begins.
    openCalibWizard();

    readLoop();
  } catch (err) {
    console.error(err); port = null;
    setStatus('Connect', 'disconnected'); statusEl.disabled = false;
  }
}

async function sendCommand(cmd) {
  if (!writer) return;
  try { await writer.write(cmd); } catch (err) { console.error(err); }
}

async function readLoop() {
  const textDecoder = new TextDecoderStream();
  readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
  reader = textDecoder.readable.getReader();

  let buffer = '';
  try {
    while (keepReading) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let lines = buffer.split('\n');
      buffer = lines.pop();
      for (const raw of lines) {
        const line = raw.trim();
        if (line.length === 0) continue;
        const upper = line.toUpperCase();

        if (upper === 'INHALE' || upper === 'EXHALE') {
          setState(upper);
          if (pendingPeakHeight !== null) {
            pushBreathPeak(pendingPeakHeight, upper === 'EXHALE');
            pendingPeakHeight = null;
          }
        } else if (upper === 'CALIBRATING') {
          enterCalibrationUI();
        } else if (upper.startsWith('CALIB_PHASE:')) {
          const phaseNum = parseInt(line.split(':')[1], 10);
          setCalibPhase(phaseNum);
        } else if (upper.startsWith('CALIB_INSTRUCTIONS:')) {
          enqueueCalibStep({ type: 'instruction', text: line.substring('CALIB_INSTRUCTIONS:'.length) });
        } else if (upper.startsWith('CALIB_PROGRESS:')) {
          const frac = line.split(':')[1] || '';
          const [cur, total] = frac.split('/').map(Number);
          if (!isNaN(cur) && !isNaN(total)) updateCalibProgress(cur, total);
        } else if (upper.startsWith('CALIB_DONE')) {
          enqueueCalibStep({ type: 'done' });
        } else if (upper.startsWith('BPM:')) {
          const bpm = parseInt(line.split(':')[1], 10);
          if (!isNaN(bpm)) updateBPM(bpm);
        } else if (upper.startsWith('ECG:')) {
          const parts = line.substring(4).split(',');
          const v = parseFloat(parts[0]);
          const rawIdx = parts.length > 1 ? parseInt(parts[1], 10) : undefined;
          if (!isNaN(v)) pushECGSample(v, rawIdx);
        } else if (upper.startsWith('MWI:')) {
          const parts = line.substring(4).split(',');
          const v = parseFloat(parts[0]);
          if (!isNaN(v)) pushMWISample(v);
        } else if (upper.startsWith('RPEAK:')) {
          const parts = line.substring(6).split(',');
          const v = parseFloat(parts[0]);
          const peakTime = parts.length > 1 ? parseInt(parts[1], 10) : undefined;
          if (!isNaN(v)) {
            markRPeak(peakTime);
            pendingPeakHeight = v;
          }
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    reader.releaseLock();
    await cleanupPort();
    if (keepReading) {
      keepReading = false;
      setStatus('Connect', 'disconnected');
      recalBtn.classList.remove('visible');
      closeCalibWizard();
      freezeBalloon();
      resetBPM();
      resetECGPlots();
      resetBreathPlot();
    }
  }
}

async function cleanupPort() {
  try { await readableStreamClosed.catch(() => {}); } catch (e) {}
  try { if (writer) await writer.close().catch(() => {}); await writableStreamClosed.catch(() => {}); } catch (e) {}
  try { await port.close(); } catch (e) {}
  writer = null; port = null;
}

async function disconnectSerial() {
  statusEl.disabled = true;
  setStatus('Disconnecting...', 'connecting');
  keepReading = false;
  try { await reader.cancel(); } catch (e) { console.error(e); }
  setStatus('Connect', 'disconnected');
  statusEl.disabled = false;
  recalBtn.classList.remove('visible');
  closeCalibWizard();
  freezeBalloon();
  resetBPM();
  resetECGPlots();
  resetBreathPlot();
}

statusEl.addEventListener('click', () => { port ? disconnectSerial() : connectSerial(); });
recalBtn.addEventListener('click', () => { openCalibWizard(); });
calibStartBtn.addEventListener('click', () => { startCalibCountdown(); });
calibCancelBtn.addEventListener('click', () => { closeCalibWizard(); });

if (!('serial' in navigator)) {
  statusEl.style.display = 'none'; recalBtn.style.display = 'none'; unsupportedEl.style.display = 'block';
}
