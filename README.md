# Heart-BioAmp-Firmware
Firmware for Heart BioAmp hardware from Upside Down Labs

| No. | Program | Description |
| ---- | ------- | --------- |
|1 | [FixedSampling](1_FixedSampling)| Sample from ADC at a fixed rate for easy processing of signal.|
|2 | [ECGFilter](2_ECGFilter)| A 0.5 - 44.5 Hz band-pass filter sketch for clean Electrocardiography.|
|3 | [HeartRateDetection](3_HeartRateDetection)| ECG signal based BPM (beats per minute) calculator.|
|4 | [HeartBeatDetection](4_HeartBeatDetection)| Standard deviation based heart beat detection algorithm.|
|5 | [BLEHeartRateDetection](5_BLEHeartRateDetection)| ECG based Heart Rate calculator with ESP32 BLE.|


## Examples

1. **ECG Filter**

    A band-pass filter for EMG signals between 0.5 Hz and 44.5 Hz

    <img src="2_ECGFilter/ECGFilter.png" height="300" width="400">
    

2. **ECG Wave**

    EMG signal detection for biomedical applications.

    <img src="2_ECGFilter/ECGWaves.png" height="300" width="400">
