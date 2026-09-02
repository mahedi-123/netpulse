package com.netpulse.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

/**
 * Hosts the NetPulse web app in a WebView and exposes native network data to it.
 *
 * The web assets are served through WebViewAssetLoader on a real https origin
 * (https://appassets.androidplatform.net/) rather than file://. That matters:
 * the speed test runs in Web Workers and uses fetch()/WebSocket, all of which
 * are restricted or blocked under a file:// origin.
 */
public class MainActivity extends AppCompatActivity {

    private static final String ASSET_DOMAIN = "appassets.androidplatform.net";
    private static final int LOCATION_PERMISSION_REQUEST = 1001;

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        // Keep the dark app chrome consistent with the web UI while it loads.
        webView.setBackgroundColor(0xFF0F0D0A);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);          // the app uses localStorage
        settings.setMediaPlaybackRequiresUserGesture(false);
        // The app is served over https by the asset loader, but "My PC" talks to
        // a plain-http LAN address, so mixed content has to be permitted.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(ASSET_DOMAIN)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });

        webView.addJavascriptInterface(new NetBridge(), "AndroidNet");

        webView.loadUrl("https://" + ASSET_DOMAIN + "/assets/www/index.html");
    }

    /** Let the hardware back button navigate the WebView before leaving the app. */
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private boolean hasLocationPermissionInternal() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        // The web layer polls getWifiInfo() on a timer, so it picks up the new
        // permission state on its own without needing a callback here.
    }

    /**
     * The object injected into JavaScript as `window.AndroidNet`.
     *
     * Every method must be annotated @JavascriptInterface to be callable, and
     * runs on a background thread - so nothing here touches the UI directly.
     */
    private class NetBridge {

        @JavascriptInterface
        public String getWifiInfo() {
            JSONObject json = new JSONObject();
            try {
                ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
                String networkType = "none";
                boolean connected = false;
                boolean metered = false;

                if (cm != null) {
                    NetworkCapabilities caps = cm.getNetworkCapabilities(cm.getActiveNetwork());
                    if (caps != null) {
                        connected = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
                        if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) networkType = "wifi";
                        else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) networkType = "cellular";
                        else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) networkType = "ethernet";
                        else networkType = "other";
                        metered = !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED);
                    }
                }

                json.put("connected", connected);
                json.put("networkType", networkType);
                json.put("metered", metered);

                if ("wifi".equals(networkType)) {
                    WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                    if (wm != null) {
                        WifiInfo info = wm.getConnectionInfo();
                        if (info != null) {
                            int rssi = info.getRssi();
                            json.put("rssi", rssi);
                            json.put("signalLevel", WifiManager.calculateSignalLevel(rssi, 5));
                            json.put("linkSpeedMbps", info.getLinkSpeed());

                            // getFrequency() needs API 21; minSdk is 24, so no guard required.
                            json.put("frequencyMhz", info.getFrequency());

                            // Android redacts the SSID unless location permission is held.
                            if (hasLocationPermissionInternal()) {
                                String ssid = info.getSSID();
                                if (ssid != null) {
                                    ssid = ssid.replaceAll("^\"|\"$", ""); // strip surrounding quotes
                                    json.put("ssid", ssid);
                                }
                            }
                        }
                    }
                }
            } catch (Exception e) {
                // Any failure degrades to "no data" rather than crashing the app.
                try {
                    json.put("connected", false);
                    json.put("error", String.valueOf(e.getMessage()));
                } catch (Exception ignored) {
                    // nothing further we can do
                }
            }
            return json.toString();
        }

        @JavascriptInterface
        public boolean hasLocationPermission() {
            return hasLocationPermissionInternal();
        }

        @JavascriptInterface
        public void requestLocationPermission() {
            if (!hasLocationPermissionInternal()) {
                // Permission dialogs must be triggered from the UI thread.
                runOnUiThread(() -> ActivityCompat.requestPermissions(
                        MainActivity.this,
                        new String[]{Manifest.permission.ACCESS_FINE_LOCATION},
                        LOCATION_PERMISSION_REQUEST));
            }
        }

        @JavascriptInterface
        public String getAppVersion() {
            return "1.0";
        }
    }
}
