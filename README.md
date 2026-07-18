# Heart-BioAmp-Firmware
Firmware for Heart BioAmp hardware from Upside Down Labs

| No. | Program | Description |
| ---- | ------- | --------- |
|1 | [Fixed_Sampling](1_FixedSampling)| Sample from ADC at a fixed rate for easy processing of signal.|
|2 | [ECG_Filter](2_ECGFilter)| A 0.5 - 44.5 Hz band-pass filter sketch for clean Electrocardiography.|
|3 | [Heart_Rate_Detection](3_HeartRateDetection)| ECG signal based BPM (beats per minute) calculator.|
|4 | [Heart_Beat_Detection](4_HeartBeatDetection)| Standard deviation based heart beat detection algorithm.|
|5 | [BLE_Heart_Rate_Detection](5_BLEHeartRateDetection)| ECG based Heart Rate calculator with ESP32 BLE.|
|6 | [Faster_Heart_Rate_Detection](6_FasterHeartRateDetection)| More optimized and faster calculation of BPM.|
|7 | [OLED_BPM](7_OLED_BPM)| Displaying Heart Rate(BPM) on OLED Screen|
|8 | [Breathing_Monitor](7_OLED_BPM)| Displaying Heart Rate(BPM) on OLED Screen|


Compatibility of various boards with Brain-BioAmp sensors
<table>
    <thead>
        <tr>
            <th>No.</th>
            <th>Development Board</th>
             <th>Maximum ADC Resolution</th>
            <th>Sensor</th>
            <th>Compatibility</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td >1</td>
            <td align= "center" >Arduino UNO R3<br>&<br>Maker UNO</td>
            <td align = "center" >10 bits</td>
            <td>Bioamp EXG Pill</td>
            <td align = "center">✅</td>
        </tr>
        <tr>
            <td >2</td>
            <td align = "center" >Arduino UNO R4 Minima<br>&<br>Arduino UNO R4 Wifi</td>
            <td align = "center">14 bits</td>
            <td>Bioamp EXG Pill</td>
            <td align= "center">✅</td>
        </tr>
        <tr>
            <td >3</td>
            <td align = "center" >Raspberry Pi Pico</td>
            <td align = "center" >12 bits</td>
            <td>Bioamp EXG Pill</td>
            <td align = "center">❌</td>
        </tr>
       <tr>
             <td >4</td>
            <td align= "center"  >ESP32 C3 MINI</td>
           <td align = "center" >12 bits</td>
            <td align = "center">Bioamp EXG Pill</td>
            <td align= "center">❌</td>
        </tr>
        <tr>
             <td >5</td>
            <td align= "center"  >Arduino Due</td>
           <td align = "center" >12 bits</td>
            <td>Bioamp EXG Pill</td>
            <td align = "center">✅</td>
        </tr>
        <tr>
             <td>6</td>
            <td align= "center"  >Arduino Nano</td>
           <td align = "center" >10 bits</td>
            <td>Bioamp EXG Pill</td>
            <td align = "center">✅</td>
        </tr>
        </tbody>
    </table>

## Examples

1. **ECG Filter**

    A band-pass filter for EMG signals between 0.5 Hz and 44.5 Hz

    <img src="02_ECG_Filter/ECGFilter.png" height="300" width="400">
    

2. **ECG Wave**

    EMG signal detection for biomedical applications.

    <img src="02_ECG_Filter/ECGWaves.png" height="300" width="400">
