# Else - run + preview

## 1. Run server (live preview)
```
cd else
npm install
npm start
```
Open: http://localhost:3000  (App - mobile UI)
Admin: http://localhost:3000/admin  (key: else-admin-123)

## 2. WebView Android
- Android Studio e new project (package com.elseapp)
- `android/MainActivity.java` copy koro
- Gradle: implementation 'com.google.android.gms:play-services-ads:22.6.0'
- Manifest e INTERNET permission
- SERVER_URL = tomar Render/VPS URL daw
- AdMob rewarded ID bosaw, SSV callback URL AdMob dashboard e set koro:
  `https://tomar-server/api/ads/ssv`

## 3. AdMob SSV (real $)
AdMob > Apps > SSV > callback URL daw. Server `/api/ads/ssv` verify kore tobei coin dey (C10).

## 4. Config
`/admin` theke: ads on/off, rewardByCountry (lowest rate), cooldown, dailyMax, minWithdraw $10, notice, maintenance.
