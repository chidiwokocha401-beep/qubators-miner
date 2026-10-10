package com.qubators.miner;

import android.app.Activity;
import android.content.Context;
import android.os.Bundle;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private WebView wv;
    private static final String HOME =
            "https://chidiwokocha401-beep.github.io/qubators-miner/qubators-miner.html";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        wv = new WebView(this);
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) {
                    v.loadData("<html><body style='background:#0b0f14;color:#fff;"
                            + "font-family:sans-serif;text-align:center;padding:60px'>"
                            + "<h2>No connection</h2>"
                            + "<p>Connect to the internet, then "
                            + "<a style='color:#f5a623' href='" + HOME + "'>tap here to retry</a>.</p>"
                            + "</body></html>", "text/html", "utf-8");
                }
            }
        });

        if (savedInstanceState != null) {
            wv.restoreState(savedInstanceState);
        } else {
            wv.loadUrl(HOME);
        }
        wv.addJavascriptInterface(new PrintBridge(), "AndroidPrint");
        setContentView(wv);
    }

    private class PrintBridge {
        @JavascriptInterface
        public void print() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    if (pm != null) {
                        pm.print("Qubators Certificate",
                                wv.createPrintDocumentAdapter("QubatorsCertificate"), null);
                    }
                }
            });
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        wv.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (wv.canGoBack()) {
            wv.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
