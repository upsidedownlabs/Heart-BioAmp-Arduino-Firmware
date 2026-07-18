# Breathing Monitor

Turn your heartbeat into your breath. This project uses an ECG sensor strapped to your chest to extract your **respiratory signal** - the subtle rise and fall your breathing imprints on your ECG baseline - and turns it into a balloon on screen that **inflates on inhale and deflates on exhale**, alongside live ECG, R-peak, and breath-strength plots.

Under the hood: the **Heart BioAmp Candy** picks up your ECG, the **Arduino Uno R4 Minima** runs a Pan–Tompkins-style R-peak detector plus a moving-window-integration (MWI) envelope, and a browser-based web app (using the **Web Serial API** - no installs) reads that stream and drives the animation.

---

## Table of Contents

- [Supplies](#supplies)
- [Getting Started](#getting-started)
  - [1. Connect Heart BioAmp Candy to Arduino](#1-connect-heart-bioamp-candy-to-arduino)
  - [2. Connect V3 Snap Cable to Heart BioAmp Candy](#2-connect-v3-snap-cable-to-heart-bioamp-candy)
  - [3. Skin Preparation](#3-skin-preparation)
  - [4. Electrode Placement](#4-electrode-placement)
  - [5. Upload the Firmware](#5-upload-the-firmware)
  - [6. Open the Web App](#6-open-the-web-app)
  - [7. Connect to the Arduino Board](#7-connect-to-the-arduino-board)
  - [8. Calibration](#8-calibration)
  - [9. Watch Yourself Breathe](#9-watch-yourself-breathe)
- [Troubleshooting](#troubleshooting)


---

## Supplies

### Hardware
- **Heart BioAmp Candy** - [Tindie](https://www.tindie.com/products/upsidedownlabs/heart-bioamp-candy-ecg-sensor/) · [Amazon](https://www.amazon.in/electrode-included-Upside-Down-Labs/dp/B0DPKM8S7C) · [Upside Down Labs Store](https://store.upsidedownlabs.tech/product/heart-bioamp-candy/)
- **Arduino Uno R4 Minima** - [Arduino Official Store](https://store-usa.arduino.cc/products/uno-r4-minima) · [Amazon](https://www.amazon.com/Arduino-UNO-Minima-ABX00080-Connector/dp/B0C78K4CD4)
- NuPrep Skin Prep Gel
- Alcohol swabs
- USB to Type-C cable 
- A laptop

### Software
- [Arduino IDE](https://www.arduino.cc/en/software) (to flash the firmware)
- The Breathing Monitor web app in this repository (`index.html` + `css/` + `js/`) - runs locally in a supported browser, no installs
- Browser: **Chrome, Edge, or Opera**

---

## Getting Started

### 1. Connect Heart BioAmp Candy to Arduino

Connect the Heart BioAmp Candy to the Arduino Uno R4 Minima using jumper wires:

| Heart BioAmp Candy | Arduino Uno R4 Minima |
|---|---|
| VCC | 5V |
| GND | GND |
| OUT | A0 |

> **Be careful with GND and VCC especially** - reversing them can damage the sensor.

### 2. Connect V3 Snap Cable to Heart BioAmp Candy

Once wired up, connect the **BioAmp Cable v3** to the Heart BioAmp Candy's snap connector. This cable is what runs from the sensor to your body.

### 3. Skin Preparation

Clean signal starts with clean skin - dead skin cells and oils are the biggest source of noisy ECG.

1. Pick your electrode sites (see [Electrode Placement](https://docs.upsidedownlabs.tech/guides/usage-guides/using-gel-electrodes/index.html#using-gel-electrodes) for exact positions).
2. Rub a small amount of **NuPrep Skin Prep Gel** onto each site.
3. Wipe the area clean with an **alcohol swab**.
4. Let the skin to dry for a few seconds before applying electrodes.
you can visit the Skip [preparation documentation](https://docs.upsidedownlabs.tech/guides/usage-guides/skin-preparation/index.html#skin-preparation) for more detailed tut0rial

### 4. Electrode Placement

Snap the v3 cable leads onto the electrodes, peel off the backing, and place them on your chest as follows:

| Channel | Positive (+) Electrode | Negative (−) Electrode |
|---|---|---|
| CH1 | 2–3 cm to the right of IN− (red wire) | Left side of chest (black wire) |

visit the [documentation](https://docs.upsidedownlabs.tech/guides/usage-guides/using-gel-electrodes/index.html#using-gel-electrodes) for proper guide

### 5. Upload the Firmware

1. Copy the firmware code from the [`firmware/`](./firmware) folder in this repository.
2. Open the **Arduino IDE**.
3. Install the Arduino UNO R4 board package: **Tools → Board → Boards Manager** → search "Arduino UNO R4 Boards" → install the latest version.
   - If any installation/permission pop-up appears, click **OK**, **Install**, or **Allow** to continue.
4. Create a new sketch: **File → New Sketch**.
5. Select all the default code (**Ctrl+A**) and replace it by pasting the copied code (**Ctrl+V**).
6. Connect the Arduino board to your laptop via USB.
7. Select the board: **Tools → Board → Arduino UNO R4 Minima**.
8. Select the correct port: **Tools → Port** → choose the port corresponding to your Arduino board.
   - *If you can't find your port, disconnect the Arduino and reconnect it.*
9. Click **Upload** (→) and wait for it to complete successfully.

> **Important:** For the best signal acquisition, make sure your laptop is **not connected to a charger** and sit at least **5 m away from any AC appliances**.

### 6. Open the Web App

After uploading the firmware, open the Breathing Monitor web app:

1. Go to this repository and download it as a ZIP (**Code → Download ZIP**)
2. Extract the downloaded ZIP into a folder on your computer.
3. Open the folder and double-click `index.html` to launch it in your browser.
4. Make sure it opens in **Chrome, Edge, or Opera**.

### 7. Connect to the Arduino Board

1. Click **Connect** in the top-right corner.
2. Your browser will show a list of serial devices - select your Arduino Uno R4 Minima and click **Connect**.
> **Pro tip:** Keep your laptop bluetooth **off** to avoid opening multiple serial devices at a time.

### 8. Calibration

The first time you connect (or whenever you click **Calibrate**), a calibration window appears:

1. Click **Start** whenever you're ready.
2. A 3-second countdown gives you time to get into position and relax.
3. Follow the three guided phases, ~6 seconds each:
   - **Normal breathing** - breathe as you normally would.
   - **Deep inhale and hold** - take a deep breath in and hold it.
   - **Exhale slowly** - let the breath out slowly and steadily.
4. Once all three phases complete, you'll see a confirmation and the wizard closes automatically.

> **Pro tip:** During the "exhale slowly" phase, resist the urge to exhale quickly right after the deep-hold step - a slow, steady exhale gives the calibration a cleaner range to map against, and makes the balloon's inflate/deflate response feel much more natural afterward.

### 9. Watch Yourself Breathe

Once calibrated, the balloon on screen will **inflate as you inhale and deflate as you exhale**, matched to your live respiratory signal. Alongside it, you'll also see:

- **ECG Signal** - your live raw ECG trace
- **Peak Envelope** - the detected heartbeat envelope
- **Inhale/Exhale** - a plot showing when you inhale and when you exhale

---

## Troubleshooting

**Not connected successfully**
Use Chrome, Edge, or Opera. Safari and Firefox don't support the Web Serial API yet.

**No device shows up in the Connect dialog**
- Make sure the USB cable is connected properly.
- Try a different USB port, and avoid unpowered USB hubs.

**Connected, but the ECG trace is flat or missing**
- Double-check VCC/GND/OUT wiring between the Candy and the Arduino.

**ECG trace is very noisy / jittery**
- Re-do skin prep (see [Skin Preparation](https://docs.upsidedownlabs.tech/guides/usage-guides/skin-preparation/index.html#skin-preparation)) - this is the #1 cause of noise.
- Sit at least ~5 m away from AC-powered appliances, chargers, or monitors while recording.
- Make sure your laptop isn't plugged into its charger during a session - mains hum is a common noise source.
- Check that electrodes haven't dried out or lost adhesion.

**Calibration keeps failing or the balloon barely moves**
- Stay still and avoid talking during the countdown and the "normal breathing" phase.
- Make sure the "deep inhale and hold" phase is a genuinely deep breath, not a shallow one.
- Re-run calibration via the **Recalibrate** button - electrode placement or posture shifts can change your baseline.

---
