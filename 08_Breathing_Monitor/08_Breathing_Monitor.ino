// Breath_Monitor - Heart BioAmp Candy
// https://github.com/upsidedownlabs/BioAmp-EXG-Pill
// https://github.com/upsidedownlabs/Heart-BioAmp-Arduino-Firmware

// Upside Down Labs invests time and resources providing this open source code,
// please support Upside Down Labs and open-source hardware by purchasing
// products from Upside Down Labs!

// Copyright (c) 2026 - 2026 Upside Down Labs - contact@upsidedownlabs.tech
// Copyright (c) 2026 - Ankit - Ankitmait64@gamil.com

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// At Upside Down Labs, we create open-source DIY neuroscience hardware and software.
// Our mission is to make neuroscience affordable and accessible for everyone.
// By supporting us with your purchase, you help spread innovation and open science.
// Thank you for being part of this journey with us!


#define SAMPLE_RATE 125     // samples per second
#define BAUD_RATE 115200    // serial speed
#define INPUT_PIN A0        // ECG sensor analog pin

// ---------------- Breath Calibrator: 3-phase timed exercise to set inhale/exhale thresholds ----------------
class BreathCalibrator {
public:
  enum Mode { CALIBRATING, TRACKING };

private:
  Mode mode = CALIBRATING;

  enum Phase { PH_NORMAL = 1, PH_INHALE = 2, PH_EXHALE = 3 };
  uint8_t phase = PH_NORMAL;

  static constexpr uint32_t NORMAL_MS = 6000;  // phase 1 duration
  static constexpr uint32_t INHALE_MS = 6000;  // phase 2 duration
  static constexpr uint32_t EXHALE_MS = 6000;  // phase 3 duration

  uint32_t phaseStartMs = 0;   // when current phase began

  float normalSum = 0;  uint16_t normalCount = 0;  // normal-breath peak accumulator
  float inhaleSum = 0;  uint16_t inhaleCount = 0;   // inhale peak accumulator
  float exhaleSum = 0;  uint16_t exhaleCount = 0;   // exhale peak accumulator

  float normalAvg = 270.0f, inhaleAvg = 170.0f, exhaleAvg = 370.0f;  // fallback averages
  float lowTh  = 220.0f;   // below this = inhale
  float highTh = 320.0f;   // above this = exhale

  static constexpr float MIN_SEP = 10.0f;  // min gap to keep thresholds apart

  uint32_t phaseDurationMs(uint8_t p) const {
    if (p == PH_NORMAL) return NORMAL_MS;
    if (p == PH_INHALE) return INHALE_MS;
    return EXHALE_MS;
  }

  void printPhaseInstructions(uint8_t p) {
    Serial.print(F("CALIB_PHASE:"));
    Serial.println(p);
    Serial.print(F("CALIB_INSTRUCTIONS:"));
    switch (p) {
      case PH_NORMAL: Serial.println(F("Breathe normally")); break;
      case PH_INHALE: Serial.println(F("Deep inhale and hold")); break;
      default:        Serial.println(F("Exhale slowly")); break;
    }
  }

  void finishCalibration() {
    normalAvg = (normalCount > 0) ? (normalSum / normalCount) : normalAvg;  // compute averages
    inhaleAvg = (inhaleCount > 0) ? (inhaleSum / inhaleCount) : (normalAvg - 100.0f);
    exhaleAvg = (exhaleCount > 0) ? (exhaleSum / exhaleCount) : (normalAvg + 100.0f);

    if ((normalAvg - inhaleAvg) < MIN_SEP) inhaleAvg = normalAvg - MIN_SEP;  // enforce min gap
    if ((exhaleAvg - normalAvg) < MIN_SEP) exhaleAvg = normalAvg + MIN_SEP;

    lowTh  = (normalAvg + inhaleAvg) / 2.0f;   // midpoint threshold
    highTh = (normalAvg + exhaleAvg) / 2.0f;   // midpoint threshold

    mode = TRACKING;   // calibration done, switch to live mode

    Serial.print(F("CALIB_DONE:LOW="));
    Serial.print(lowTh);
    Serial.print(F(",HIGH="));
    Serial.println(highTh);

    Serial.print(F("CALIB_REF:NORMAL="));
    Serial.print(normalAvg);
    Serial.print(F(",INHALE="));
    Serial.print(inhaleAvg);
    Serial.print(F(",EXHALE="));
    Serial.println(exhaleAvg);
  }

public:
  void begin() {
    mode = CALIBRATING;   // reset and start calibration
    phase = PH_NORMAL;
    normalSum = 0;  normalCount = 0;
    inhaleSum = 0;  inhaleCount = 0;
    exhaleSum = 0;  exhaleCount = 0;
    phaseStartMs = millis();
    Serial.println(F("CALIBRATING"));
    printPhaseInstructions(phase);
  }

