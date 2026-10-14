# Else - run + preview (v1.1)

## 1. Run server (live preview)
```
npm install
npm start
```
Open: http://localhost:3000/app  (App - mobile UI)
Admin: http://localhost:3000/admin  (dev key: else-admin-123, prod: ADMIN_KEY env)

## 2. Live ads (real)
- Web/App: Adsterra Social Bar tag `web/index.html` e live (build e `public/app` e jay).
  CSP `server.js` e allow kora. Server restart er por kaj kore.
- Rewarded video (AdMob): `android/MainActivity.java` e test ID ache — release er age
  real `ca-app-pub-.../...` ID bosaw + SSV callback URL AdMob dashboard e set koro:
  `https://tomar-server/api/ads/ssv`

## 3. WebView Android
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
