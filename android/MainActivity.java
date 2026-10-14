// Else Android WebView shell - loads the same Web app (server base control)
// File: app/src/main/java/com/elseapp/MainActivity.java
package com.elseapp;

import android.os.Bundle;
import android.webkit.*;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.gms.ads.*;
import com.google.android.gms.ads.rewarded.*;

public class MainActivity extends AppCompatActivity {
    WebView wv;
    // Live server (Cloudflare Tunnel) - TSX app route on the app host
    String SERVER_URL = "https://app.elsepay.indevs.in/";
    // LIVE: Adsterra Social Bar runs inside this WebView (see web/index.html).
    // TODO(AdMob): replace the test rewarded ID below with your real
    // ca-app-pub-xxxx/xxxx ID before Play release + set SSV callback.
    // AdMob rewarded ad unit (Google sample id - replace with your own before release)
    String ADMOB_REWARDED_ID = "ca-app-pub-3940256099942544/5224354917"; // test id

    protected void onCreate(Bundle b) {
        super.onCreate(b);
        MobileAds.initialize(this, s -> {});
        wv = new WebView(this);
        setContentView(wv);
        WebSettings s2 = wv.getSettings();
        s2.setJavaScriptEnabled(true);
        s2.setDomStorageEnabled(true);
        wv.setWebViewClient(new WebViewClient());
        wv.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void showRewarded(final String sessionId) {
                runOnUiThread(() -> RewardedAd.load(MainActivity.this, ADMOB_REWARDED_ID,
                    new AdRequest.Builder().build(),
                    new RewardedAdLoadCallback() {
                        public void onAdLoaded(RewardedAd ad) {
                            ad.show(MainActivity.this, reward -> {
                                // Web page will call /api/ads/rewarded/complete with sessionId
                                // Real SSV: AdMob server calls https://app.elsepay.indevs.in/api/ads/ssv?user_id=..&session_id=..
                                wv.evaluateJavascript("document.getElementById('adstat').innerText='Native AdMob done, verifying...'", null);
                            });
                        }
                    }));
            }
        }, "AndroidRewarded");
        wv.loadUrl(SERVER_URL);
    }
}