  bool isCalibrating() const { return mode == CALIBRATING; }

  void update(float height) {
    if (mode == CALIBRATING) {
      if (phase == PH_NORMAL)      { normalSum += height; normalCount++; }  // bucket peak by phase
      else if (phase == PH_INHALE) { inhaleSum += height; inhaleCount++; }
      else                         { exhaleSum += height; exhaleCount++; }

      uint32_t elapsed = millis() - phaseStartMs;

      Serial.print(F("CALIB_PROGRESS:"));   // report progress for UI bar
      Serial.print(elapsed);
      Serial.print('/');
      Serial.println(phaseDurationMs(phase));

      if (elapsed >= phaseDurationMs(phase)) {
        if (phase < PH_EXHALE) {
          phase++;   // advance to next phase
          phaseStartMs = millis();
          printPhaseInstructions(phase);
        } else {
          finishCalibration();   // all phases done
        }
      }
      return;
    }
    // TRACKING mode: thresholds stay fixed, no drift
  }

  void recalibrate() { begin(); }  // restart on command

  float getLow()  const { return lowTh; }
  float getHigh() const { return highTh; }
};

BreathCalibrator calibrator;


// ---------- Band-Pass ECG Filter: ~5-15 Hz @ 125 Hz, isolates QRS spike ----------
float ECGFilter(float input) {
  float output = input;
  { // biquad stage 1
    static float z1, z2;
    float x = output - 0.70682283 * z1 - 0.15621030 * z2;
    output = 0.28064917 * x + 0.56129834 * z1 + 0.28064917 * z2;
    z2 = z1;
    z1 = x;
  }
  { // biquad stage 2
    static float z1, z2;
    float x = output - 0.95028224 * z1 - 0.54073140 * z2;
    output = 1.0 * x + 2.0 * z1 + 1.0 * z2;
    z2 = z1;
    z1 = x;
  }
  { // biquad stage 3
    static float z1, z2;
    float x = output - -1.95360385 * z1 - 0.95423412 * z2;
    output = 1.0 * x + -2.0 * z1 + 1.0 * z2;
    z2 = z1;
    z1 = x;
  }
  { // biquad stage 4
    static float z1, z2;
    float x = output - -1.98048558 * z1 - 0.98111344 * z2;
    output = 1.0 * x + -2.0 * z1 + 1.0 * z2;
    z2 = z1;
    z1 = x;
  }
  return output;
}

// ---------- Notch Filter: cuts 50 Hz mains hum @ 125 Hz sample rate ----------
class NotchFilter {
private:
  struct BiquadState {
    float z1 = 0, z2 = 0;
  };
  BiquadState state0, state1;
public:
  float process(float input) {
    float output = input;
    float x0 = output - (1.42299444f * state0.z1) - (0.85523677f * state0.z2);  // stage 1
    output = 0.86743200f * x0 + 1.41065685f * state0.z1 + 0.86743200f * state0.z2;
    state0.z2 = state0.z1;
    state0.z1 = x0;
    float x1 = output - (1.59955390f * state1.z1) - (0.87989222f * state1.z2);  // stage 2
    output = 1.0f * x1 + 1.62624487f * state1.z1 + 1.0f * state1.z2;
    state1.z2 = state1.z1;
    state1.z1 = x1;
    return output;
  }
};

