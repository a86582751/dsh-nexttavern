package app.nexttavern.android.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import app.nexttavern.android.mobile.core.OriginPolicy;
import java.util.ArrayList;

/** A real browser surface for the owned Harness UI; never a native JavaScript bridge. */
public final class MainActivity extends Activity {
    private static final int FILE_CHOOSER = 42;
    private RuntimeService service;
    private boolean bound;
    private WebView web;
    private TextView status;
    private Button start;
    private Button stop;
    private Button reload;
    private ProgressBar progress;
    private OriginPolicy origin;
    private String loadedGeneration;
    private ValueCallback<Uri[]> pendingFiles;
    private final Runnable observer = this::render;
    private Object back;
    private final ServiceConnection connection = new ServiceConnection() {
        @Override public void onServiceConnected(ComponentName name, IBinder binder) {
            service = ((RuntimeService.LocalBinder) binder).service();
            service.observe(observer);
            render();
        }
        @Override public void onServiceDisconnected(ComponentName name) {
            service = null;
            status.setText("本地服务连接中断；重新打开应用可恢复启动");
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        status = new TextView(this);
        status.setPadding(12, 8, 12, 8);
        status.setText("NextTavern Mobile · 开发中\n点击启动；后台运行由通知中的停止操作控制。");
        root.addView(status);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);
        progress.setVisibility(View.GONE);
        root.addView(progress, new LinearLayout.LayoutParams(-1, -2));
        LinearLayout actions = new LinearLayout(this);
        start = button(actions, "启动", () -> {
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 43);
            }
            startForegroundService(new Intent(this, RuntimeService.class).setAction(RuntimeService.START));
        });
        stop = button(actions, "停止", this::confirmStop);
        reload = button(actions, "重载界面", () -> { if (origin != null) web.reload(); });
        root.addView(actions);
        web = new WebView(this);
        web.setSaveEnabled(false);
        web.setSaveFromParentEnabled(false); // Do not serialize official startup-token URLs/history.
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (origin != null && origin.contains(url)) return false;
                if (request.isForMainFrame()) external(request.getUrl());
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) status.setText("本地界面暂时不可用；可重载界面或检查本地服务状态。");
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (origin != null && origin.contains(url) && service != null) status.setText(service.snapshot().message);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) { return true; }
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFiles != null) pendingFiles.onReceiveValue(null);
                pendingFiles = callback;
                Intent choose = params.createIntent().setAction(Intent.ACTION_OPEN_DOCUMENT);
                choose.addCategory(Intent.CATEGORY_OPENABLE);
                choose.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(choose, FILE_CHOOSER); }
                catch (ActivityNotFoundException error) {
                    pendingFiles.onReceiveValue(null); pendingFiles = null;
                    Toast.makeText(MainActivity.this, "系统文件选择器不可用", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
        });
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 33) back = Api33Back.register(this, this::goBackOrFinish);
    }
    private Button button(LinearLayout parent, String label, Runnable action) {
        Button button = new Button(this);
        button.setText(label); button.setOnClickListener(view -> action.run()); parent.addView(button);
        return button;
    }
    private void external(Uri uri) {
        String scheme = uri.getScheme();
        // A different local port is not this runtime. Never send its auth URL to another app.
        if ((!"https".equals(scheme) && !"http".equals(scheme))
            || "127.0.0.1".equals(uri.getHost()) || "localhost".equals(uri.getHost()) || "::1".equals(uri.getHost())) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException error) { Toast.makeText(this, "没有可打开此链接的浏览器", Toast.LENGTH_SHORT).show(); }
    }
    private void render() {
        if (service == null) return;
        RuntimeService.Snapshot snapshot = service.snapshot();
        status.setText(snapshot.message);
        progress.setVisibility(snapshot.state == RuntimeService.State.STARTING || snapshot.state == RuntimeService.State.STOPPING
            ? View.VISIBLE : View.GONE);
        boolean idle = snapshot.state == RuntimeService.State.STOPPED || snapshot.state == RuntimeService.State.ERROR;
        start.setEnabled(idle);
        stop.setEnabled(!idle);
        stop.setText(snapshot.state == RuntimeService.State.STOPPING ? "强制停止" : "停止");
        reload.setEnabled(snapshot.state == RuntimeService.State.RUNNING);
        if (snapshot.state == RuntimeService.State.RUNNING && !snapshot.generation.equals(loadedGeneration)) {
            origin = snapshot.origin;
            loadedGeneration = snapshot.generation;
            web.loadUrl(snapshot.url);
        } else if (idle && origin != null) {
            origin = null; loadedGeneration = null; web.loadUrl("about:blank");
        }
    }
    private void confirmStop() {
        if (service == null) return;
        boolean force = service.snapshot().state == RuntimeService.State.STOPPING;
        new AlertDialog.Builder(this).setTitle(force ? "强制停止本地服务？" : "停止 NextTavern？")
            .setMessage(force ? "尚未完成的回应或导入会被强制中断。已保存的故事不会被主动删除。"
                : "将中断当前生成并等待本地任务收尾。已保存的故事保留；返回或旋转屏幕不需要停止服务。")
            .setNegativeButton("继续运行", null).setPositiveButton(force ? "强制停止" : "停止并收尾", (dialog, which) -> {
                if (service != null) service.requestStop(force);
            }).show();
    }
    @Override protected void onStart() {
        super.onStart();
        bound = bindService(new Intent(this, RuntimeService.class), connection, BIND_AUTO_CREATE);
    }
    @Override protected void onStop() {
        if (service != null) service.unobserve(observer);
        if (bound) unbindService(connection);
        bound = false; service = null;
        super.onStop(); // No process cancellation: the service owns the session.
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != FILE_CHOOSER || pendingFiles == null) return;
        Uri[] selected = WebChromeClient.FileChooserParams.parseResult(result, data);
        ArrayList<Uri> content = new ArrayList<>();
        if (selected != null) for (Uri uri : selected) if ("content".equals(uri.getScheme())) content.add(uri);
        pendingFiles.onReceiveValue(content.isEmpty() ? null : content.toArray(new Uri[0]));
        pendingFiles = null;
    }
    private void goBackOrFinish() { if (web.canGoBack()) web.goBack(); else finish(); }
    @Override public void onBackPressed() { goBackOrFinish(); }
    /** Keep API33 callback classes out of Activity field initialization on API26–32. */
    @android.annotation.TargetApi(33)
    private static final class Api33Back {
        static Object register(Activity activity, Runnable action) {
            OnBackInvokedCallback callback = action::run;
            activity.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback);
            return callback;
        }
        static void unregister(Activity activity, Object callback) {
            activity.getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback((OnBackInvokedCallback) callback);
        }
    }
    @Override protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33) Api33Back.unregister(this, back);
        if (pendingFiles != null) pendingFiles.onReceiveValue(null);
        ((ViewGroup) web.getParent()).removeView(web);
        web.destroy();
        super.onDestroy();
    }
}
