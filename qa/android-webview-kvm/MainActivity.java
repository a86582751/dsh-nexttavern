package app.nexttavern.android.webviewcontrol;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Tiny QA control derived from the existing local control; no Host/Node/bridge/account data. */
public final class MainActivity extends Activity {
    private static final String TAG = "NextTavernKvmControl";
    private WebView web;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        boolean transport = getIntent().getBooleanExtra("transport", false);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        TextView status = new TextView(this);
        status.setText("Native control ready. WebView has not been created.");
        root.addView(status);
        Button create = new Button(this);
        create.setText("Create WebView / local HTML");
        create.setContentDescription("WEBVIEW_CREATE");
        root.addView(create);
        setContentView(root);
        Log.i(TAG, "NATIVE_READY");
        create.setOnClickListener(view -> {
            create.setEnabled(false);
            status.setText("Creating system WebView; no Host or external page.");
            Log.i(TAG, "WEBVIEW_REQUESTED");
            PackageInfo provider = WebView.getCurrentWebViewPackage();
            if (provider == null) throw new IllegalStateException("WEBVIEW_PROVIDER_MISSING");
            Log.i(TAG, "PROVIDER " + provider.packageName + " " + provider.versionName);
            WebView.setWebContentsDebuggingEnabled(false);
            web = new WebView(this);
            web.getSettings().setJavaScriptEnabled(true);
            web.getSettings().setDomStorageEnabled(true);
            web.getSettings().setAllowFileAccess(false);
            web.getSettings().setAllowContentAccess(false);
            web.setWebChromeClient(new WebChromeClient() {
                @Override public boolean onConsoleMessage(ConsoleMessage message) {
                    if ("KVM_JS_DOM_READY".equals(message.message())) {
                        Log.i(TAG, "JS_DOM_READY");
                        return true;
                    }
                    if ("KVM_JS_DOM_FAILED".equals(message.message())) {
                        Log.e(TAG, "JS_DOM_FAILED");
                        return true;
                    }
                    return false;
                }
            });
            web.setWebViewClient(new WebViewClient() {
                @Override public void onPageFinished(WebView view, String url) {
                    status.setText("Local HTML page finished; QA control only.");
                    Log.i(TAG, "PAGE_FINISHED");
                }
                @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                    if (request.isForMainFrame()) Log.e(TAG, "PAGE_ERROR");
                    super.onReceivedError(view, request, error);
                }
                @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                    Log.e(TAG, "RENDERER_GONE");
                    return false; // Preserve Android's fatal/default behavior; never suppress a renderer crash.
                }
            });
            root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
            web.loadDataWithBaseURL("https://example.invalid/",
                "<!doctype html><meta name='viewport' content='width=device-width'>"
                + "<h1>Local WebView control</h1><p id='result'>HTML loaded</p>"
                + (transport ? "<form onsubmit='return false'><label for='transport-password'>Transport password</label>"
                    + "<input id='transport-password' type='password' aria-label='Transport password' autocomplete='off'>"
                    + "</form>" : "")
                + "<script>document.getElementById('result').textContent='KVM_JS_DOM_READY';"
                + "if(document.getElementById('result').textContent==='KVM_JS_DOM_READY')"
                + "console.log('KVM_JS_DOM_READY');else console.error('KVM_JS_DOM_FAILED');</script>",
                "text/html", "UTF-8", null);
        });
    }

    @Override protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