// ---------- DC Blocker: ~1 Hz high-pass @ 125 Hz, removes drift/offset ----------
class DCBlocker {
private:
  struct BiquadState {
    float z1 = 0, z2 = 0;
  };
  BiquadState state0;
public:
  float process(float input) {
    float output = input;
    float x0 = output - (-1.92894226f * state0.z1) - (0.93138168f * state0.z2);
    output = 0.96508099f * x0 + -1.93016197f * state0.z1 + 0.96508099f * state0.z2;
    state0.z2 = state0.z1;
    state0.z1 = x0;
    return output;
  }
};

NotchFilter notchFilter;
DCBlocker dcBlocker;

// ---------------- Pan-Tompkins R-peak detector ----------------
#define ECG_HIST 240             // ~1.92s of ECG history at 125 Hz
#define MWI_WIN 20                // 160 ms moving window
#define REFRACT_SAMPLES 25        // 200 ms min gap between beats
#define LEARN_SAMPLES (SAMPLE_RATE * 5)  // 5s initial learning period
#define R_SEARCH_BACK 22          // 176 ms lookback for true R-peak
#define R_SEARCH_FWD 3            // 24 ms lookahead
#define TW_MIN 25                 // T-wave window min gap
#define TW_MAX 45                 // T-wave window max gap
#define TW_SLOPE_RATIO 0.5f       // T-wave slope discrimination ratio
#define RECOVER_MIN_GAP_SAMPLES (SAMPLE_RATE / 2)  // 0.5s between watchdog recoveries
#define NO_QRS_ABS_SAMPLES SAMPLE_RATE              // 1s max blind time
#define MW_BASE_ALPHA 0.01f       // MWI baseline smoothing factor
#define DECAY_SPKI 0.50f          // signal-peak decay on recovery

static inline float f_abs(float x) { return x < 0 ? -x : x; }

float ecgHist[ECG_HIST];      // filtered ECG ring buffer
float slopeHist[ECG_HIST];    // slope ring buffer
uint32_t ecgTime[ECG_HIST];   // timestamp ring buffer
uint16_t ecgW = 0;             // ring buffer write index

float dBuf[5] = { 0 };   // derivative calc buffer
uint8_t dW = 0;

float mwiBuf[MWI_WIN] = { 0 };  // MWI ring buffer
uint8_t mwiW = 0;
float mwiSum = 0;

float m0 = 0, m1 = 0, m2 = 0;      // 3-sample window for local peak detection
uint32_t t0 = 0, t1 = 0, t2 = 0;

float SPKI = 0, NPKI = 0, TH1 = 0, TH2 = 0;  // adaptive signal/noise peak estimates + thresholds
uint32_t lastQRS = 0;         // last accepted QRS sample index
float lastQRSSlope = 0;       // slope at last QRS

uint32_t rrBuf[8] = { 0 };    // RR interval history
uint8_t rrW = 0, rrN = 0;
float rrAvg = (float)SAMPLE_RATE;   // running average RR interval

float sbPeakVal = 0;      // best unconfirmed candidate peak
uint32_t sbPeakTime = 0;

uint32_t learnCount = 0;   // used only during learning period
float learnMax = 0, learnSum = 0;

bool mwBaseInit = false;   // MWI noise-floor baseline
float mwBase = 0;
uint32_t lastRecover = 0;

uint32_t n = 0;   // absolute sample counter (timestamp for everything)

void onRPeakDetected(float peakHeight, uint32_t peakTime);  // forward declaration

float derivative5(float x) {   // 5-point derivative, estimates signal slope
  dBuf[dW] = x;
  dW = (dW + 1) % 5;
  uint8_t i = dW;
  float xn2 = dBuf[(i + 3) % 5];
  float xn1 = dBuf[(i + 4) % 5];
  float xp1 = dBuf[(i + 1) % 5];
  float xp2 = dBuf[(i + 2) % 5];
  return (-xn2 - 2.0f * xn1 + 2.0f * xp1 + xp2) / 8.0f;
}

float mwi(float x) {   // moving window integration, smooths squared derivative
  mwiSum -= mwiBuf[mwiW];
  mwiBuf[mwiW] = x;
  mwiSum += x;
  mwiW = (mwiW + 1) % MWI_WIN;
  return mwiSum / (float)MWI_WIN;
}

