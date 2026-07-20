# ❤️ Heart Rate Monitor using NPG Lite

 measures your **heart rate (BPM = Beats Per Minute)** using the **NPG Lite** board by Upside Down Labs, and sends the reading wirelessly over **Bluetooth (BLE)** to your phone.

- You just need to stick **3 gel Electrodes** on your body and clip them to the NPG Lite.
- The board reads the tiny electrical signal from your heart, cleans it up, and calculates your BPM.
- It then sends that BPM number over **Bluetooth** to your phone using the **nRF Connect app**.

---

## 🧩 What You Need (Hardware)

| Item | What it does |
|---|---|
| **NPG Lite board** (ESP32 built-in) | Reads your heartbeat signal and calculates BPM - this is the only board you need |
| **3 Gel Electrodes** | Stick on your skin to pick up your heartbeat |
| **V3 Snap cables**  | Connects the electrodes to the NPG Lite |
| **USB cable** | To power the board and upload the code |
| **Phone with Bluetooth + nRF Connect app** | To receive and view the live BPM reading |

---

## 🔌 Hardware Connections

| Pin on NPG Lite | What it means | Where to stick the electrode |
|---|---|---|
| **A0P** (Positive) | Picks up the "positive" heart signal | Left side of chest, or inside of left wrist |
| **A0N** (Negative) | Picks up the "negative" heart signal | Right side of chest, or inside of right wrist |
| **REF** (Reference) | Ground / reference point, removes noise | A bony or low-muscle area, like your right ankle or lower rib |

### Step-by-step:
1. Plug the 3-wire electrode cable into the **A0P, A0N, and REF** pins on the NPG Lite.
2. Peel the backing off the 3 gel electrodes and stick them onto clean, dry skin in the locations above or read the [electrode placement documentation](https://docs.upsidedownlabs.tech/guides/usage-guides/using-gel-electrodes/index.html#using-gel-electrodes).
3. Clip the 3 wire ends onto the electrodes.
4. Connect the NPG Lite to your computer using the USB cable.

> 💡 **Tip:** Clean the skin with an alcohol wipe before sticking the electrodes for a cleaner signal.

---

## ⚙️ How the Code Works

### 1️⃣ Read the heart signal
125 times every second (**sample rate**), the board reads a raw value from the electrodes.

### 2️⃣ Clean the signal (Filter)
`ECGFilter()` removes slow wobbles (breathing/movement) and fast noise (electrical interference) - a **band-pass filter**.

### 3️⃣ Find the heartbeat (Peak Detection)
`Getpeak()` checks if the current signal is much higher than the recent average - if yes, it's a heartbeat (**peak**).

### 4️⃣ Calculate BPM and send it over Bluetooth
Time between peaks is measured, averaged over a buffer, and converted to BPM:

The BPM value  is packed into 2 raw bytes and sent via **Bluetooth Low Energy (BLE)**, so apps like nRF Connect can display reading (e.g. `72`).

---

## 📡 How Bluetooth Sending Works

| Name | ID Code | What it means |
|---|---|---|
| **Service UUID** | `180D` | Official "Heart Rate Service" |
| **Characteristic UUID** | `2A37` | Official "Heart Rate Measurement" |

Device name over Bluetooth: **`MyESP32`**

---

## 🚀 How to Use It

### A. Set up Arduino IDE
1. Open **Arduino IDE**.
2. **Tools → Board → Boards Manager** → search "esp32" → install **esp32 by Espressif Systems**.
3. **Sketch → Include Library → Manage Libraries** → install `CircularBuffer` (BLE libraries come built-in with the ESP32 package).

### B. Select board
4. **Tools → Board** → select the matching ESP32 option (e.g. "ESP32C6 Dev Module").
5. **Tools → Port** → select your NPG Lite's COM port.

### C. Upload
6. Copy the code in the Arduino IDE.
7. Click **Upload** and wait for it to finish.

### D. View on computer
8. Open **Serial Monitor** (baud `115200`) to see raw values printed live.

### E. View on phone
9. Install the **nRF Connect** app from Play Store / App Store.
10. Open the app and tap **Scan**.
11. Find and tap **`MyESP32`** → tap **Connect**.
12. Scroll to find the **Heart Rate** service (`180D`).
13. Tap the **Heart Rate Measurement** characteristic (`2A37`) → tap the **notify** icon.
14. Watch your live BPM update! 💓

---

## 🛠️ Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| No signal / flat line | Bad electrode contact | Clean skin, press stickers firmly(read the [documentation](https://docs.upsidedownlabs.tech/guides/usage-guides/using-gel-electrodes/index.html#using-gel-electrodes)) |
| BPM jumps wildly | Loose wires or movement | Stay still, recheck all 3 connections |
| Device not showing in Bluetooth scan | Upload issue or board not powered | Re-upload, check USB connection, check Serial Monitor |
| BPM always 0 | IN+ or IN- electrode not making contact | Recheck electrode placement and connection |
| Random/garbled value in nRF Connect | Display format set incorrectly | Ensure you have tapped the Heart Rate Service (`180D`), which parses standard formats automatically |