void rrUpdate(uint32_t rr) {   // updates running RR-interval average
  rrBuf[rrW] = rr;
  rrW = (rrW + 1) & 7;
  if (rrN < 8) rrN++;
  uint32_t s = 0;
  for (uint8_t i = 0; i < rrN; i++) s += rrBuf[i];
  rrAvg = (rrN > 0) ? (float)s / (float)rrN : (float)SAMPLE_RATE;
}

float slopeAround(uint32_t timeCenter, uint8_t halfWin) {   // finds steepest slope near a time
  float best = 0.0f;
  for (uint16_t k = 0; k < ECG_HIST; k++) {
    uint16_t idx = (ecgW + ECG_HIST - 1 - k) % ECG_HIST;
    int32_t dt = (int32_t)ecgTime[idx] - (int32_t)timeCenter;
    if (dt > (int32_t)halfWin) continue;
    if (dt < -(int32_t)halfWin) break;
    float v = slopeHist[idx];
    if (v > best) best = v;
  }
  return best;
}

bool findRpeak(uint32_t qrsTime, uint32_t& rTimeOut, float& rHeightOut) {   // finds true R-peak sample near confirmed QRS
  float bestAbs = -1.0f;
  float bestSlope = -1.0f;
  uint32_t bestTime = 0;
  float bestVal = 0;

  for (uint16_t k = 0; k < ECG_HIST; k++) {
    uint16_t idx = (ecgW + ECG_HIST - 1 - k) % ECG_HIST;
    int32_t dt = (int32_t)ecgTime[idx] - (int32_t)qrsTime;
    if (dt > (int32_t)R_SEARCH_FWD) continue;
    if (dt < -(int32_t)R_SEARCH_BACK) break;

    float v = ecgHist[idx];
    float av = f_abs(v);
    float s = slopeHist[idx];

    if (av > bestAbs || (av == bestAbs && s > bestSlope)) {   // pick largest amplitude, tie-break by slope
      bestAbs = av;
      bestSlope = s;
      bestTime = ecgTime[idx];
      bestVal = v;
    }
  }

  if (bestTime == 0) return false;
  rTimeOut = bestTime;
  rHeightOut = f_abs(bestVal);
  return true;
}

void updateThresholds() {   // recomputes TH1/TH2 from SPKI/NPKI
  TH1 = NPKI + 0.25f * (SPKI - NPKI);
  TH2 = 0.40f * TH1;
}

bool acceptQRS(uint32_t peakTime) {   // timing-based rules to reject noise/T-waves
  if (lastQRS != 0) {
    uint32_t dt = peakTime - lastQRS;
    if (dt < REFRACT_SAMPLES) return false;   // too soon, reject

    if (dt >= TW_MIN && dt <= TW_MAX) {   // possible T-wave window
      float slopeNow = slopeAround(peakTime, 2);
      if (lastQRSSlope > 0.0f && slopeNow < (TW_SLOPE_RATIO * lastQRSSlope)) return false;
    }

    if (rrN >= 2) {   // reject physiologically implausible speed
      float dtrr = (float)dt;
      if (dtrr < 0.30f * rrAvg) return false;
    }
  }
  return true;
}

void watchdogRecoverIfBlind() {   // loosens thresholds if no beat detected too long
  if (n < LEARN_SAMPLES) return;
  if (lastQRS == 0) return;

  uint32_t blindLimit = (uint32_t)(1.5f * rrAvg);
  if (blindLimit < NO_QRS_ABS_SAMPLES) blindLimit = NO_QRS_ABS_SAMPLES;

  uint32_t sinceQRS = n - lastQRS;
  if (sinceQRS <= blindLimit) return;   // not blind yet

  if ((n - lastRecover) < RECOVER_MIN_GAP_SAMPLES) return;   // don't recover too often
  lastRecover = n;

  SPKI *= DECAY_SPKI;                         // shrink signal estimate
  NPKI = 0.90f * NPKI + 0.10f * mwBase;        // nudge noise estimate toward baseline

  if (NPKI < 1e-6f) NPKI = 1e-6f;
  if (SPKI < NPKI) SPKI = NPKI;

  updateThresholds();
  sbPeakVal = 0.0f;
  sbPeakTime = 0;
}

void handleMWIPeak(float peakVal, uint32_t peakTime) {   // decides if MWI peak is a real QRS
  if (n < LEARN_SAMPLES) {   // learning period: just gather stats
    learnCount++;
    learnSum += peakVal;
    if (peakVal > learnMax) learnMax = peakVal;
    if (n == LEARN_SAMPLES - 1) {
      SPKI = learnMax;
      NPKI = (learnCount > 0) ? (learnSum / (float)learnCount) : (0.1f * learnMax);
      updateThresholds();
    }
    return;
  }

  bool isQRS = (peakVal >= TH1) && acceptQRS(peakTime);

  if (!isQRS) {   // treat as noise
    NPKI = 0.125f * peakVal + 0.875f * NPKI;
    updateThresholds();
    if (peakVal > TH2 && peakVal > sbPeakVal) {   // remember as search-back candidate
      sbPeakVal = peakVal;
      sbPeakTime = peakTime;
    }
    return;
  }

  // confirmed QRS
  uint32_t rr = (lastQRS == 0) ? (uint32_t)rrAvg : (peakTime - lastQRS);
  lastQRS = peakTime;
  rrUpdate(rr);   // update RR average (feeds BPM)

  lastQRSSlope = slopeAround(peakTime, 2);

  SPKI = 0.125f * peakVal + 0.875f * SPKI;   // update signal-peak estimate
  updateThresholds();

  sbPeakVal = 0.0f;
  sbPeakTime = 0;

  uint32_t rT = 0;
  float rHeight = 0;
  if (findRpeak(peakTime, rT, rHeight)) {   // locate true R-peak and report it
    onRPeakDetected(rHeight, rT);
  }
}

void searchbackIfNeeded() {   // recovers a possibly missed beat if overdue
  if (n < LEARN_SAMPLES) return;
  if (lastQRS == 0) return;

  float since = (float)(n - lastQRS);
  if (since <= 1.66f * rrAvg) return;   // not overdue yet

  if (sbPeakTime != 0 && sbPeakVal >= TH2 && acceptQRS(sbPeakTime)) {   // recover the candidate
    uint32_t rr = sbPeakTime - lastQRS;
    lastQRS = sbPeakTime;
    rrUpdate(rr);

    lastQRSSlope = slopeAround(sbPeakTime, 2);

    SPKI = 0.125f * sbPeakVal + 0.875f * SPKI;
    updateThresholds();

    uint32_t rT = 0;
    float rHeight = 0;
    if (findRpeak(sbPeakTime, rT, rHeight)) {
      onRPeakDetected(rHeight, rT);
    }

    sbPeakVal = 0.0f;
    sbPeakTime = 0;
  } else {   // no good candidate, just relax noise estimate
    sbPeakVal = 0.0f;
    sbPeakTime = 0;
    NPKI *= 0.95f;
    updateThresholds();
  }
}

// ---------------- Heart rate (BPM) from RR interval average ----------------
static uint8_t lastSentBPM = 0;

void reportHeartRate() {
  if (rrN < 3) return;                         // need a few beats first
  if (rrAvg <= 0.0f) return;

  float bpmF = 60.0f * (float)SAMPLE_RATE / rrAvg;   // samples -> BPM conversion
  if (bpmF < 30.0f || bpmF > 220.0f) return;    // reject implausible values

  uint8_t bpm = (uint8_t)(bpmF + 0.5f);   // round to nearest integer
  if (bpm == lastSentBPM) return;         // only send on change
  lastSentBPM = bpm;

  Serial.print(F("BPM:"));
  Serial.println(bpm);
}

// ---------------- Breath Detector: two-threshold hysteresis on R-peak height ----------------
class BreathDetector {
public:
  enum State { INHALE, EXHALE };

private:
  State state = EXHALE;
  float lowTh = 200.0f;    // below = inhale
  float highTh = 240.0f;   // above = exhale

public:
  void setThresholds(float lo, float hi) {
    lowTh = lo;
    highTh = hi;
  }

  bool onPeak(float height) {
    State candidate = state;
    if (height < lowTh) candidate = INHALE;
    else if (height >= highTh) candidate = EXHALE;
    // else: dead zone, keep previous state

    bool changed = (candidate != state);
    state = candidate;
    return changed;
  }

  State getState() { return state; }
};

BreathDetector breathDetector;


void onRPeakDetected(float peakHeight, uint32_t peakTime) {   // fired on every confirmed R-peak
  reportHeartRate();

  Serial.print(F("RPEAK:"));   // stream peak height + true sample index
  Serial.print(peakHeight);
  Serial.print(',');
  Serial.println(peakTime);

  calibrator.update(peakHeight);   // feed peak into calibration

  if (calibrator.isCalibrating()) return;   // skip breath classification during calibration

  breathDetector.setThresholds(calibrator.getLow(), calibrator.getHigh());
  breathDetector.onPeak(peakHeight);

  BreathDetector::State s = breathDetector.getState();
  if (s == BreathDetector::INHALE) {
    Serial.println(F("INHALE"));
  } else {
    Serial.println(F("EXHALE"));
  }
}

void checkSerialCommands() {   // listens for 'C'/'c' to restart calibration
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == 'C' || c == 'c') {
      calibrator.recalibrate();
    }
  }
}

static uint8_t ecgStreamDivider = 0;
void streamECGSample(float value, uint32_t sampleIndex) {   // sends filtered ECG at ~62.5 Hz
  ecgStreamDivider++;
  if (ecgStreamDivider < 2) return;   // skip every other sample
  ecgStreamDivider = 0;
  Serial.print(F("ECG:"));
  Serial.print(value, 1);
  Serial.print(',');
  Serial.println(sampleIndex);
}

static uint8_t mwiStreamDivider = 0;
void streamMWISample(float value, uint32_t sampleIndex) {   // sends MWI envelope at ~62.5 Hz
  mwiStreamDivider++;
  if (mwiStreamDivider < 2) return;
  mwiStreamDivider = 0;
  Serial.print(F("MWI:"));
  Serial.print(value, 1);
  Serial.print(',');
  Serial.println(sampleIndex);
}

void setup() {
  Serial.begin(BAUD_RATE);
  for (uint16_t i = 0; i < ECG_HIST; i++) {   // clear history buffers
    ecgHist[i] = 0;
    slopeHist[i] = 0;
    ecgTime[i] = 0;
  }
  calibrator.begin();   // start calibration immediately
}

void loop() {
  checkSerialCommands();   // check for recalibration command

  static unsigned long past = 0;
  unsigned long present = micros();
  unsigned long interval = present - past;
  past = present;
  static long timer = 0;
  timer -= interval;   // precise 125 Hz timing loop

  if (timer < 0) {
    timer += 1000000 / SAMPLE_RATE;   // schedule next sample

    float sensor_value = analogRead(INPUT_PIN);   // raw ADC read

    float bandpassed = ECGFilter(sensor_value);    // isolate QRS band
    float notched = notchFilter.process(bandpassed);  // remove 50 Hz hum
    float stabilized = dcBlocker.process(notched);    // remove drift/offset

    streamECGSample(stabilized, n);   // send filtered sample to browser

    float d = derivative5(stabilized);   // slope estimate
    float slope = f_abs(d);
    float s2 = d * d;                    // square emphasizes QRS over noise
    float mw = mwi(s2);                  // smooth into energy envelope

    streamMWISample(mw, n);   // send MWI envelope to browser

    ecgHist[ecgW] = stabilized;   // store into ring buffer history
    slopeHist[ecgW] = slope;
    ecgTime[ecgW] = n;
    ecgW = (ecgW + 1) % ECG_HIST;

    m0 = m1; t0 = t1;   // shift 3-sample peak-detection window
    m1 = m2; t1 = t2;
    m2 = mw;  t2 = n;

    if (n >= LEARN_SAMPLES) {
      if (!mwBaseInit) {   // seed noise-floor baseline
        mwBase = mw;
        mwBaseInit = true;
      }
      if (mw < TH1) mwBase = (1.0f - MW_BASE_ALPHA) * mwBase + MW_BASE_ALPHA * mw;
      watchdogRecoverIfBlind();   // recover if detector stuck
    }

    if (n >= 2 && (m1 > m0) && (m1 >= m2)) handleMWIPeak(m1, t1);   // local peak found

    searchbackIfNeeded();   // recover a possibly missed beat

    n++;   // advance sample counter
  }
}